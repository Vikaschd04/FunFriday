'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  FilterChips,
  Notice,
  SearchField,
  Select,
} from '@funfriday/ui';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DURATION_OPTIONS,
  EMPTY_FILTERS,
  SIZE_OPTIONS,
  capacityHint,
  countHiddenBySize,
  filterActivities,
  hasActiveFilters,
  parseFilters,
  serializeFilters,
  type LibraryFilters,
} from '@/lib/library-filters';
import { ActivityCard } from './activity-card';
import { EmptyMotif } from './motifs';
import { useCatalog } from './use-catalog';

export function LibraryView() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<LibraryFilters>(() => parseFilters(params));
  const { catalog, reload } = useCatalog();
  const [offline, setOffline] = useState(false);
  const first = useRef(true);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keep filters in the URL so refresh and back keep them (replace: no history spam).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const query = serializeFilters(filters);
    window.history.replaceState(null, '', query === '' ? window.location.pathname : `?${query}`);
  }, [filters]);

  useEffect(() => {
    const update = () => {
      setOffline(!navigator.onLine);
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const set = (patch: Partial<LibraryFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };
  const active = hasActiveFilters(filters);
  const clear = () => {
    setFilters(EMPTY_FILTERS);
    // The Clear button may unmount; keep focus somewhere sensible: the search field.
    searchRef.current?.focus();
  };

  const all = catalog.status === 'ready' ? catalog.activities : [];
  const shown = filterActivities(all, filters);
  const hiddenBySize = countHiddenBySize(all, filters);
  const summary =
    catalog.status === 'ready' ? `Showing ${shown.length} of ${all.length} activities` : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-[30px] leading-9 font-extrabold tracking-tight text-ff-ink md:text-[40px] md:leading-[46px]">
          Activities
        </h1>
        <p className="mt-1 max-w-[68ch] text-lg text-ff-muted">
          Short games and moments for your team. Browse what&apos;s planned and add them to an
          event.
        </p>
      </header>

      <section
        aria-label="Filter activities"
        className="flex flex-col gap-4 rounded-ff-card bg-ff-surface p-4 shadow-ff-sm lg:sticky lg:top-2 lg:z-10"
      >
        <SearchField
          ref={searchRef}
          label="Search activities"
          placeholder="Search activities"
          value={filters.q}
          onValueChange={(q) => {
            set({ q });
          }}
          resultsMessage={summary}
        />
        <FilterChips
          label="Category"
          chips={CATEGORY_ORDER.map((id) => ({
            id,
            label: CATEGORY_LABELS[id],
            pressed: filters.cat.includes(id),
          }))}
          onToggle={(id) => {
            const category = CATEGORY_ORDER.find((c) => c === id);
            if (!category) return;
            set({
              cat: filters.cat.includes(category)
                ? filters.cat.filter((c) => c !== category)
                : CATEGORY_ORDER.filter((c) => c === category || filters.cat.includes(c)),
            });
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Group size"
            value={filters.size}
            onChange={(event) => {
              set({ size: event.target.value });
            }}
            options={SIZE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <Select
            label="Duration"
            value={filters.dur}
            onChange={(event) => {
              set({ dur: event.target.value });
            }}
            options={DURATION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
          <p className="ff-tnum text-ff-ink">{summary ?? 'Loading activities...'}</p>
          {active && (
            <Button variant="ghost" onClick={clear}>
              Clear filters
            </Button>
          )}
        </div>
      </section>

      {catalog.status === 'loading' && (
        <div aria-busy="true">
          <p role="status" className="sr-only">
            Loading activities
          </p>
          <div aria-hidden="true" className="grid gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="ff-skeleton h-[280px] rounded-ff-card" />
            ))}
          </div>
        </div>
      )}

      {catalog.status === 'error' && (
        <ErrorState
          title={offline ? 'You seem to be offline' : "We couldn't load the activities"}
          body={
            offline
              ? 'You seem to be offline. Check your connection and try again.'
              : "The activity list didn't come through. Your filters are kept. Try again."
          }
          onRetry={reload}
          retryLabel="Try again"
          className="max-w-2xl"
        />
      )}

      {catalog.status === 'ready' && all.length === 0 && (
        <EmptyState
          illustration={<EmptyMotif />}
          title="No activities yet"
          body="Check back soon."
        />
      )}

      {catalog.status === 'ready' && all.length > 0 && shown.length === 0 && (
        <EmptyState
          illustration={<EmptyMotif />}
          title="No activities match"
          body="Try a different search or clear a filter."
          primaryAction={<Button onClick={clear}>Clear filters</Button>}
        />
      )}

      {catalog.status === 'ready' && hiddenBySize > 0 && (
        <Notice tone="info">
          Some activities are hidden because they don&apos;t fit a group of this size.
        </Notice>
      )}

      {catalog.status === 'ready' && shown.length > 0 && (
        <ul aria-label="Activities" className="grid gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {shown.map((activity, index) => (
            <ActivityCard
              key={activity.slug}
              activity={activity}
              capacityHint={capacityHint(activity, filters)}
              index={index}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
