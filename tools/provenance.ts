import type { SourceLock } from './models.js';

export function generatedSpecNotice(source: SourceLock) {
  return {
    notice:
      'Generated and modified by Telecom API Sandbox: references bundled and Swagger 2 converted to OpenAPI 3 where applicable. Missing server contexts may be supplied by an explicitly reviewed x-telecom-sandbox-context-path override. Original upstream bytes are retained unchanged.',
    license: source.license,
    sourceUrl: `${source.sourceUrl}/blob/${source.upstreamCommit}/${source.upstreamFile.split('/').map(encodeURIComponent).join('/')}`,
    upstreamCommit: source.upstreamCommit,
    sourceSha256: source.sha256,
    exactVersion: source.exactVersion,
    licenseUrls: source.notices.map(
      (notice) =>
        `/licenses/${source.apiId}/${source.major}/${notice.upstreamFile.split('/').at(-1)}`,
    ),
  };
}
