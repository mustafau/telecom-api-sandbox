import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import type { BuildIdentity } from './models.js';

async function files(directory: string): Promise<string[]> {
  return (
    await Promise.all(
      (
        await readdir(directory, { withFileTypes: true })
      ).map((entry) =>
        entry.isDirectory() ? files(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`],
      ),
    )
  ).flat();
}

export async function buildIdentity(): Promise<BuildIdentity> {
  const inputs = [
    ...(await files('tools')),
    ...(await files('apps')),
    ...(await files('scenarios')),
    ...(await files('catalog')),
    'package.json',
    'package-lock.json',
    '.node-version',
    'tsconfig.json',
    'wrangler.jsonc',
    'NOTICE',
    'LICENSE',
  ]
    .filter((path) => path !== 'catalog/coverage-baseline.json')
    .sort();
  const hash = createHash('sha256');
  for (const path of inputs) {
    hash.update(path);
    hash.update('\0');
    hash.update(await readFile(path));
    hash.update('\0');
  }
  const publicOrigin = process.env.PUBLIC_ORIGIN ?? 'http://localhost:8787';
  hash.update(publicOrigin);
  let sourceRevision: string | null = null;
  try {
    sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    /* A source archive or repository without an initial commit still has a content digest. */
  }
  return {
    sourceRevision,
    sourceDigest: hash.digest('hex'),
    sourceLockSha256: createHash('sha256')
      .update(await readFile('catalog/spec-lock.json'))
      .digest('hex'),
    publicOrigin,
    nodeVersion: process.version,
  };
}

export function assertSameBuild(expected: BuildIdentity, actual: BuildIdentity) {
  if (
    expected.sourceDigest !== actual.sourceDigest ||
    expected.sourceLockSha256 !== actual.sourceLockSha256 ||
    expected.publicOrigin !== actual.publicOrigin
  ) {
    throw new Error(
      'Build inputs changed. Run npm run build before accepting coverage or runtime evidence.',
    );
  }
}
