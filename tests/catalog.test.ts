import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { checkCatalog } from '../tools/catalog-check.js';

const baseline = JSON.parse(readFileSync('catalog/catalog.json', 'utf8'));
test('baseline category/version inventory is exact', () =>
  assert.equal(checkCatalog(baseline).pairs, 159));
test('duplicate pairs cannot inflate inventory', () => {
  const copy = structuredClone(baseline);
  copy.apis[0].directory_major_versions.push('v4');
  assert.throws(() => checkCatalog(copy), /Duplicate pair/);
});
test('version substitution is rejected even if total stays constant', () => {
  const copy = structuredClone(baseline);
  copy.apis[0].directory_major_versions[0] = 'v1';
  assert.throws(() => checkCatalog(copy));
});
