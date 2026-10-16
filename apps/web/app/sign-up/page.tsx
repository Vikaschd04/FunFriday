import type { Metadata } from 'next';
import { SignUpForm } from '@/components/auth-forms';
import { PublicShell } from '@/components/public-shell';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <PublicShell>
      <SignUpForm next={typeof next === 'string' ? next : undefined} />
    </PublicShell>
  );
}
