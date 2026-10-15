import type { Metadata } from 'next';
import { EmptyState } from '@funfriday/ui';
import { AppLinkButton } from '@/components/app-link-button';
import { LostDotMotif } from '@/components/motifs';
import { PublicShell } from '@/components/public-shell';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-xl pt-10">
        <EmptyState
          headingLevel={1}
          illustration={<LostDotMotif />}
          title="We can't find that page"
          body="The link may be old or mistyped."
          primaryAction={<AppLinkButton href="/app">Go to dashboard</AppLinkButton>}
          secondaryAction={
            <AppLinkButton href="/" variant="secondary">
              Back to home
            </AppLinkButton>
          }
        />
      </div>
    </PublicShell>
  );
}
