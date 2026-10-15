import { Skeleton } from '@funfriday/ui';

export default function RootLoading() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton variant="block" count={2} label="Loading page" />
    </main>
  );
}
