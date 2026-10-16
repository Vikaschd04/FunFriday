export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Outbound mail boundary (ADR 0002). P2 ships only local adapters; a real provider
 * adapter needs explicit approval (P3) so no external send can happen by accident.
 */
export abstract class MailerPort {
  abstract send(message: MailMessage): Promise<void>;
}
