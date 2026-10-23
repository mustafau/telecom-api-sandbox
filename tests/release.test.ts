import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertSameBuild } from '../tools/build-identity.js';
import type { BuildIdentity, CompilationReport, SourceLock } from '../tools/models.js';
import { generatedSpecNotice } from '../tools/provenance.js';
import { schemaForValidation, validatorFor } from '../tools/schema.js';
import { canonicalContract } from '../tools/source-comparison.js';
import {
  assertVerifiedContracts,
  parseBaseline,
  readBaseline,
} from '../tools/verification-policy.js';

const source: SourceLock = {
  apiId: 'TMF629',
  major: 'v5',
  exactVersion: '5.0.1',
  repo: 'tmforum-apis/TMF629_CustomerManagement',
  sourceUrl: 'https://github.com/tmforum-apis/TMF629_CustomerManagement',
  upstreamCommit: 'a'.repeat(40),
  upstreamFile: 'contract.yaml',
  localFile: 'upstream/contract.yaml',
  sha256: 'b'.repeat(64),
  license: 'Apache-2.0',
  maturity: 'UNSPECIFIED',
  review: 'Test contract',
  notices: [{ upstreamFile: 'LICENSE', localFile: 'upstream/LICENSE', sha256: 'c'.repeat(64) }],
};
const passing: CompilationReport = {
  apiId: source.apiId,
  major: source.major,
  state: 'CONTRACT_MOCKED',
  declaredOperations: 2,
  compiledOperations: 2,
  passedOperations: 2,
  failures: [],
};
const baseline = [
  { apiId: source.apiId, major: source.major, declaredOperations: 2, sha256: source.sha256 },
];

test('direct npm dependencies remain exact versions for reproducible updates', async () => {
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  for (const [name, version] of Object.entries({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })) {
    assert.match(
      String(version),
      /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/,
      `${name} must use an exact version`,
    );
  }
});

test('missing, malformed, and empty baselines cannot disable regression checks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tmf-baseline-'));
  await assert.rejects(() => readBaseline(join(directory, 'missing.json')));
  const file = join(directory, 'baseline.json');
  await writeFile(file, '{');
  await assert.rejects(() => readBaseline(file));
  for (const input of [[], {}, [{ ...baseline[0], sha256: 'invalid' }], [...baseline, ...baseline]])
    assert.throws(() => parseBaseline(input));
  assert.deepEqual(parseBaseline(baseline), baseline);
});
test('a newly locked failing contract fails even when absent from the baseline', () => {
  const newSource = { ...source, apiId: 'TMF620' };
  const failed: CompilationReport = {
    ...passing,
    apiId: newSource.apiId,
    state: 'COMPILED',
    passedOperations: 1,
  };
  assert.throws(() => assertVerifiedContracts([passing, failed], [source, newSource], baseline, 1));
  assert.throws(() => assertVerifiedContracts([passing, failed], [source, newSource], baseline, 0));
  assert.doesNotThrow(() => assertVerifiedContracts([passing], [source], baseline, 0));
});
test('changed source hashes and operation counts cannot silently replace accepted coverage', () => {
  assert.throws(() =>
    assertVerifiedContracts([passing], [{ ...source, sha256: 'd'.repeat(64) }], baseline, 0),
  );
  assert.throws(() =>
    assertVerifiedContracts(
      [{ ...passing, declaredOperations: 3, passedOperations: 3 }],
      [source],
      baseline,
      0,
    ),
  );
});
test('source comparison preserves schema property names and literal values', () => {
  for (const name of ['example', 'examples', 'description', 'title', 'properties']) {
    const a = { type: 'object', properties: { [name]: { type: 'string' } } };
    const b = { type: 'object', properties: { [name]: { type: 'integer' } } };
    assert.notDeepEqual(canonicalContract(a), canonicalContract(b));
  }
  assert.notDeepEqual(
    canonicalContract({ enum: [{ description: 'a' }] }),
    canonicalContract({ enum: [{ description: 'b' }] }),
  );
  assert.deepEqual(
    canonicalContract({ type: 'string', description: 'a' }),
    canonicalContract({ type: 'string', description: 'b' }),
  );
});
test('schema normalization preserves annotation-like properties and nested required constraints', () => {
  const schema = {
    type: 'object',
    required: ['example'],
    properties: { example: { type: 'string', enum: ['synthetic'] }, nullable: { type: 'boolean' } },
  };
  const normalized = schemaForValidation(schema);
  assert(normalized.properties.example && normalized.properties.nullable);
  const validate = validatorFor(schema, { components: { schemas: {} } });
  assert(validate({ example: 'synthetic', nullable: true }));
  assert(!validate({ example: 42 }));
});
test('converted specs carry explicit modification, license, and immutable provenance notices', () => {
  const notice = generatedSpecNotice(source);
  assert.match(notice.notice, /Generated and modified/);
  assert.equal(notice.license, 'Apache-2.0');
  assert.equal(notice.sourceSha256, source.sha256);
  assert(notice.sourceUrl.includes(source.upstreamCommit));
  assert.equal(notice.licenseUrls.length, 1);
});
test('runtime evidence rejects changed build inputs', () => {
  const identity: BuildIdentity = {
    sourceRevision: null,
    sourceDigest: 'a',
    sourceLockSha256: 'b',
    publicOrigin: 'http://localhost:8787',
    nodeVersion: process.version,
  };
  assert.doesNotThrow(() => assertSameBuild(identity, identity));
  assert.throws(() => assertSameBuild(identity, { ...identity, sourceDigest: 'changed' }));
});
