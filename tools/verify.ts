import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import app from '../apps/api-worker/src/index.js';
import { assertSameBuild, buildIdentity } from './build-identity.js';
import { loadContract, methods, serverPaths } from './contracts.js';
import { json, key, pairs, save } from './lib.js';
import type { BuildIdentity, CompilationReport, SourceGap, SourceLock } from './models.js';
import { resolveRef, validatorFor } from './schema.js';
import { assertVerifiedContracts, readBaseline } from './verification-policy.js';

const manifest = await json('generated/manifest.json');
const locks = await json<SourceLock[]>('catalog/spec-lock.json');
const gaps = await json<SourceGap[]>('catalog/source-gaps.json');
const reports = await json<CompilationReport[]>('generated/reports/compilation.json');
const baseline = await readBaseline();
const identity = await json<BuildIdentity>('generated/build-info.json');
assertSameBuild(identity, await buildIdentity());
export const assets = {
  fetch: async (request: Request) => {
    const path = decodeURIComponent(new URL(request.url).pathname);
    if (path.split('/').some((s) => s === '..') || !path.startsWith('/'))
      return new Response(null, { status: 400 });
    try {
      return new Response(await readFile(`public${path}`), {
        headers: { 'Content-Type': path.endsWith('.json') ? 'application/json' : 'text/html' },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  },
};
const timings: number[] = [],
  failures: any[] = [];
let passed = 0;
for (const source of locks) {
  const report = reports.find((r) => key(r) === key(source));
  assert(report, `Missing compilation report: ${key(source)}`);
  if (report.state === 'BLOCKED') continue;
  const { original, doc } = await loadContract(source);
  // Count source operations independently from generated fixtures and routes.
  const declared: { method: string; path: string }[] = [];
  for (const [path, raw] of Object.entries(original.paths)) {
    const item = resolveRef(raw, original);
    for (const method of methods) if (item[method]) declared.push({ method, path });
  }
  assert.equal(report.declaredOperations, declared.length);
  let pairPassed = 0;
  for (const { method, path } of declared) {
    try {
      const item = resolveRef(doc.paths[path], doc),
        op = item[method];
      const bases = serverPaths(op.servers ?? item.servers ?? doc.servers);
      const matches = manifest.filter(
        (m: any) =>
          key(m) === key(source) &&
          m.method === method.toUpperCase() &&
          bases.some((b) => `${b}${path}` === m.pathTemplate),
      );
      assert.equal(matches.length, bases.length, 'Missing route variants');
      for (const route of matches) {
        const fixtureData =
          route.fixture && route.seeded ? await json(`public${route.fixture}`) : null;
        const fixtureId =
          fixtureData && !Array.isArray(fixtureData) ? fixtureData.id : 'synthetic-001';
        const url = route.pathTemplate.replace(/\{[^}]+\}/g, fixtureId);
        const started = performance.now();
        const response = await app.request(
          `https://sandbox.example.invalid${url}`,
          {
            method: route.method,
          },
          { ASSETS: assets },
        );
        timings.push(performance.now() - started);
        assert.equal(response.status, route.status, `${method} ${url}`);
        assert.equal(response.headers.get('X-Contract-SHA256'), source.sha256);
        const text = await response.text();
        if (!route.fixture) assert.equal(text, '');
        else {
          assert.equal(response.headers.get('Content-Type'), route.mediaType);
          const value = route.mediaType.includes('json') ? JSON.parse(text) : text;
          const responseSpec = resolveRef(op.responses[String(route.status)], doc);
          const schema = responseSpec.content?.[route.mediaType]?.schema;
          if (schema) {
            const validate = validatorFor(schema, doc);
            assert(validate(value), JSON.stringify(validate.errors));
          } else assert.equal(route.schemaValidation, 'NO_SCHEMA');
        }
      }
      pairPassed++;
      passed++;
    } catch (e) {
      failures.push({
        apiId: source.apiId,
        major: source.major,
        method,
        path,
        reason: String(e).slice(0, 2000),
      });
    }
  }
  report.passedOperations = pairPassed;
  report.seededReads = manifest
    .filter((m: any) => key(m) === key(source) && m.seeded)
    .map((m: any) => ({ method: m.method, path: m.pathTemplate }));
  report.state =
    pairPassed === declared.length && declared.length > 0 && report.failures.length === 0
      ? 'CONTRACT_MOCKED'
      : 'COMPILED';
}
const blocked = [
  ...gaps,
  ...reports
    .filter((r: any) => r.state === 'BLOCKED')
    .map((r: any) => ({
      apiId: r.apiId,
      major: r.major,
      state: 'BLOCKED',
      reason: 'COMPILATION_BLOCKED',
      detail: r.failures.map((e: any) => e.reason).join('; '),
    })),
];
const coverage = {
  build: identity,
  catalogSnapshot: '2026-10-22',
  expectedApiCount: 104,
  expectedMajorPairs: 159,
  sourceVerifiedPairs: locks.length,
  compiledPairs: reports.filter((r) => (r.routedVariants ?? 0) > 0).length,
  contractMockedPairs: reports.filter((r: any) => r.state === 'CONTRACT_MOCKED').length,
  seededReadPairs: reports.filter((r: any) => r.seededReads?.length).length,
  totalDeclaredOperations: reports.reduce(
    (n: number, r: any) => n + (r.declaredOperations ?? 0),
    0,
  ),
  passedOperations: passed,
  failedOperations: failures.length,
  schemaValidatedOperations: manifest.filter((m: any) => m.schemaValidation === 'VALIDATED').length,
  bodylessOperations: manifest.filter((m: any) => !m.fixture).length,
  unvalidatedOperations: reports.flatMap((r: any) =>
    (r.unvalidatedOperations ?? []).map((op: any) => ({ apiId: r.apiId, major: r.major, ...op })),
  ),
  blockedPairs: blocked,
  pairs: pairs.map(
    (p) => reports.find((r: any) => key(r) === key(p)) ?? gaps.find((r: any) => key(r) === key(p)),
  ),
  isComplete: false,
  verification:
    'All declared operations independently enumerated from pinned sources and exercised through the Worker Fetch handler. Schema assertions where schemas exist; no-schema responses reported separately. Local verification, not Cloudflare production CPU measurement.',
};
coverage.isComplete = coverage.contractMockedPairs === 159 && failures.length === 0;
await save('generated/reports/coverage.json', coverage);
await save('public/coverage.json', coverage);
await save('generated/reports/integration-failures.json', failures);
const publicCatalog = await json('public/catalog.json');
for (const api of publicCatalog.apis)
  api.versions = coverage.pairs.filter((p: any) => p.apiId === api.api_id);
await save('public/catalog.json', publicCatalog);
const files = async (dir: string): Promise<string[]> =>
  (
    await Promise.all(
      (
        await readdir(dir, { withFileTypes: true })
      ).map(async (d) => (d.isDirectory() ? files(`${dir}/${d.name}`) : [`${dir}/${d.name}`])),
    )
  ).flat();
const allFiles = await files('public');
const sizes = await Promise.all(
  allFiles.map(async (f) => ({ path: f, bytes: (await stat(f)).size })),
);
timings.sort((a, b) => a - b);
await save('generated/reports/free-tier.json', {
  build: identity,
  assetFiles: sizes.length,
  assetBytes: sizes.reduce((n, s) => n + s.bytes, 0),
  largestAsset: sizes.sort((a, b) => b.bytes - a.bytes)[0],
  assetLimitsPass: sizes.length <= 20_000 && sizes.every((s) => s.bytes <= 25 * 1024 * 1024),
  localHandlerWallMs: {
    p50: timings[Math.floor(timings.length * 0.5)],
    p95: timings[Math.floor(timings.length * 0.95)],
    max: timings.at(-1),
  },
  cloudflareCpuMs: null,
  status: 'ASSET_LIMITS_CHECKED; PRODUCTION_CPU_NOT_MEASURED',
  limitsSource: 'https://developers.cloudflare.com/workers/platform/limits/',
});
console.log(
  JSON.stringify(
    {
      sourceVerifiedPairs: locks.length,
      compiledPairs: coverage.compiledPairs,
      contractMockedPairs: coverage.contractMockedPairs,
      declaredOperations: coverage.totalDeclaredOperations,
      passedOperations: passed,
      failedOperations: failures.length,
      blockedPairs: blocked.length,
    },
    null,
    2,
  ),
);
assertVerifiedContracts(reports, locks, baseline, failures.length);
