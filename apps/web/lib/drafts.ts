import {
  EVENT_LIMITS,
  eventDraftActivitySchema,
  type EventDraftActivity,
} from '@funfriday/contracts';

/**
 * Local-only draft storage (decision D016). Everything stays in this browser's
 * localStorage; nothing is sent anywhere. The envelope is versioned so the format
 * can change, and every entry is parsed leniently so one damaged draft never
 * breaks the list.
 */
export const DRAFTS_STORAGE_KEY = 'funfriday:drafts:v1';
export const DRAFTS_VERSION = 1;
/** Hardening limits: stored text is untrusted input (other tabs, extensions, old versions). */
export const MAX_STORED_CHARS = 1_000_000;
export const MAX_DRAFTS = 50;
const MAX_URL_CHARS = 2048;

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Lenient shape of a stored draft: everything optional because drafts may be partial. */
export interface StoredDraft {
  id: string;
  updatedAt: string;
  title?: string;
  startsAtLocal?: string;
  timeZone?: string;
  durationMinutes?: number;
  expectedParticipants?: number;
  meetingUrl?: string;
  activities?: EventDraftActivity[];
}

const STRING_FIELDS = ['title', 'startsAtLocal', 'timeZone', 'meetingUrl'] as const;
const NUMBER_FIELDS = ['durationMinutes', 'expectedParticipants'] as const;

function isHttpsUrl(value: string): boolean {
  if (value === '') return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Lenient parse of one stored entry (the web app has no direct zod dependency, so this is a
 * hand-written guard; activity rows reuse the contract schema). Returns null when damaged.
 */
export function parseStoredDraft(value: unknown): StoredDraft | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || record.id === '') return null;
  if (typeof record.updatedAt !== 'string' || Number.isNaN(Date.parse(record.updatedAt))) {
    return null;
  }
  const draft: StoredDraft = { id: record.id.slice(0, 128), updatedAt: record.updatedAt };
  for (const key of STRING_FIELDS) {
    const field = record[key];
    if (field === undefined) continue;
    if (typeof field !== 'string') return null;
    const max = key === 'title' ? EVENT_LIMITS.titleMax : key === 'meetingUrl' ? MAX_URL_CHARS : 64;
    draft[key] = field.slice(0, max);
  }
  // Only https links survive a load; anything else (javascript:, data:, http:) is dropped.
  if (draft.meetingUrl !== undefined && !isHttpsUrl(draft.meetingUrl)) draft.meetingUrl = '';
  for (const key of NUMBER_FIELDS) {
    const field = record[key];
    if (field === undefined) continue;
    if (typeof field !== 'number' || !Number.isFinite(field)) return null;
    draft[key] = field;
  }
  if (record.activities !== undefined) {
    if (
      !Array.isArray(record.activities) ||
      record.activities.length > EVENT_LIMITS.activitiesMax
    ) {
      return null;
    }
    const activities: EventDraftActivity[] = [];
    for (const row of record.activities) {
      const parsed = eventDraftActivitySchema.safeParse(row);
      if (!parsed.success) return null;
      activities.push(parsed.data);
    }
    draft.activities = activities;
  }
  return draft;
}

/** The fields a caller provides when saving (id and updatedAt are managed here). */
export type DraftInput = Omit<StoredDraft, 'id' | 'updatedAt'>;

export type DraftListItem = { kind: 'draft'; draft: StoredDraft } | { kind: 'corrupt'; id: string };

export type DraftsFailure = 'unavailable' | 'corrupt' | 'too_large';
export type DraftsListResult =
  { ok: true; items: DraftListItem[] } | { ok: false; reason: DraftsFailure };

export type DraftSaveResult =
  { ok: true; draft: StoredDraft } | { ok: false; reason: 'unavailable' | 'quota' | 'limit' };

/** The browser's localStorage, or null when blocked (private mode, disabled cookies). */
export function getBrowserStorage(): DraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

type RawEntry = unknown;

function entryId(entry: RawEntry, index: number): string {
  if (typeof entry === 'object' && entry !== null && 'id' in entry) {
    const id = entry.id;
    if (typeof id === 'string' && id !== '') return id;
  }
  return `corrupt-${index}`;
}

type ReadRaw = { ok: true; entries: RawEntry[] } | { ok: false; reason: DraftsFailure };

function readRaw(storage: DraftStorage | null): ReadRaw {
  if (!storage) return { ok: false, reason: 'unavailable' };
  let text: string | null;
  try {
    text = storage.getItem(DRAFTS_STORAGE_KEY);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (text === null) return { ok: true, entries: [] };
  if (text.length > MAX_STORED_CHARS) return { ok: false, reason: 'too_large' };
  try {
    const envelope: unknown = JSON.parse(text);
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      (envelope as { version?: unknown }).version !== DRAFTS_VERSION ||
      !Array.isArray((envelope as { drafts?: unknown }).drafts)
    ) {
      return { ok: false, reason: 'corrupt' };
    }
    // Never trust the stored count: look at no more than MAX_DRAFTS entries.
    return { ok: true, entries: (envelope as { drafts: unknown[] }).drafts.slice(0, MAX_DRAFTS) };
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

type WriteResult = { ok: true } | { ok: false; reason: 'unavailable' | 'quota' };

function writeRaw(storage: DraftStorage, entries: RawEntry[]): WriteResult {
  try {
    storage.setItem(
      DRAFTS_STORAGE_KEY,
      JSON.stringify({ version: DRAFTS_VERSION, drafts: entries }),
    );
    return { ok: true };
  } catch (error) {
    const quota =
      error instanceof Error &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    return { ok: false, reason: quota ? 'quota' : 'unavailable' };
  }
}

export function listDrafts(storage: DraftStorage | null = getBrowserStorage()): DraftsListResult {
  const raw = readRaw(storage);
  if (!raw.ok) return raw;
  const items = raw.entries.map((entry, index): DraftListItem => {
    const parsed = parseStoredDraft(entry);
    return parsed
      ? { kind: 'draft', draft: parsed }
      : { kind: 'corrupt', id: entryId(entry, index) };
  });
  return { ok: true, items };
}

export type GetDraftResult =
  { ok: true; item: DraftListItem | null } | { ok: false; reason: DraftsFailure };

/** `item` is null when no draft has this id. */
export function getDraft(
  id: string,
  storage: DraftStorage | null = getBrowserStorage(),
): GetDraftResult {
  const list = listDrafts(storage);
  if (!list.ok) return list;
  const item = list.items.find((entry) =>
    entry.kind === 'draft' ? entry.draft.id === id : entry.id === id,
  );
  return { ok: true, item: item ?? null };
}

export interface SaveDraftOptions {
  storage?: DraftStorage | null;
  /** Existing draft id to update; a new one is created when omitted or not found. */
  id?: string;
  now?: () => Date;
  newId?: () => string;
}

/** Creates or updates a draft. A corrupt envelope is replaced (its contents were unreadable). */
export function saveDraft(input: DraftInput, options: SaveDraftOptions = {}): DraftSaveResult {
  const storage = options.storage === undefined ? getBrowserStorage() : options.storage;
  if (!storage) return { ok: false, reason: 'unavailable' };
  const raw = readRaw(storage);
  if (!raw.ok && raw.reason === 'unavailable') return { ok: false, reason: 'unavailable' };
  // A corrupt or oversized envelope is unreadable, so it is replaced by a fresh one.
  const entries = raw.ok ? raw.entries : [];

  const now = options.now ?? (() => new Date());
  const id = options.id ?? (options.newId ?? (() => crypto.randomUUID()))();
  const draft: StoredDraft = { ...input, id, updatedAt: now().toISOString() };

  const index = entries.findIndex((entry, i) => entryId(entry, i) === id);
  const next = [...entries];
  if (index === -1) {
    if (next.length >= MAX_DRAFTS) return { ok: false, reason: 'limit' };
    next.push(draft);
  } else {
    next[index] = draft;
  }

  const written = writeRaw(storage, next);
  return written.ok ? { ok: true, draft } : written;
}

export type DeleteDraftResult = { ok: true } | { ok: false; reason: DraftsFailure | 'quota' };

export function deleteDraft(
  id: string,
  storage: DraftStorage | null = getBrowserStorage(),
): DeleteDraftResult {
  const raw = readRaw(storage);
  if (!raw.ok) return raw;
  if (!storage) return { ok: false, reason: 'unavailable' };
  const next = raw.entries.filter((entry, i) => entryId(entry, i) !== id);
  const written = writeRaw(storage, next);
  return written.ok ? { ok: true } : written;
}
