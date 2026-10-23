import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { applyContextPath, assertMissingContext, deriveV5Context } from '../tools/context-paths.js';
import { loadContract, serverPaths } from '../tools/contracts.js';
import { sha256 } from '../tools/lib.js';
import { sample, validatorFor } from '../tools/schema.js';

test('server variables preserve each upstream base path', () => {
  assert.deepEqual(
    serverPaths([
      {
        url: '{apiRoot}/tmf-api/customer/v5/',
        variables: { apiRoot: { default: 'https://production.invalid' } },
      },
    ]),
    ['/tmf-api/customer/v5'],
  );
  assert.throws(() => serverPaths([{ url: '/{unresolved}' }]), /Unresolved/);
});
test('context derivation replaces only the version and refuses existing or unresolved contexts', () => {
  assert.equal(deriveV5Context('/tmf-api/serviceInventory/v4/'), '/tmf-api/serviceInventory/v5');
  assert.throws(() => deriveV5Context('/tmf-api/serviceInventory/v3'));
  assert.doesNotThrow(() => assertMissingContext({ servers: [{ url: 'https://serverRoot' }] }));
  assert.throws(() => assertMissingContext({ servers: [{ url: '/tmf-api/serviceInventory/v5' }] }));
  assert.throws(() =>
    assertMissingContext({
      servers: [{ url: '{apiRoot}', variables: { apiRoot: { default: '/' } } }],
    }),
  );
});
test('reviewed context overrides preserve explicit servers and reject changed target bytes', async () => {
  const sources = JSON.parse(await readFile('catalog/spec-lock.json', 'utf8'));
  const source = sources.find((entry: any) => entry.apiId === 'TMF637' && entry.major === 'v5');
  const doc = {
    servers: [{ url: 'https://serverRoot' }],
    paths: {
      '/thing': {
        servers: [{ url: '/explicit-path' }],
        get: { servers: [{ url: '/explicit-operation' }] },
      },
    },
  };
  await applyContextPath(source, doc);
  assert.deepEqual(doc.servers, [{ url: '/tmf-api/productInventory/v5' }]);
  assert.equal(doc.paths['/thing'].servers[0].url, '/explicit-path');
  assert.equal(doc.paths['/thing'].get.servers[0].url, '/explicit-operation');
  await assert.rejects(
    () => applyContextPath({ ...source, sha256: 'changed' }, { servers: [{ url: '/' }] }),
    /source review/,
  );
});
test('remote and traversal references are blocked before parsing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tmf-security-'));
  for (const ref of [
    'http://169.254.169.254/latest/meta-data',
    '../secret.json',
    'file:///etc/passwd',
  ]) {
    const bytes = JSON.stringify({
      swagger: '2.0',
      info: { title: 'Test', version: '1.0' },
      paths: {},
      definitions: { Bad: { $ref: ref } },
    });
    const localFile = join(dir, 'spec.json');
    await writeFile(localFile, bytes);
    await assert.rejects(
      () => loadContract({ localFile, sha256: sha256(bytes) }),
      /UNPINNED_EXTERNAL_REFERENCE/,
    );
  }
});
test('fixtures are validated for required, enum, allOf, and nullable constraints', () => {
  const schema = {
    allOf: [
      {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', enum: ['synthetic-001'] } },
      },
      {
        type: 'object',
        required: ['state'],
        properties: {
          state: { type: 'string', enum: ['active'] },
          endDate: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    ],
  };
  const doc = { components: { schemas: {} } },
    validate = validatorFor(schema, doc);
  assert(validate(sample(schema, doc)));
  assert(validate({ id: 'synthetic-001', state: 'active', endDate: null }));
  assert(!validate({ id: 'synthetic-001', state: 'made-up' }));
  assert(!validate({ state: 'active' }));
});
