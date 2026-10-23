import { execFileSync } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { key, mapLimit, pairs, save, sha256 } from './lib.js';

// Repository URLs come exclusively from the paginated organization API.
const org = 'https://api.github.com/orgs/tmforum-apis/repos?per_page=100';
const headers: Record<string, string> = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'telecom-api-sandbox-source-discovery',
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
await mkdir('.cache/repos', { recursive: true });
const repos: any[] = [];
for (let page = 1; ; page++) {
  const response = await fetch(`${org}&page=${page}`, { headers });
  if (!response.ok)
    throw new Error(
      `Repository enumeration: HTTP ${response.status}; use GITHUB_TOKEN if rate limited`,
    );
  const batch = (await response.json()) as any[];
  repos.push(...batch);
  if (batch.length < 100) break;
}
await save(
  'catalog/repositories.json',
  repos.map((r) => ({
    fullName: r.full_name,
    url: r.html_url,
    cloneUrl: r.clone_url,
    defaultBranch: r.default_branch,
  })),
);
const targets = new Set(pairs.map((p) => p.apiId));
const selected = repos.filter(
  (r) =>
    targets.has(r.name.match(/TMF\d{3}/i)?.[0]?.toUpperCase()) ||
    r.name === 'Open_Api_And_Data_Model',
);
const candidates: any[] = [];
const failures: any[] = [];
const outOfScope: any[] = [];
await mapLimit(selected, 4, async (repo) => {
  const local = resolve('.cache/repos', repo.name);
  const git = (args: string[]) =>
    execFileSync('git', ['-C', local, ...args], {
      maxBuffer: 32 * 1024 * 1024,
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  try {
    try {
      await access(`${local}/.git`);
    } catch {
      execFileSync(
        'git',
        [
          'clone',
          '--depth',
          '1',
          '--filter=blob:none',
          '--no-checkout',
          '--branch',
          repo.default_branch,
          repo.clone_url,
          local,
        ],
        { timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] },
      );
    }
    const commit = git(['rev-parse', 'HEAD']).toString().trim();
    const tree = git(['ls-tree', '-r', '--name-only', commit]).toString().trim().split('\n');
    await save(`.cache/trees/${repo.name}.json`, { repo: repo.full_name, commit, tree });
    const notices = tree.filter((p) => /(^|\/)(licen[cs]e|notice)(\.[^/]*)?$/i.test(p));
    const rootLicense = notices.find((p) => /^licen[cs]e(\.[^/]*)?$/i.test(p));
    const licenseText = rootLicense ? git(['show', `${commit}:${rootLicense}`]).toString() : '';
    const license = /Apache License[\s\S]*Version 2\.0[\s\S]*TERMS AND CONDITIONS/i.test(
      licenseText,
    )
      ? 'Apache-2.0'
      : null;
    const sourceFiles = tree.filter(
      (p) =>
        ((/\.(json|ya?ml)$/i.test(p) && /swagger|openapi|\.oas\.|TMF\d{3}/i.test(p)) ||
          (!p.includes('/') &&
            !/\.(md|txt|pdf|zip|png|svg|html|js|py|sh)$/i.test(p) &&
            !/^(LICENSE|NOTICE|README)(\.|$)/i.test(p))) &&
        !/postman|ctk|node_modules|package(-lock)?\.json/i.test(p),
    );
    for (const path of sourceFiles) {
      try {
        const bytes = git(['show', `${commit}:${path}`]);
        if (bytes.length > 25 * 1024 * 1024) continue;
        const doc = YAML.parse(bytes.toString(), { maxAliasCount: 100 });
        if (
          !(doc?.swagger === '2.0' || /^3\.[01]\./.test(doc?.openapi)) ||
          !doc.paths ||
          !doc.info?.version
        )
          continue;
        const identifiers = [
          ...new Set(
            `${path} ${doc.info.title} ${doc.info.description ?? ''}`
              .match(/TMF\d{3}/gi)
              ?.map((s) => s.toUpperCase()),
          ),
        ];
        const fileId = path.match(/TMF\d{3}/i)?.[0]?.toUpperCase();
        const repoId = repo.name.match(/TMF\d{3}/i)?.[0]?.toUpperCase();
        const apiId = fileId ?? repoId;
        if (!apiId || !targets.has(apiId)) continue;
        const version = String(doc.info.version);
        const major = `v${version.match(/^(?:v)?(\d+)/i)?.[1]}`;
        if (!pairs.some((p) => p.apiId === apiId && p.major === major)) {
          outOfScope.push({ apiId, major, exactVersion: version, repo: repo.full_name, path });
          continue;
        }
        const cachePath = `.cache/specs/${repo.name}/${path}`;
        await mkdir(resolve(cachePath, '..'), { recursive: true });
        await writeFile(cachePath, bytes);
        const licenseAssets = [];
        for (const notice of notices.filter(
          (p) => !p.includes('/') || path.startsWith(p.slice(0, p.lastIndexOf('/') + 1)),
        )) {
          const data = git(['show', `${commit}:${notice}`]);
          const cached = `.cache/notices/${repo.name}/${notice}`;
          await mkdir(resolve(cached, '..'), { recursive: true });
          await writeFile(cached, data);
          licenseAssets.push({ path: notice, cached, sha256: sha256(data) });
        }
        candidates.push({
          apiId,
          major,
          exactVersion: version,
          title: doc.info.title,
          dialect: doc.swagger ? 'swagger-2.0' : `oas-${doc.openapi}`,
          repo: repo.full_name,
          sourceUrl: repo.html_url,
          upstreamCommit: commit,
          upstreamFile: path,
          cachePath,
          sha256: sha256(bytes),
          license,
          licenseAssets,
          identifiers,
          maturity: /rc|preview|beta|alpha/i.test(`${version} ${path}`) ? 'PREVIEW' : 'UNSPECIFIED',
          variantReview:
            /admin|regular|component|suite/i.test(path) ||
            ['TMF759', 'TMF931', 'TMF936', 'TMF937'].includes(apiId),
        });
      } catch (e) {
        failures.push({ repo: repo.full_name, path, reason: String(e).slice(0, 250) });
      }
    }
    console.log(`${repo.name}: inspected ${tree.length} tree entries`);
  } catch (e) {
    failures.push({ repo: repo.full_name, reason: String(e).slice(0, 500) });
    console.error(`${repo.name}: discovery failed`);
  }
});
candidates.sort(
  (a, b) => key(a).localeCompare(key(b)) || a.upstreamFile.localeCompare(b.upstreamFile),
);
await save('catalog/source-candidates.json', {
  scannedAt: new Date().toISOString(),
  repositories: selected.length,
  candidates,
  failures,
  outOfScope,
});
await save(
  'catalog/source-gaps.json',
  pairs
    .filter((p) => !candidates.some((c) => key(c) === key(p)))
    .map((p) => ({
      apiId: p.apiId,
      major: p.major,
      state: 'BLOCKED',
      reason: 'NO_VERIFIED_MIRROR_CANDIDATE',
      detail:
        'No matching contract found in discovered repository trees. Official version-page review required; the catalog is not source evidence.',
    })),
);
console.log(
  `Found ${candidates.length} candidates for ${new Set(candidates.map(key)).size}/${pairs.length} pairs; ${failures.length} scan exceptions.`,
);
