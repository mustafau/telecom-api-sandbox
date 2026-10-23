import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import app from '../apps/api-worker/src/index.js';
import { json } from '../tools/lib.js';

const require = createRequire(import.meta.url);
const { exampleId, examplePath, GENERIC_EXAMPLE_ID } =
  require('../apps/docs-web/public/docs/example-path.js') as {
    exampleId: (
      operation: { apiId?: string; major?: string; seeded?: boolean; pathTemplate?: string },
      projections: {
        apiId: string;
        major: string;
        id: string;
        detail: string;
        collection: string;
      }[],
    ) => string;
    examplePath: (pathTemplate: string, id?: string) => string;
    GENERIC_EXAMPLE_ID: string;
  };

const ASSETS = {
  fetch: async (r: Request) => {
    try {
      return new Response(await readFile(`public${new URL(r.url).pathname}`));
    } catch {
      return new Response(null, { status: 404 });
    }
  },
};

test('example paths use published seeded ids and generic ids otherwise', () => {
  const projections = [
    {
      apiId: 'TMF629',
      major: 'v5',
      id: 'customer-001',
      detail: '/tmf-api/customer/v5/customer/{id}',
      collection: '/tmf-api/customer/v5/customer',
    },
  ];
  const seeded = {
    apiId: 'TMF629',
    major: 'v5',
    seeded: true,
    pathTemplate: '/tmf-api/customer/v5/customer/{id}',
  };
  assert.equal(exampleId(seeded, projections), 'customer-001');
  assert.equal(
    examplePath(seeded.pathTemplate, exampleId(seeded, projections)),
    '/tmf-api/customer/v5/customer/customer-001',
  );
  assert.equal(exampleId({ ...seeded, seeded: false }, projections), GENERIC_EXAMPLE_ID);
  assert.equal(exampleId({ ...seeded, apiId: 'TMF999' }, projections), GENERIC_EXAMPLE_ID);
  assert.equal(
    examplePath('/tmf-api/customer/v5/customer/{id}'),
    '/tmf-api/customer/v5/customer/synthetic-001',
  );
});

test('seeded explorer examples retrieve the published record', async () => {
  const scenario = await json('public/scenarios/support-fiber-outage.json');
  const manifest = await json('generated/manifest.json');
  const details = manifest.filter(
    (op: any) => op.seeded && op.method === 'GET' && op.pathTemplate.includes('{'),
  );
  assert.ok(details.length >= 8);
  for (const op of details) {
    const id = exampleId(op, scenario.projections);
    assert.notEqual(id, GENERIC_EXAMPLE_ID, op.pathTemplate);
    const url = `https://sandbox.invalid${examplePath(op.pathTemplate, id)}`;
    const response = await app.request(url, { method: 'GET' }, { ASSETS });
    assert.equal(response.status, 200, url);
    const body: any = await response.json();
    assert.equal(body.id, id);
    const missed = await app.request(
      `https://sandbox.invalid${examplePath(op.pathTemplate, GENERIC_EXAMPLE_ID)}`,
      { method: 'GET' },
      { ASSETS },
    );
    assert.equal(missed.status, 404, op.pathTemplate);
  }
});
