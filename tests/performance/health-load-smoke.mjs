#!/usr/bin/env node
/**
 * P0 HTTP load smoke: fires concurrent readiness probes at a RUNNING API and
 * fails on any error, any non-200, or a p95 over budget. Dependency-free so it
 * runs anywhere Node runs. P4 extends this harness with real Socket.IO clients
 * (see docs/QUALITY_STRATEGY.md Q03/Q11).
 *
 * Env: LOAD_BASE_URL (default http://localhost:4000/api/v1), LOAD_CONCURRENCY
 * (default 20 - the default room size), LOAD_REQUESTS (default 400),
 * LOAD_P95_BUDGET_MS (default 250, the provisional action-ack objective).
 */
const baseUrl = (process.env.LOAD_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 20);
const total = Number(process.env.LOAD_REQUESTS ?? 400);
const p95BudgetMs = Number(process.env.LOAD_P95_BUDGET_MS ?? 250);
const target = `${baseUrl}/health/ready`;

const latencies = [];
const failures = new Map();
let issued = 0;

function recordFailure(reason) {
  failures.set(reason, (failures.get(reason) ?? 0) + 1);
}

async function worker() {
  while (issued < total) {
    issued += 1;
    const started = performance.now();
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(5_000) });
      const body = await res.json();
      latencies.push(performance.now() - started);
      if (res.status !== 200 || body.status !== 'ready')
        recordFailure(`HTTP ${res.status} ${body.status}`);
    } catch (error) {
      recordFailure(error instanceof Error ? error.name : 'unknown');
    }
  }
}

const percentile = (sorted, p) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
    : NaN;

const wallStart = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const wallMs = performance.now() - wallStart;

const sorted = [...latencies].sort((a, b) => a - b);
const p50 = percentile(sorted, 50);
const p95 = percentile(sorted, 95);
const p99 = percentile(sorted, 99);
const failed = [...failures.values()].reduce((sum, n) => sum + n, 0);

console.log(`target       ${target}`);
console.log(`requests     ${total} (concurrency ${concurrency}) in ${(wallMs / 1000).toFixed(2)}s`);
console.log(`throughput   ${(total / (wallMs / 1000)).toFixed(0)} req/s`);
console.log(
  `latency ms   p50 ${p50.toFixed(1)} | p95 ${p95.toFixed(1)} | p99 ${p99.toFixed(1)} | max ${sorted.at(-1)?.toFixed(1)}`,
);
console.log(
  `failures     ${failed}${failed ? ' ' + JSON.stringify(Object.fromEntries(failures)) : ''}`,
);

const problems = [];
if (failed > 0) problems.push(`${failed} failed requests`);
if (!(p95 <= p95BudgetMs)) problems.push(`p95 ${p95.toFixed(1)}ms exceeds budget ${p95BudgetMs}ms`);
if (problems.length) {
  console.error(`FAIL: ${problems.join('; ')}`);
  process.exit(1);
}
console.log(`PASS: 0 failures, p95 within ${p95BudgetMs}ms budget`);
