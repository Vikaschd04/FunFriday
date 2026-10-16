import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth-forms';
import { PublicShell } from '@/components/public-shell';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; signedout?: string }>;
}) {
  const { next, signedout } = await searchParams;
  return (
    <PublicShell>
      <SignInForm
        next={typeof next === 'string' ? next : undefined}
        signedOut={signedout === '1'}
      />
    </PublicShell>
  );
}
