import assert from 'node:assert/strict';
import { assertSameBuild, buildIdentity } from './build-identity.js';
import { json, key, save } from './lib.js';

const report = await json('generated/reports/coverage.json');
const locks = await json('catalog/spec-lock.json');
assert.equal(report.failedOperations, 0, 'Cannot accept a baseline with failing operations');
assertSameBuild(report.build, await buildIdentity());
assert.equal(
  report.contractMockedPairs,
  locks.length,
  'Every locked contract must pass before updating the baseline',
);
const supported = report.pairs.filter((p: any) => p.state === 'CONTRACT_MOCKED');
await save(
  'catalog/coverage-baseline.json',
  supported.map((p: any) => ({
    apiId: p.apiId,
    major: p.major,
    declaredOperations: p.declaredOperations,
    sha256: locks.find((s: any) => key(s) === key(p)).sha256,
  })),
);
console.log(
  `Recorded ${supported.length} verified pairs as the regression baseline. Review changes to this file with source refreshes.`,
);
