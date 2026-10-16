import type { Metadata } from 'next';
import { DevMailboxView } from '@/components/dev-mailbox-view';
import { PublicShell } from '@/components/public-shell';

export const metadata: Metadata = { title: 'Dev mailbox' };

export default function DevMailboxPage() {
  return (
    <PublicShell>
      <DevMailboxView />
    </PublicShell>
  );
}
