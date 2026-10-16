import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard-view';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; joined?: string }>;
}) {
  const { verified, joined } = await searchParams;
  return <DashboardView verified={verified === '1'} joined={joined === '1'} />;
}
