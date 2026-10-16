import { Inject, Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import {
  type ActionAck,
  type ErrorCode,
  type JoinAck,
  LIVE_NAMESPACE,
  LiveEvent,
  gameActionPayloadSchema,
  hostCommandPayloadSchema,
  joinPayloadSchema,
  readyPayloadSchema,
  resyncPayloadSchema,
} from '@funfriday/contracts';
import type { RoomCommand } from '@funfriday/game-core';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { AuthSessionPort } from '../auth/auth-session.port.js';
import { Clock } from './clock.js';
import { LiveLimits, MAX_SOCKETS_PER_USER_PER_SESSION } from './live-limits.js';
import { LIVE_NAMESPACE_ROOM_PREFIX } from './live.constants.js';
import { RoomManager } from './room-manager.js';
import { RoomStoreUnavailableError } from './room-store.js';
import { SessionsService } from './sessions.service.js';
import { TokenBucket } from './token-bucket.js';

interface SocketData {
  userId: string;
  bucket: TokenBucket;
  attached: Set<string>;
  joinChain: Promise<unknown>;
  /** Clock time of the last successful session check. */
  authAt: number;
  /** The session is no longer valid: reject everything, then drop the socket. */
  revoked: boolean;
  /** Set only after a successful `session:join`. */
  sessionId?: string;
  memberId?: string;
}

type LiveSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;
const AUTH_RECHECK_MS = 60_000;
type Ack = (response: unknown) => void;

/** Handshake rejection that the client reads as `error.data.code`. */
function connectError(code: ErrorCode): Error & { data: { code: ErrorCode } } {
  return Object.assign(new Error(code), { data: { code } });
}

const rejectedJoin = (code: ErrorCode): JoinAck => ({ status: 'rejected', code });
const rejectedAck = (revision: number, code: ErrorCode): ActionAck => ({
  status: 'rejected',
  revision,
  code,
});

/**
 * `/live` namespace. The gateway only authenticates, validates, authorises and forwards; all
 * state and rules live in the RoomActor + game-core. Never logs payloads, choices or cookies.
 */
@WebSocketGateway({ namespace: LIVE_NAMESPACE })
export class LiveGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LiveGateway.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly auth: AuthSessionPort,
    private readonly sessions: SessionsService,
    private readonly rooms: RoomManager,
    private readonly clock: Clock,
    private readonly limits: LiveLimits,
  ) {}

  afterInit(namespace: Namespace): void {
    namespace.use((socket, next) => {
      this.authenticate(socket as unknown as LiveSocket).then(
        () => next(),
        (error: unknown) => next(error instanceof Error ? error : connectError('INTERNAL_ERROR')),
      );
    });
  }

  /** CSWSH defence first (cookies ride along on cross-site handshakes), then the session cookie. */
  private async authenticate(socket: LiveSocket): Promise<void> {
    const origin = socket.handshake.headers.origin;
    if (typeof origin !== 'string' || !this.config.webOrigins.includes(origin)) {
      throw connectError('FORBIDDEN');
    }
    let user;
    try {
      user = await this.auth.getSession(socket.handshake.headers);
    } catch {
      throw connectError('SERVICE_UNAVAILABLE');
    }
    if (!user) throw connectError('UNAUTHENTICATED');
    socket.data.userId = user.userId;
    socket.data.bucket = new TokenBucket();
    socket.data.attached = new Set();
    socket.data.joinChain = Promise.resolve();
    socket.data.authAt = this.clock.now();
    socket.data.revoked = false;
    if (!this.limits.register(user.userId, socket.id, socket.data)) {
      throw connectError('RATE_LIMITED');
    }
  }

  handleConnection(socket: LiveSocket): void {
    this.register(socket, LiveEvent.join, (payload) => this.onJoin(socket, payload), rejectedJoin);
    this.register(socket, LiveEvent.ready, (payload) => this.onReady(socket, payload));
    this.register(socket, LiveEvent.hostCommand, (payload) => this.onHostCommand(socket, payload));
    this.register(socket, LiveEvent.gameAction, (payload) => this.onGameAction(socket, payload));
    this.register(
      socket,
      LiveEvent.resync,
      (payload) => this.onResync(socket, payload),
      rejectedJoin,
    );
  }

  handleDisconnect(socket: LiveSocket): void {
    if (socket.data.userId) this.limits.unregister(socket.data.userId, socket.id);
    // Wait for any in-flight join, then detach from EVERY room this socket reached.
    void (async () => {
      await socket.data.joinChain;
      await this.leave(socket);
    })();
  }

  /**
   * Cheap session re-validation: at most once per minute per socket (and always for host
   * commands). A signed-out or switched session is rejected and the socket is dropped after the ack.
   */
  private async ensureAuth(socket: LiveSocket, force: boolean): Promise<ErrorCode | null> {
    if (socket.data.revoked) return 'UNAUTHENTICATED';
    const now = this.clock.now();
    if (!force && now - socket.data.authAt < AUTH_RECHECK_MS) return null;
    let user;
    try {
      user = await this.auth.getSession(socket.handshake.headers);
    } catch {
      return 'SERVICE_UNAVAILABLE';
    }
    if (!user || user.userId !== socket.data.userId) {
      socket.data.revoked = true;
      return 'UNAUTHENTICATED';
    }
    socket.data.authAt = now;
    return null;
  }

  /**
   * Every client event: rate limit -> handler -> ack. Never throws and always acks (when the
   * client supplied a callback), with a safe code on any internal failure.
   */
  private register(
    socket: LiveSocket,
    event: string,
    handler: (payload: unknown) => unknown,
    reject: (code: ErrorCode) => unknown = (code) => rejectedAck(this.revisionOf(socket), code),
  ): void {
    socket.on(event, (payload: unknown, ack?: unknown) => {
      const reply: Ack = typeof ack === 'function' ? (ack as Ack) : () => undefined;
      if (!socket.data.bucket.take() || !this.limits.take(socket.data.userId)) {
        reply(reject('RATE_LIMITED'));
        return;
      }
      Promise.resolve()
        .then(async () => {
          const denied = await this.ensureAuth(socket, false);
          return denied ? reject(denied) : handler(payload);
        })
        .then(
          (response) => {
            reply(response);
            if (socket.data.revoked) socket.disconnect(true);
          },
          (error: unknown) => {
            this.logger.error(
              `handler failed event=${event} socket=${socket.id} error=${error instanceof Error ? error.name : 'unknown'}`,
            );
            reply(reject('INTERNAL_ERROR'));
          },
        );
    });
  }

  private revisionOf(socket: LiveSocket): number {
    const id = socket.data.sessionId;
    return (id && this.rooms.peek(id)?.revision) || 0;
  }

  /** Joins on one socket run strictly one after another (no double attach). */
  private onJoin(socket: LiveSocket, payload: unknown): Promise<JoinAck> {
    const run = socket.data.joinChain.then(() => this.doJoin(socket, payload));
    socket.data.joinChain = run.catch(() => undefined);
    return run;
  }

  private async doJoin(socket: LiveSocket, payload: unknown): Promise<JoinAck> {
    const parsed = joinPayloadSchema.safeParse(payload);
    if (!parsed.success) return rejectedJoin('BAD_REQUEST');
    const { sessionId } = parsed.data;
    if (socket.disconnected) return rejectedJoin('ROOM_NOT_FOUND');

    if (socket.data.sessionId && socket.data.sessionId !== sessionId) await this.leave(socket);

    // Unknown session, ended session and non-member are indistinguishable: ROOM_NOT_FOUND.
    const access = await this.sessions.findJoinable(sessionId, socket.data.userId);
    if (!access) return rejectedJoin('ROOM_NOT_FOUND');

    if (
      !socket.data.attached.has(sessionId) &&
      this.limits.sessionCount(socket.data.userId, sessionId) >= MAX_SOCKETS_PER_USER_PER_SESSION
    ) {
      return rejectedJoin('RATE_LIMITED');
    }

    const { session, membership } = access;
    let actor;
    try {
      actor = await this.rooms.acquire({
        id: session.id,
        organizationId: session.organizationId,
        title: session.title,
        roomCode: session.roomCode,
      });
    } catch (error) {
      if (error instanceof RoomStoreUnavailableError) return rejectedJoin('SERVICE_UNAVAILABLE');
      throw error;
    }

    const isHost = session.hostMembershipId === membership.id || membership.role === 'ADMIN';
    socket.data.attached.add(session.id);
    const ack = await actor.attach(
      {
        id: socket.id,
        memberId: membership.id,
        close: () => socket.disconnect(true),
        send: (state) => (socket as Socket).emit(LiveEvent.state, state),
      },
      { name: membership.name, isHost },
    );
    if (ack.status === 'rejected') {
      socket.data.attached.delete(session.id);
      return rejectedJoin(ack.code === 'SERVICE_UNAVAILABLE' ? ack.code : 'ROOM_NOT_FOUND');
    }
    if (socket.disconnected) {
      // The socket dropped while we were joining: do not leave a ghost connection behind.
      await actor.detach(socket.id);
      socket.data.attached.delete(session.id);
      return rejectedJoin('ROOM_NOT_FOUND');
    }
    socket.data.sessionId = session.id;
    socket.data.memberId = membership.id;
    await socket.join(`${LIVE_NAMESPACE_ROOM_PREFIX}${session.id}`);
    this.logger.log(`joined session=${session.id} member=${membership.id}`);
    return { status: 'joined', state: actor.stateFor(membership.id) };
  }

  private onResync(socket: LiveSocket, payload: unknown): JoinAck {
    const parsed = resyncPayloadSchema.safeParse(payload);
    if (!parsed.success) return rejectedJoin('BAD_REQUEST');
    const actor = this.joinedActor(socket, parsed.data.sessionId);
    if (!actor || !socket.data.memberId) return rejectedJoin('ROOM_NOT_FOUND');
    return { status: 'joined', state: actor.stateFor(socket.data.memberId) };
  }

  private onReady(socket: LiveSocket, payload: unknown): Promise<ActionAck> {
    const parsed = readyPayloadSchema.safeParse(payload);
    if (!parsed.success)
      return Promise.resolve(rejectedAck(this.revisionOf(socket), 'BAD_REQUEST'));
    const { sessionId, ready, clientActionId } = parsed.data;
    return this.forward(socket, sessionId, (memberId) => ({
      type: 'ready',
      memberId,
      ready,
      clientActionId,
    }));
  }

  private async onHostCommand(socket: LiveSocket, payload: unknown): Promise<ActionAck> {
    const parsed = hostCommandPayloadSchema.safeParse(payload);
    if (!parsed.success) return rejectedAck(this.revisionOf(socket), 'BAD_REQUEST');
    const { sessionId, clientActionId, command } = parsed.data;
    const denied = await this.ensureAuth(socket, true);
    if (denied) return rejectedAck(this.revisionOf(socket), denied);
    let gone = false;
    const ack = await this.forward(
      socket,
      sessionId,
      (memberId) => ({ type: 'host', memberId, clientActionId, command }),
      // Runs inside the room queue: membership and role are re-read from Postgres right before
      // the command, so a removal or demotion cannot slip through between check and apply.
      (memberId) => async () => {
        const status = await this.sessions.hostStatus(sessionId, memberId, socket.data.userId);
        if (status === 'gone') {
          gone = true;
          return 'FORBIDDEN';
        }
        return status === 'not_host' ? 'NOT_HOST' : null;
      },
    );
    if (gone) await this.leave(socket);
    return ack;
  }

  private onGameAction(socket: LiveSocket, payload: unknown): Promise<ActionAck> {
    const parsed = gameActionPayloadSchema.safeParse(payload);
    if (!parsed.success)
      return Promise.resolve(rejectedAck(this.revisionOf(socket), 'BAD_REQUEST'));
    const { sessionId, clientActionId, action } = parsed.data;
    return this.forward(socket, sessionId, (memberId) => ({
      type: 'game',
      memberId,
      clientActionId,
      action,
    }));
  }

  /** The member identity comes from the authenticated join - never from the payload. */
  private forward(
    socket: LiveSocket,
    sessionId: string,
    build: (memberId: string) => Exclude<RoomCommand, { type: 'join' | 'disconnect' | 'tick' }>,
    precheck?: (memberId: string) => () => Promise<ErrorCode | null>,
  ): Promise<ActionAck> {
    const actor = this.joinedActor(socket, sessionId);
    const memberId = socket.data.memberId;
    if (!actor || !memberId) return Promise.resolve(rejectedAck(0, 'ROOM_NOT_FOUND'));
    return actor.command(build(memberId), precheck?.(memberId));
  }

  private joinedActor(socket: LiveSocket, sessionId: string) {
    if (socket.data.sessionId !== sessionId) return undefined;
    return this.rooms.peek(sessionId);
  }

  private async leave(socket: LiveSocket): Promise<void> {
    const sessionIds = [...socket.data.attached];
    socket.data.attached.clear();
    socket.data.sessionId = undefined;
    socket.data.memberId = undefined;
    await Promise.all(
      sessionIds.map((id) => this.rooms.peek(id)?.detach(socket.id) ?? Promise.resolve()),
    );
  }
}
