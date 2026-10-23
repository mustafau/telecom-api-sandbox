import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { BaselineEntry, CompilationReport, SourceLock } from './models.js';

export function parseBaseline(value: unknown): BaselineEntry[] {
  assert(Array.isArray(value) && value.length > 0, 'Coverage baseline must be a nonempty array');
  const keys = new Set<string>();
  for (const entry of value) {
    assert(entry && typeof entry === 'object', 'Invalid baseline entry');
    assert.match(entry.apiId, /^TMF\d{3}$/);
    assert.match(entry.major, /^v[1-5]$/);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert(Number.isInteger(entry.declaredOperations) && entry.declaredOperations > 0);
    const key = `${entry.apiId}/${entry.major}`;
    assert(!keys.has(key), `Duplicate baseline pair: ${key}`);
    keys.add(key);
  }
  return value;
}

export async function readBaseline(path = 'catalog/coverage-baseline.json') {
  // Missing, malformed, and empty baselines are errors, never an opt-out.
  return parseBaseline(JSON.parse(await readFile(path, 'utf8')));
}

export function assertVerifiedContracts(
  reports: CompilationReport[],
  locks: SourceLock[],
  baseline: BaselineEntry[],
  failureCount: number,
) {
  assert.equal(
    failureCount,
    0,
    'Declared operations failed verification; see integration-failures.json',
  );
  for (const lock of locks) {
    const report = reports.find((r) => r.apiId === lock.apiId && r.major === lock.major);
    assert(
      report?.state === 'CONTRACT_MOCKED',
      `Locked contract failed: ${lock.apiId}/${lock.major}`,
    );
    assert.equal(report.failures.length, 0);
    assert.equal(report.passedOperations, report.declaredOperations);
  }
  for (const previous of baseline) {
    const report = reports.find((r) => r.apiId === previous.apiId && r.major === previous.major);
    const lock = locks.find((s) => s.apiId === previous.apiId && s.major === previous.major);
    assert(
      report?.state === 'CONTRACT_MOCKED',
      `Previously mocked pair regressed: ${previous.apiId}/${previous.major}`,
    );
    assert.equal(
      report.declaredOperations,
      previous.declaredOperations,
      'Operation inventory changed; review the baseline',
    );
    assert.equal(lock?.sha256, previous.sha256, 'Pinned source changed; review the baseline');
  }
}
