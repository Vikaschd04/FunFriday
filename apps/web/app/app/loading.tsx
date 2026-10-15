import { Skeleton } from '@funfriday/ui';

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="line" label="Loading page" className="max-w-sm" />
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ff-skeleton h-56 rounded-ff-card" />
        ))}
      </div>
    </div>
  );
}
