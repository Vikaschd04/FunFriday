import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { StatusPanel } from '@/components/status-panel';

export const metadata: Metadata = { title: 'System status' };

export default function StatusPage() {
  return (
    <PublicShell>
      <div className="max-w-3xl pt-6 md:pt-10">
        <h1 className="font-heading text-3xl leading-9 font-extrabold tracking-tight text-ff-ink md:text-4xl md:leading-[46px]">
          System status
        </h1>
        <p className="mt-2 text-ff-muted">
          Live checks of the FunFriday API and the services it depends on.
        </p>
        <div className="mt-6">
          <StatusPanel />
          <noscript>
            <p className="mt-3 text-ff-muted">System status needs JavaScript to contact the API.</p>
          </noscript>
        </div>
        <p className="mt-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-ff-violet-700 underline underline-offset-4"
          >
            Back to home
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
