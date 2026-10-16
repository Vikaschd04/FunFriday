import type { Metadata } from 'next';
import { MembersView } from '@/components/members-view';

export const metadata: Metadata = { title: 'Members' };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  return <MembersView orgParam={typeof org === 'string' ? org : undefined} />;
}
