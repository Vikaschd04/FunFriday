import type { ReadinessResult } from '@/lib/api';

export type StatusTone = 'loading' | 'ok' | 'degraded' | 'unreachable' | 'invalid';

export interface DependencyRow {
  key: 'database' | 'redis';
  label: string;
  up: boolean;
  latencyMs: number;
}

export interface StatusView {
  tone: StatusTone;
  title: string;
  detail: string;
  version: string | null;
  dependencies: DependencyRow[];
}

const LABELS = { database: 'Database', redis: 'Realtime service' } as const;

export function describeStatus(result: ReadinessResult | null): StatusView {
  if (!result) {
    return {
      tone: 'loading',
      title: 'Checking system status',
      detail: 'Contacting the FunFriday API.',
      version: null,
      dependencies: [],
    };
  }
  if (result.kind === 'unreachable') {
    return {
      tone: 'unreachable',
      title: 'API unreachable',
      detail:
        'We could not reach the FunFriday API. It may be offline, or your connection may be down.',
      version: null,
      dependencies: [],
    };
  }
  if (result.kind === 'invalid_response') {
    return {
      tone: 'invalid',
      title: 'Unexpected API response',
      detail:
        'The API answered, but not in the format this app understands. Nothing was trusted or shown.',
      version: null,
      dependencies: [],
    };
  }
  const { checks, version } = result.data;
  const dependencies: DependencyRow[] = (['database', 'redis'] as const).map((key) => ({
    key,
    label: LABELS[key],
    up: checks[key].status === 'up',
    latencyMs: checks[key].latencyMs,
  }));
  if (result.kind === 'ready') {
    return {
      tone: 'ok',
      title: 'All systems operational',
      detail: 'The API and its dependencies are responding.',
      version,
      dependencies,
    };
  }
  const down = dependencies.filter((d) => !d.up).map((d) => d.label);
  return {
    tone: 'degraded',
    title: 'Degraded service',
    detail: down.length
      ? `Not responding: ${down.join(' and ')}.`
      : 'The API reports it is not ready.',
    version,
    dependencies,
  };
}
