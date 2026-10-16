import type { Metadata } from 'next';
import { TeamsView } from '@/components/teams-view';

export const metadata: Metadata = { title: 'Teams' };

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  return <TeamsView orgParam={typeof org === 'string' ? org : undefined} />;
}
