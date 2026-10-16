/**
 * What the identity module tells the live module when a membership changes, so open sockets
 * lose (or gain) access immediately. Implemented in the live module; no event bus.
 */
export abstract class LiveAccessPort {
  /** The membership was deleted: disconnect its sockets and mark it away in every room. */
  abstract memberRemoved(organizationId: string, membershipId: string): Promise<void>;
  /** The role changed: refresh the member's host flag in rooms where they are connected. */
  abstract memberRoleChanged(organizationId: string, membershipId: string): Promise<void>;
}
