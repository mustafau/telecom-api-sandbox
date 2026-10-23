import { mkdir, readFile, rmdir, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { json, key, pairs, save, sha256 } from './lib.js';

const { candidates, outOfScope = [] } = await json('catalog/source-candidates.json');
const selections = await json('catalog/source-selections.json').catch(() => []);
const official = await json('catalog/official-source-review.json').catch(() => []);
const locks: any[] = [],
  gaps: any[] = [],
  review: any[] = [];
const rank = (s: string) => s.replace(/^v/i, '').split(/[.-]/).slice(0, 3).map(Number);
for (const pair of pairs) {
  const selection = selections.find((s: any) => key(s) === key(pair));
  let options = candidates.filter(
    (c: any) => key(c) === key(pair) && c.license === 'Apache-2.0' && !c.variantReview,
  );
  if (selection)
    options = candidates.filter(
      (c: any) =>
        key(c) === key(pair) && c.sha256 === selection.sha256 && c.license === 'Apache-2.0',
    );
  options.sort((a: any, b: any) => {
    const aa = rank(a.exactVersion),
      bb = rank(b.exactVersion);
    return (
      (a.maturity === 'PREVIEW' ? 1 : 0) - (b.maturity === 'PREVIEW' ? 1 : 0) ||
      bb[0] - aa[0] ||
      bb[1] - aa[1] ||
      bb[2] - aa[2] ||
      a.upstreamFile.localeCompare(b.upstreamFile)
    );
  });
  const best = options[0];
  const same = best && options.filter((o: any) => o.exactVersion === best.exactVersion);
  const ambiguous = !selection && same && new Set(same.map((o: any) => o.sha256)).size > 1;
  if (!best || ambiguous) {
    const all = candidates.filter((c: any) => key(c) === key(pair));
    const other = outOfScope.filter((c: any) => c.apiId === pair.apiId);
    gaps.push({
      apiId: pair.apiId,
      major: pair.major,
      state: 'BLOCKED',
      reason: ambiguous
        ? 'AMBIGUOUS_SAME_VERSION'
        : all.length
          ? 'LICENSE_OR_VARIANT_REVIEW_REQUIRED'
          : 'SOURCE_NOT_FOUND',
      detail: all.length
        ? all.map((c: any) => `${c.repo}:${c.upstreamFile}`).join('; ')
        : 'No matching contract in enumerated public mirror trees; official directory fallback required.',
      otherUpstreamVersions: other,
    });
    review.push({
      ...pair,
      candidates: all.map((c: any) => ({
        repo: c.repo,
        file: c.upstreamFile,
        version: c.exactVersion,
        license: c.license,
      })),
    });
    continue;
  }
  const directory = `upstream/${pair.apiId}/${pair.major}`;
  await mkdir(directory, { recursive: true });
  const bytes = await readFile(best.cachePath);
  if (sha256(bytes) !== best.sha256) throw new Error(`Candidate changed: ${key(pair)}`);
  const localFile = `${directory}/${basename(best.upstreamFile)}`;
  await writeFile(localFile, bytes);
  const notices = [];
  for (const n of best.licenseAssets) {
    const notice = await readFile(n.cached);
    if (sha256(notice) !== n.sha256) throw new Error('Notice hash mismatch');
    const local = `${directory}/notices/${n.path}`;
    await rmdir(local).catch(() => {}); // Repair an empty directory left by an interrupted early lock.
    await mkdir(dirname(local), { recursive: true });
    await writeFile(local, notice);
    notices.push({ upstreamFile: n.path, localFile: local, sha256: n.sha256 });
  }
  const { cachePath, licenseAssets, variantReview, ...metadata } = best;
  locks.push({
    ...metadata,
    localFile,
    notices,
    retrievedAt: new Date().toISOString(),
    state: 'DISCOVERED',
    review:
      selection?.rationale ??
      'Deterministic policy: verified Apache text, parsed API identity and info.version, newest non-prerelease version, no conflicting bytes or special variants; directory maturity remains unverified.',
  });
}
await save('catalog/spec-lock.json', locks);
for (const gap of gaps) {
  const evidence =
    official.find((r: any) => r.apiId === gap.apiId && r.major === gap.major) ??
    official.find((r: any) => !r.apiId);
  if (evidence)
    gap.officialFallback = {
      url: evidence.url,
      result: evidence.result,
      sourceLinks: evidence.sourceLinks,
    };
}
await save('catalog/source-gaps.json', gaps);
await save('catalog/source-review.json', review);
console.log(
  `Locked ${locks.length}/${pairs.length} verified contracts; ${gaps.length} blocked pairs.`,
);
