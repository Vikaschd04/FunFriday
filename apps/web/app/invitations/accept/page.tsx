import type { Metadata } from 'next';
import { InviteAcceptView } from '@/components/invite-accept-view';
import { PublicShell } from '@/components/public-shell';

export const metadata: Metadata = { title: 'Join an organisation' };

export default function InviteAcceptPage() {
  return (
    <PublicShell>
      <InviteAcceptView />
    </PublicShell>
  );
}
