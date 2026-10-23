import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import YAML from 'yaml';
import { json, key, pairs, sha256 } from './lib.js';
import type { SourceGap, SourceLock } from './models.js';

const locks = await json<SourceLock[]>('catalog/spec-lock.json');
const gaps = await json<SourceGap[]>('catalog/source-gaps.json');
const seen = new Set<string>();
for (const source of locks) {
  assert(!seen.has(key(source)), `Duplicate lock: ${key(source)}`);
  seen.add(key(source));
  assert(pairs.some((p) => key(p) === key(source)));
  assert.match(source.upstreamCommit, /^[0-9a-f]{40}$/);
  assert.equal(source.license, 'Apache-2.0');
  assert(source.notices.length, 'License evidence missing');
  const bytes = await readFile(source.localFile);
  assert.equal(sha256(bytes), source.sha256, `Source changed: ${key(source)}`);
  assert.equal(String(YAML.parse(bytes.toString()).info.version), source.exactVersion);
  for (const notice of source.notices)
    assert.equal(sha256(await readFile(notice.localFile)), notice.sha256);
}
for (const gap of gaps) {
  assert(gap.state === 'BLOCKED' && gap.reason && gap.detail);
  assert(!seen.has(key(gap)));
  seen.add(key(gap));
}
assert.deepEqual([...seen].sort(), pairs.map(key).sort());
console.log(
  `Source audit: ${locks.length} verified, ${gaps.length} explicitly blocked; all 159 accounted for.`,
);
