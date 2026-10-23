import type { Operation } from '../apps/api-worker/src/types.js';
import { json, key, save } from './lib.js';

const operations: Operation[] = await json('generated/manifest.json');
for (const operation of operations) {
  if (
    !operation.fixture ||
    !Object.keys(operation.headers).some((h) =>
      ['x-total-count', 'x-result-count'].includes(h.toLowerCase()),
    )
  )
    continue;
  const value = await json(`public${operation.fixture}`);
  if (Array.isArray(value))
    for (const header of Object.keys(operation.headers))
      if (['x-total-count', 'x-result-count'].includes(header.toLowerCase()))
        operation.headers[header] = String(value.length);
}
await save('generated/manifest.json', operations);
await save('public/manifest.json', operations);
await save(
  'generated/runtime.json',
  operations.map(({ parameters, ...op }) => ({
    ...op,
    parameters: parameters.map(({ name, in: location, required }) => ({
      name,
      in: location,
      required,
    })),
  })),
);
for (const pair of new Set(operations.map(key)))
  await save(
    `public/operations/${pair}.json`,
    operations.filter((o) => key(o) === pair),
  );
console.log(`Packed ${operations.length} routes and fixture-derived collection count headers.`);
