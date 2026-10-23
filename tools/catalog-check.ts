import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export function checkCatalog(catalog: any) {
  const categories = {
    'Marketing Sales': 1,
    Customer: 14,
    Product: 10,
    Service: 13,
    Resource: 16,
    'Business Partner': 15,
    Common: 35,
  };
  const versions = { v1: 5, v2: 2, v3: 7, v4: 78, v5: 67 };
  const actualCategories: Record<string, number> = {};
  const actualVersions: Record<string, number> = {};
  const ids = new Set<string>();
  const pairs = new Set<string>();
  for (const api of catalog.apis) {
    assert.match(api.api_id, /^TMF\d{3}$/);
    assert(!ids.has(api.api_id), `Duplicate API: ${api.api_id}`);
    ids.add(api.api_id);
    assert(api.name && api.directory_major_versions.length);
    actualCategories[api.category] = (actualCategories[api.category] ?? 0) + 1;
    for (const major of api.directory_major_versions) {
      assert.match(major, /^v[1-5]$/);
      const key = `${api.api_id}/${major}`;
      assert(!pairs.has(key), `Duplicate pair: ${key}`);
      pairs.add(key);
      actualVersions[major] = (actualVersions[major] ?? 0) + 1;
    }
  }
  assert.equal(ids.size, 104);
  assert.equal(pairs.size, 159);
  assert.equal(catalog.api_count, 104);
  assert.equal(catalog.major_version_pair_count, 159);
  assert.deepEqual(actualCategories, categories);
  assert.deepEqual(actualVersions, versions);
  return {
    apis: ids.size,
    pairs: pairs.size,
    categories: actualCategories,
    versions: actualVersions,
  };
}

if (process.argv[1]?.endsWith('catalog-check.ts')) {
  console.log(
    JSON.stringify(checkCatalog(JSON.parse(readFileSync('catalog/catalog.json', 'utf8'))), null, 2),
  );
}
