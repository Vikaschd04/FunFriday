import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@funfriday/ui';
import { LibraryView } from '@/components/library-view';

export const metadata: Metadata = { title: 'Activities' };

export default function LibraryPage() {
  return (
    <Suspense fallback={<Skeleton variant="card" count={3} label="Loading activities" />}>
      <LibraryView />
    </Suspense>
  );
}
