import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Catalog } from './models.js';

export const catalog: Catalog = JSON.parse(await readFile('catalog/catalog.json', 'utf8'));
export const pairs = catalog.apis.flatMap((a) =>
  a.directory_major_versions.map((major) => ({
    apiId: a.api_id,
    major,
    special: a.needs_special_review,
  })),
);
export const key = (p: { apiId: string; major: string }) => `${p.apiId}/${p.major}`;
export const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
export async function json<T = any>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8'));
}
export async function save(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const i = index++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}
