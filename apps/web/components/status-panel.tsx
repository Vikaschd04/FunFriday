'use client';

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Loader2,
  RefreshCw,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchReadiness, getApiBaseUrl, type ReadinessResult } from '@/lib/api';
import { describeStatus, type StatusTone } from './status-model';

const toneStyles: Record<StatusTone, { icon: typeof CheckCircle2; badge: string; label: string }> =
  {
    loading: { icon: Loader2, badge: 'bg-ff-violet-50 text-ff-ink', label: 'Checking' },
    ok: { icon: CheckCircle2, badge: 'bg-ff-mint-50 text-ff-mint-700', label: 'Operational' },
    degraded: { icon: AlertTriangle, badge: 'bg-ff-sun-50 text-ff-ink', label: 'Degraded' },
    unreachable: { icon: WifiOff, badge: 'bg-ff-coral-50 text-ff-coral-700', label: 'Unreachable' },
    invalid: { icon: CircleAlert, badge: 'bg-ff-coral-50 text-ff-coral-700', label: 'Unexpected' },
  };

export function StatusPanel() {
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const check = useCallback(async (userInitiated: boolean) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setChecking(true);
    // Clear first so an unchanged result is still a DOM change and gets announced.
    if (userInitiated) setAnnouncement('');
    const next = await fetchReadiness(getApiBaseUrl(), { signal: controller.signal });
    if (controller.signal.aborted) return;
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setResult(next);
    setCheckedAt(time);
    const view = describeStatus(next);
    // Announce every user-initiated check; on page load only announce problems.
    if (userInitiated || view.tone !== 'ok') {
      setAnnouncement(`${view.title}. ${view.detail} Checked at ${time}.`);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    // Initial load; unmount aborts the in-flight request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check(false);
    return () => abortRef.current?.abort();
  }, [check]);

  const view = describeStatus(result);
  const tone = toneStyles[view.tone];
  const Icon = tone.icon;
  const initialLoading = result === null;

  return (
    <section
      aria-labelledby="status-heading"
      className="ff-card rounded-ff-card border border-ff-border bg-ff-surface p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="status-heading" className="font-heading text-xl font-bold text-ff-ink">
          Service health
        </h2>
        <span
          className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${tone.badge}`}
        >
          <Icon
            aria-hidden="true"
            className={`size-4 ${view.tone === 'loading' ? 'ff-spin' : ''}`}
          />
          {tone.label}
        </span>
      </div>

      <p className="mt-4 text-lg font-semibold text-ff-ink">{view.title}</p>
      <p className="mt-1 text-ff-muted">{view.detail}</p>

      {view.dependencies.length > 0 && (
        <ul
          className="mt-5 divide-y divide-ff-border rounded-xl border border-ff-border"
          aria-label="Dependency checks"
        >
          {view.dependencies.map((dep) => (
            <li
              key={dep.key}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <span className="inline-flex items-center gap-2 font-medium text-ff-ink">
                {dep.up ? (
                  <CheckCircle2 aria-hidden="true" className="size-5 text-ff-mint-700" />
                ) : (
                  <XCircle aria-hidden="true" className="size-5 text-ff-coral-700" />
                )}
                {dep.label}
              </span>
              <span className="text-sm text-ff-muted">
                {dep.up ? 'Up' : 'Down'} · {dep.latencyMs} ms
              </span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ff-muted">
        {view.version && (
          <div className="flex gap-1.5">
            <dt>API version</dt>
            <dd className="font-medium text-ff-ink">{view.version}</dd>
          </div>
        )}
        {checkedAt && (
          <div className="flex gap-1.5">
            <dt>Last checked</dt>
            <dd className="font-medium text-ff-ink">{checkedAt}</dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        onClick={() => {
          // aria-disabled (not `disabled`) keeps keyboard focus on the button while checking.
          if (!checking) void check(true);
        }}
        aria-disabled={checking}
        className="ff-press mt-5 inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-ff-button bg-ff-violet-700 px-5 py-2.5 font-semibold text-white hover:bg-ff-violet-800 aria-disabled:cursor-not-allowed aria-disabled:opacity-70"
      >
        <RefreshCw aria-hidden="true" className={`size-4 ${checking ? 'ff-spin' : ''}`} />
        {checking && !initialLoading ? 'Checking…' : 'Check again'}
      </button>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
