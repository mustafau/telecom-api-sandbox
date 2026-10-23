import assert from 'node:assert/strict';
import type { Operation } from '../apps/api-worker/src/types.js';
import { assertSameBuild, buildIdentity } from './build-identity.js';
import { json, mapLimit, save } from './lib.js';
import type { BuildIdentity } from './models.js';

const base = process.env.SMOKE_ORIGIN ?? 'http://localhost:8787';
const parsed = new URL(base);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname))
  throw new Error(
    'HTTP smoke is restricted to localhost; production deployment is a separate approval.',
  );
const operations: Operation[] = await json('generated/manifest.json');
const build = await json<BuildIdentity>('generated/build-info.json');
assertSameBuild(build, await buildIdentity());
const failures: any[] = [];
await mapLimit(operations, 4, async (operation) => {
  try {
    const expected = operation.fixture ? await json(`public${operation.fixture}`) : null;
    const id = operation.seeded && expected?.id ? expected.id : 'synthetic-001';
    const path = operation.pathTemplate.replace(/\{[^}]+\}/g, id);
    const response = await fetch(`${base}${path}`, {
      method: operation.method,
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, operation.status, path);
    assert.equal(response.headers.get('X-Contract-SHA256'), operation.contractSha256);
    if (operation.fixture) {
      assert.equal(response.headers.get('Content-Type'), operation.mediaType);
      if (operation.mediaType!.includes('json')) assert.deepEqual(await response.json(), expected);
      else assert.equal(await response.text(), String(expected));
    } else assert.equal(await response.text(), '');
  } catch (e) {
    failures.push({
      apiId: operation.apiId,
      major: operation.major,
      method: operation.method,
      path: operation.pathTemplate,
      reason: String(e),
    });
  }
});
const endpoints = [
  '/healthz',
  '/catalog',
  '/coverage',
  '/docs/',
  '/docs/app.js',
  '/docs/example-path.js',
  '/docs/style.css',
  '/catalog/TMF629/v5/openapi.json',
  '/scenarios/support-fiber-outage',
  '/third-party-notices.txt',
];
for (const path of endpoints) {
  try {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    await response.arrayBuffer();
  } catch (e) {
    failures.push({ path, reason: String(e) });
  }
}
const report = {
  build,
  origin: base,
  operations: operations.length,
  passed: operations.length - failures.filter((f) => f.apiId).length,
  metaEndpoints: endpoints.length,
  failures,
};
await save('generated/reports/http-smoke.json', report);
console.log(JSON.stringify({ ...report, failures: failures.length }, null, 2));
assert.equal(
  failures.length,
  0,
  'HTTP integration failures: see generated/reports/http-smoke.json',
);
