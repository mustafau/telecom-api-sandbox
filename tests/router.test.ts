import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import app from '../apps/api-worker/src/index.js';
import { createMatcher } from '../apps/api-worker/src/route-matcher.js';
import { json } from '../tools/lib.js';

const ASSETS = {
  fetch: async (r: Request) => {
    try {
      return new Response(await readFile(`public${new URL(r.url).pathname}`));
    } catch {
      return new Response(null, { status: 404 });
    }
  },
};
test('literal routes take priority and absent methods yield 405', () => {
  const match = createMatcher([
    { method: 'GET', pathTemplate: '/thing/{id}' },
    { method: 'POST', pathTemplate: '/thing/special' },
  ]);
  assert.equal(match('POST', '/thing/special').operation?.method, 'POST');
  assert.equal(match('GET', '/thing/special').operation, undefined);
  assert.deepEqual(match('DELETE', '/thing/special').allowed, ['POST']);
  assert.equal(match('GET', '/thing//x').operation, undefined);
  assert.throws(
    () =>
      createMatcher([
        { method: 'POST', pathTemplate: '/thing/{id}' },
        { method: 'POST', pathTemplate: '/thing/{otherId}' },
      ]),
    /Duplicate runtime route/,
  );
});
test('immutable mock mutations cannot change subsequent reads', async () => {
  const manifest = await json('generated/manifest.json');
  const mutation = manifest.find(
    (o: any) =>
      o.method === 'DELETE' &&
      manifest.some(
        (g: any) => g.method === 'GET' && g.seeded && g.pathTemplate === o.pathTemplate,
      ),
  );
  const get = manifest.find(
    (o: any) => o.method === 'GET' && o.pathTemplate === mutation.pathTemplate,
  );
  assert(get && mutation, 'A sourced GET/DELETE pair must exist');
  const fixture = await json(`public${get.fixture}`);
  const url = `https://sandbox.invalid${get.pathTemplate.replace(/\{[^}]+\}/g, fixture.id)}`;
  const initial = await app.request(url, { method: 'GET' }, { ASSETS });
  assert.equal(initial.status, get.status);
  const before = await initial.text();
  const deleted = await app.request(url, { method: 'DELETE' }, { ASSETS });
  assert.equal(deleted.status, mutation.status);
  assert.equal(deleted.headers.get('X-Mock-Mode'), 'immutable-contract');
  assert.equal(await (await app.request(url, { method: 'GET' }, { ASSETS })).text(), before);
});
test('missing v5 contexts become distinct API-specific hubs and preserve v5 response identity', async () => {
  const manifest = await json('generated/manifest.json');
  const overrides = await json('catalog/context-path-overrides.json');
  for (const override of overrides) {
    const spec = await json(`public/specs/${override.apiId}/v5/openapi.json`);
    const context = spec['x-telecom-sandbox-context-path'];
    assert.equal(context.kind, override.contextPath ? 'PROJECT_CONVENTION' : 'DERIVED_FROM_V4');
    const hub = manifest.find(
      (o: any) =>
        o.apiId === override.apiId &&
        o.major === 'v5' &&
        o.method === 'POST' &&
        o.pathTemplate === `${context.contextPath}/hub`,
    );
    assert(hub);
    const response = await app.request(
      `https://sandbox.invalid${hub.pathTemplate}`,
      { method: 'POST' },
      { ASSETS },
    );
    assert.equal(response.status, hub.status);
    assert.equal(response.headers.get('X-Contract-SHA256'), override.targetSha256);
    assert.equal(response.headers.get('Vary'), null);
    const preflight = await app.request(
      `https://sandbox.invalid${hub.pathTemplate}`,
      { method: 'OPTIONS' },
      { ASSETS },
    );
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Headers'), 'Content-Type, Accept');
  }
  assert.equal(
    (await app.request('https://sandbox.invalid/hub', { method: 'POST' }, { ASSETS })).status,
    404,
  );
});
test('seeded collections, details, and cross-contract links agree', async () => {
  const scenario = await json('public/scenarios/support-fiber-outage.json');
  assert(scenario.projections.length >= 8);
  for (const projection of scenario.projections) {
    const list = (await (
      await app.request(`http://localhost:8787${projection.collection}`, {}, { ASSETS })
    ).json()) as any[];
    const response = await app.request(projection.href, {}, { ASSETS });
    assert.equal(response.status, 200);
    const detail: any = await response.json();
    assert.equal(detail.id, projection.id);
    assert.deepEqual(
      list.find((item) => item.id === projection.id),
      detail,
    );
    const absent = await app.request(
      projection.href.replace(projection.id, 'unknown-record'),
      {},
      { ASSETS },
    );
    assert.equal(absent.status, 404);
    for (const link of projection.links) {
      const target = await app.request(link, {}, { ASSETS });
      assert.equal(target.status, 200, link);
      const payload: any = await target.json();
      assert.equal(payload.id, link.split('/').at(-1));
    }
  }
});
test('unknown operations, unsupported query behavior, media negotiation, and CORS are explicit', async () => {
  const manifest = await json('generated/manifest.json');
  const route = manifest.find((o: any) => o.method === 'GET' && o.mediaType?.includes('json'));
  const url = `https://sandbox.invalid${route.pathTemplate.replace(/\{[^}]+\}/g, 'synthetic-001')}`;
  assert.equal(
    (await app.request('https://sandbox.invalid/tmf-api/not-real/v5/foo', {}, { ASSETS })).status,
    404,
  );
  assert.equal((await app.request(`${url}?inventedFilter=x`, {}, { ASSETS })).status, 400);
  assert.equal(
    (await app.request(url, { headers: { Accept: 'image/png' } }, { ASSETS })).status,
    406,
  );
  const response = await app.request(url, {}, { ASSETS });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
});
