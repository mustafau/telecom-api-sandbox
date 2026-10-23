import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { json, mapLimit, save } from './lib.js';
import type { Catalog, Pair, SourceLock } from './models.js';
import {
  checkOfficialPage,
  compareUpstream,
  type Head,
  type OfficialPage,
  renderUpstreamReport,
  type Snapshot,
} from './upstream-report.js';

const root = process.cwd();
const output = resolve('.cache/upstream-check');
await mkdir(output, { recursive: true });
// Remove old reports so failed enumeration cannot look like a successful old scan.
await rm(join(output, 'report.json'), { force: true });
await rm(join(output, 'report.md'), { force: true });
const scratch = await mkdtemp(join(tmpdir(), 'telecom-upstream-'));
try {
  await mkdir(join(scratch, 'catalog'));
  const inventory = await json<Catalog>('catalog/catalog.json');
  await save(join(scratch, 'catalog/catalog.json'), inventory);
  // The scanner only writes inside its fresh working directory. It cannot reuse
  // the normal discovery caches or mutate reviewed catalog/upstream files.
  await new Promise<void>((done, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), resolve('tools/discover.ts')],
      { cwd: scratch, stdio: 'inherit' },
    );
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? done() : reject(new Error(`Fresh discovery failed (exit ${code})`)),
    );
  });
  const current = await json<Snapshot>(join(scratch, 'catalog/source-candidates.json'));
  const heads: Head[] = [];
  for (const file of (await readdir(join(scratch, '.cache/trees'))).sort()) {
    const { repo, commit } = await json<Head>(join(scratch, '.cache/trees', file));
    heads.push({ repo, commit });
  }
  const report = {
    checkedAt: new Date().toISOString(),
    ...compareUpstream({
      previous: await json<Snapshot>('catalog/source-candidates.json'),
      current,
      heads,
      locks: await json<SourceLock[]>('catalog/spec-lock.json'),
      gaps: await json<Pair[]>('catalog/source-gaps.json'),
      previousRepositories: (await json<{ fullName: string }[]>('catalog/repositories.json')).map(
        (repo) => repo.fullName,
      ),
      currentRepositories: (
        await json<{ fullName: string }[]>(join(scratch, 'catalog/repositories.json'))
      ).map((repo) => repo.fullName),
    }),
    officialPages: await mapLimit(
      await json<OfficialPage[]>('catalog/official-source-review.json'),
      2,
      (page) => checkOfficialPage(page),
    ),
    scopeAuthority: {
      url: 'https://www.tmforum.org/open-digital-architecture/open-apis',
      catalogSnapshot: inventory.as_of,
      apiCount: inventory.api_count,
      majorVersionPairs: inventory.major_version_pair_count,
      result:
        'Compare the live official directory with the committed inventory before accepting scope changes. Mirror observations are leads, not scope authority. Inaccessible pages leave scope changes unverified.',
    },
  };
  await save(join(output, 'report.json'), report);
  await writeFile(join(output, 'report.md'), renderUpstreamReport(report));
  console.log(
    `Upstream check: ${report.status}; ${report.repositoryChanges.length} changed heads, ${report.candidateChanges.length} new/changed candidates. Reports: .cache/upstream-check/`,
  );
  if (report.status === 'INCOMPLETE') process.exitCode = 1;
} catch (error) {
  const report = {
    checkedAt: new Date().toISOString(),
    status: 'INCOMPLETE',
    error: error instanceof Error ? error.message : 'Unexpected scan failure',
  };
  await save(join(output, 'report.json'), report);
  await writeFile(
    join(output, 'report.md'),
    '# Upstream source check\n\n**INCOMPLETE** — Discovery did not finish. Inspect the workflow log and retry; no conclusion about unchanged upstream sources can be drawn.\n',
  );
  console.error(report.error);
  process.exitCode = 1;
} finally {
  process.chdir(root);
  await rm(scratch, { recursive: true, force: true });
}
