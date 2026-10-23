import { readFile } from 'node:fs/promises';
import SwaggerParser from '@apidevtools/swagger-parser';
import { convertObj } from 'swagger2openapi';
import YAML from 'yaml';
import { applyContextPath } from './context-paths.js';
import { sha256 } from './lib.js';
export const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

export async function loadContract(source: any) {
  const bytes = await readFile(source.localFile);
  if (sha256(bytes) !== source.sha256) throw new Error('SOURCE_HASH_MISMATCH');
  const original = YAML.parse(bytes.toString());
  // No automatic network or filesystem access through untrusted references.
  const check = (x: any) => {
    if (!x || typeof x !== 'object') return;
    if (typeof x.$ref === 'string' && !x.$ref.startsWith('#/'))
      throw new Error(`UNPINNED_EXTERNAL_REFERENCE: ${x.$ref}`);
    for (const v of Object.values(x)) check(v);
  };
  check(original);
  const bundled: any = await SwaggerParser.bundle(structuredClone(original), {
    resolve: { file: false, http: false, external: false },
  });
  const doc: any = original.swagger
    ? await new Promise((res, rej) =>
        convertObj(bundled, { patch: false, warnOnly: false, resolve: false }, (err, result) =>
          err ? rej(err) : res(result.openapi),
        ),
      )
    : bundled;
  await applyContextPath(source, doc);
  return { original, doc };
}

export function serverPaths(servers: any[] | undefined): string[] {
  return [
    ...new Set(
      (servers?.length ? servers : [{ url: '/' }]).map((server) => {
        let url = server.url;
        url = url.replace(/\{([^}]+)\}/g, (_: string, name: string) => {
          if (server.variables?.[name]?.default == null)
            throw new Error(`Unresolved server variable: ${name}`);
          return String(server.variables[name].default);
        });
        const parsed = new URL(url, 'https://mock.example.invalid');
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.search || parsed.hash)
          throw new Error(`Unsupported server URL: ${url}`);
        return parsed.pathname.replace(/\/$/, '');
      }),
    ),
  ];
}
