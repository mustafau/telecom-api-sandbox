import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import YAML from 'yaml';
import { json, key, sha256 } from './lib.js';
import type { SourceLock } from './models.js';

export type ContextOverride = {
  apiId: string;
  major: string;
  targetSha256: string;
  referenceMajor?: string;
  referenceSha256?: string;
  contextPath?: string;
  reason: string;
};

export function deriveV5Context(basePath: string): string {
  assert.match(basePath, /^\/tmf-api\/[A-Za-z][A-Za-z0-9]*\/v4\/?$/);
  return basePath.replace(/\/v4\/?$/, '/v5');
}

export function assertMissingContext(doc: any) {
  for (const server of doc.servers ?? [{ url: '/' }]) {
    assert(!server.variables, 'Review variable-based servers explicitly');
    const url = new URL(server.url, 'https://sandbox.invalid');
    assert(['http:', 'https:'].includes(url.protocol));
    assert.equal(url.pathname, '/', 'Override no longer applies: upstream provides a context');
    assert(!url.search && !url.hash);
  }
}

export async function applyContextPath(source: SourceLock, doc: any) {
  const overrides = await json<ContextOverride[]>('catalog/context-path-overrides.json');
  const matches = overrides.filter((override) => key(override) === key(source));
  assert(matches.length <= 1, 'Duplicate context override');
  const override = matches[0];
  if (!override) return;
  assert.equal(source.major, 'v5');
  assert.equal(source.sha256, override.targetSha256, 'Context override needs source review');
  assertMissingContext(doc);
  let contextPath: string;
  let evidence: Record<string, string> | null = null;
  if (override.contextPath) {
    assert(!override.referenceMajor && !override.referenceSha256);
    assert.match(override.contextPath, /^\/tmf-api\/[A-Za-z][A-Za-z0-9]*\/v5$/);
    contextPath = override.contextPath;
  } else {
    const sources = await json<SourceLock[]>('catalog/spec-lock.json');
    const reference = sources.find(
      (candidate) =>
        candidate.apiId === source.apiId && candidate.major === override.referenceMajor,
    );
    assert(reference && reference.major === 'v4', 'Missing v4 context evidence');
    assert.equal(reference.sha256, override.referenceSha256);
    const bytes = await readFile(reference.localFile);
    assert.equal(sha256(bytes), reference.sha256);
    const original = YAML.parse(bytes.toString());
    assert.equal(String(original.info.version), reference.exactVersion);
    contextPath = deriveV5Context(original.basePath);
    evidence = {
      sourceUrl: `${reference.sourceUrl}/blob/${reference.upstreamCommit}/${reference.upstreamFile}`,
      sourceSha256: reference.sha256,
      originalContextPath: original.basePath,
    };
  }
  doc['x-telecom-sandbox-context-path'] = {
    kind: evidence ? 'DERIVED_FROM_V4' : 'PROJECT_CONVENTION',
    contextPath,
    reason: override.reason,
    originalServers: structuredClone(doc.servers ?? []),
    evidence,
  };
  doc.servers = [{ url: contextPath }];
}
