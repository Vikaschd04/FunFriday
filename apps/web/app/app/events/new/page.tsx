import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@funfriday/ui';
import { EventBuilder } from '@/components/builder/event-builder';

export const metadata: Metadata = { title: 'Plan a FunFriday' };

export default function NewEventPage() {
  return (
    <Suspense fallback={<Skeleton variant="block" count={3} label="Loading planner" />}>
      <EventBuilder />
    </Suspense>
  );
}
