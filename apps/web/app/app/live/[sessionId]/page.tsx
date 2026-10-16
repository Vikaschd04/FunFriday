import type { Metadata } from 'next';
import { LiveRoom } from '@/components/live/live-room';

export const metadata: Metadata = { title: 'Live' };

export default async function LivePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <LiveRoom sessionId={sessionId} />;
}
