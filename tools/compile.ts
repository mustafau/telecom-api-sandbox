import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { Operation } from '../apps/api-worker/src/types.js';
import { loadContract, methods, serverPaths } from './contracts.js';
import { catalog, json, key, pairs, save } from './lib.js';
import type { CompilationReport, SourceGap, SourceLock } from './models.js';
import { generatedSpecNotice } from './provenance.js';
import { resolveRef, sample, validatorFor } from './schema.js';

const locks = await json<SourceLock[]>('catalog/spec-lock.json');
const gaps = await json<SourceGap[]>('catalog/source-gaps.json');
const provenance: any[] = [];
for (const source of locks) {
  const licenseAssets = [];
  for (const notice of source.notices) {
    const path = `/licenses/${source.apiId}/${source.major}/${basename(notice.upstreamFile)}`;
    await mkdir(`public/licenses/${source.apiId}/${source.major}`, { recursive: true });
    await copyFile(notice.localFile, `public${path}`);
    licenseAssets.push(path);
  }
  provenance.push({
    apiId: source.apiId,
    major: source.major,
    exactVersion: source.exactVersion,
    repo: source.repo,
    upstreamCommit: source.upstreamCommit,
    upstreamFile: source.upstreamFile,
    sourceUrl: `${source.sourceUrl}/blob/${source.upstreamCommit}/${source.upstreamFile.split('/').map(encodeURIComponent).join('/')}`,
    sha256: source.sha256,
    license: source.license,
    licenseAssets,
    maturity: source.maturity,
    review: source.review,
  });
}
await save('public/sources.json', provenance);
await writeFile(
  'public/third-party-notices.txt',
  (await readFile('NOTICE', 'utf8')) +
    '\n\n' +
    provenance
      .map(
        (s) =>
          `${key(s)} @ ${s.exactVersion}\n${s.sourceUrl}\n${s.license}; license texts: ${s.licenseAssets.join(', ')}\nSHA256: ${s.sha256}`,
      )
      .join('\n\n'),
);
const manifest: Operation[] = [],
  reports: CompilationReport[] = [],
  exceptions: any[] = [];
// These paths contain only compiler output, never source material.
for (const dir of [
  'generated/operations',
  'public/fixtures',
  'public/specs',
  'public/operations',
]) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}
for (const source of locks) {
  const operations: Operation[] = [];
  let declared = 0,
    callbacks = 0;
  const failures: any[] = [];
  try {
    const { original, doc } = await loadContract(source);
    declared = Object.values(original.paths ?? {}).reduce((n: number, raw: any) => {
      const p = resolveRef(raw, original);
      return n + methods.filter((m) => p[m]).length;
    }, 0);
    if (doc.openapi?.startsWith('3.1')) throw new Error('OAS_3_1_VALIDATION_NOT_SUPPORTED_YET');
    const specPath = `/specs/${source.apiId}/${source.major}/openapi.json`;
    doc['x-telecom-sandbox-provenance'] = generatedSpecNotice(source);
    await save(`public${specPath}`, doc);
    for (const [path, rawItem] of Object.entries(doc.paths)) {
      const item = resolveRef(rawItem, doc);
      for (const method of methods) {
        if (!item[method]) continue;
        const op = item[method];
        callbacks += Object.keys(op.callbacks ?? {}).length;
        try {
          const status = Object.keys(op.responses ?? {})
            .filter((s) => /^2\d\d$/.test(s))
            .sort()[0];
          if (!status) throw new Error('NO_DECLARED_SUCCESS_STATUS');
          const response = resolveRef(op.responses[status], doc);
          const contents = Object.keys(response.content ?? {});
          const mediaType =
            contents.find((m) => m === 'application/json') ??
            contents.find((m) => m.endsWith('+json')) ??
            contents[0] ??
            null;
          const content = mediaType ? response.content[mediaType] : null;
          const schema = content?.schema;
          const noBody = status === '204' || status === '205' || method === 'head' || !mediaType;
          let value: any;
          let validation: 'VALIDATED' | 'NO_SCHEMA' = 'NO_SCHEMA';
          if (!noBody && schema) {
            const validate = validatorFor(schema, doc);
            const explicit =
              content.example ??
              Object.values(content.examples ?? {})
                .map((e: any) => resolveRef(e, doc).value)
                .find((v) => v !== undefined);
            const candidates: (() => any)[] = [
              () => explicit,
              () => sample(schema, doc),
              () => sample(schema, doc, true),
            ];
            let errors: any;
            for (const candidate of candidates) {
              try {
                const generated = candidate();
                if (generated !== undefined && validate(generated)) {
                  value = generated;
                  break;
                }
                errors = validate.errors;
              } catch (e) {
                errors = String(e);
              }
            }
            if (value === undefined)
              throw new Error(`FIXTURE_VALIDATION: ${JSON.stringify(errors).slice(0, 1800)}`);
            validation = 'VALIDATED';
          } else if (!noBody) value = mediaType?.includes('json') ? {} : 'Synthetic mock response';
          if (!noBody && !(mediaType?.includes('json') || mediaType?.startsWith('text/')))
            throw new Error(`UNSUPPORTED_MEDIA_FIXTURE: ${mediaType}`);
          const headers: Record<string, string> = {};
          for (const [name, raw] of Object.entries(response.headers ?? {})) {
            const header = resolveRef(raw, doc);
            if (header.schema) headers[name] = String(sample(header.schema, doc, true));
          }
          if (Array.isArray(value))
            for (const name of Object.keys(headers))
              if (['x-total-count', 'x-result-count'].includes(name.toLowerCase()))
                headers[name] = String(value.length);
          const opIndex = operations.length;
          const fixture = noBody
            ? null
            : `/fixtures/${source.apiId}/${source.major}/${opIndex}.json`;
          if (fixture) await save(`public${fixture}`, value);
          const parameters = [...(item.parameters ?? []), ...(op.parameters ?? [])].map((p) =>
            resolveRef(p, doc),
          );
          const uniqueParams = [
            ...new Map(parameters.map((p) => [`${p.in}/${p.name}`, p])).values(),
          ];
          const bases = serverPaths(op.servers ?? item.servers ?? doc.servers);
          for (const base of bases)
            operations.push({
              apiId: source.apiId,
              major: source.major,
              exactVersion: source.exactVersion,
              method: method.toUpperCase(),
              pathTemplate: `${base}${path}`.replace(/\/\//g, '/'),
              operationId: op.operationId ?? `${method}:${path}`,
              fixture,
              status: Number(status),
              mediaType: noBody ? null : mediaType,
              headers,
              parameters: uniqueParams.map((p) => ({
                name: p.name,
                in: p.in,
                required: p.required,
                schema: p.schema,
              })),
              schemaValidation: validation,
              contractSha256: source.sha256,
            });
        } catch (e) {
          failures.push({ method, path, reason: String(e) });
        }
      }
    }
    await save(`generated/operations/${source.apiId}/${source.major}.json`, operations);
    await save(`public/operations/${source.apiId}/${source.major}.json`, operations);
    manifest.push(...operations);
    reports.push({
      apiId: source.apiId,
      major: source.major,
      exactVersion: source.exactVersion,
      state: 'COMPILED',
      declaredOperations: declared,
      compiledOperations: new Set(
        operations.map(
          (o) => `${o.method}/${o.operationId}/${o.pathTemplate.replace(/^[\s\S]*?\/v\d+/, '')}`,
        ),
      ).size,
      routedVariants: operations.length,
      passedOperations: 0,
      unvalidatedOperations: operations
        .filter((o) => o.schemaValidation === 'NO_SCHEMA')
        .map((o) => ({ method: o.method, path: o.pathTemplate })),
      callbacks,
      webhooks: Object.keys(doc.webhooks ?? {}).length,
      failures,
    });
  } catch (e) {
    reports.push({
      apiId: source.apiId,
      major: source.major,
      state: 'BLOCKED',
      declaredOperations: declared || null,
      compiledOperations: 0,
      passedOperations: 0,
      failures: [{ reason: String(e) }],
    });
  }
  console.log(
    `${key(source)}: ${operations.length} routes, ${failures.length} operation exceptions`,
  );
}
// Canonicalize variable names so ambiguous templates fail instead of depending on order.
const routeKeys = new Map<string, Operation[]>();
const collisions = new Set<Operation>();
for (const operation of manifest) {
  const routeKey = `${operation.method} ${operation.pathTemplate.replace(/\{[^}]+\}/g, '{}')}`;
  const group = routeKeys.get(routeKey) ?? [];
  group.push(operation);
  routeKeys.set(routeKey, group);
}
for (const group of routeKeys.values()) {
  if (group.length < 2) continue;
  for (const operation of group) {
    collisions.add(operation);
    reports
      .find((r) => key(r) === key(operation))!
      .failures.push({
        method: operation.method,
        path: operation.pathTemplate,
        reason: `DUPLICATE_EFFECTIVE_ROUTE: ${group.map(key).join(', ')}`,
      });
  }
}
const routable = manifest
  .filter((o) => !collisions.has(o))
  .sort(
    (a, b) =>
      b.pathTemplate.split('/').filter((s) => !s.includes('{')).length -
        a.pathTemplate.split('/').filter((s) => !s.includes('{')).length ||
      a.pathTemplate.localeCompare(b.pathTemplate) ||
      a.method.localeCompare(b.method),
  );
for (const report of reports)
  report.routedVariants = routable.filter((o) => key(o) === key(report)).length;
for (const source of locks) {
  const ops = routable.filter((o) => key(o) === key(source));
  await save(`generated/operations/${source.apiId}/${source.major}.json`, ops);
  await save(`public/operations/${source.apiId}/${source.major}.json`, ops);
}
for (const report of reports)
  for (const failure of report.failures)
    exceptions.push({ apiId: report.apiId, major: report.major, ...failure });
await save('generated/manifest.json', routable);
await save(
  'generated/runtime.json',
  routable.map(({ parameters, ...op }) => ({
    ...op,
    parameters: parameters.map(({ name, in: location, required }) => ({
      name,
      in: location,
      required,
    })),
  })),
);
await save('public/manifest.json', routable);
await save('generated/reports/compilation.json', reports);
await save('generated/reports/exceptions.json', exceptions);
await save('public/catalog.json', {
  ...catalog,
  apis: catalog.apis.map((a: any) => ({
    ...a,
    versions: a.directory_major_versions.map(
      (major: string) =>
        reports.find((r) => r.apiId === a.api_id && r.major === major) ??
        gaps.find((g: any) => g.apiId === a.api_id && g.major === major),
    ),
  })),
});
await save('public/coverage.json', {
  catalogSnapshot: catalog.as_of,
  expectedApiCount: 104,
  expectedMajorPairs: pairs.length,
  sourceVerifiedPairs: locks.length,
  compiledPairs: reports.filter((r) => (r.routedVariants ?? 0) > 0).length,
  contractMockedPairs: 0,
  totalDeclaredOperations: reports.reduce((n, r) => n + (r.declaredOperations ?? 0), 0),
  passedOperations: 0,
  isComplete: false,
  blockedPairs: gaps,
  pairs: reports,
  note: 'Compilation completed; integration verification has not yet run.',
});
console.log(
  `Compiled ${routable.length} route variants; ${exceptions.length} explicit exceptions.`,
);
