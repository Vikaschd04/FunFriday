import type { Metadata } from 'next';
import { AuditView } from '@/components/audit-view';

export const metadata: Metadata = { title: 'Audit log' };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  return <AuditView orgParam={typeof org === 'string' ? org : undefined} />;
}
