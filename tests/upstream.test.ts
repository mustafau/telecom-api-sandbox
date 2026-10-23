import assert from 'node:assert/strict';
import test from 'node:test';
import type { SourceLock } from '../tools/models.js';
import { type Candidate, checkOfficialPage, compareUpstream } from '../tools/upstream-report.js';

const candidate: Candidate = {
  apiId: 'TMF629',
  major: 'v5',
  repo: 'tmforum-apis/TMF629_CustomerManagement',
  upstreamCommit: 'a'.repeat(40),
  upstreamFile: 'customer.yaml',
  sha256: 'b'.repeat(64),
  exactVersion: '5.0.0',
  license: 'Apache-2.0',
  licenseAssets: [{ path: 'LICENSE', sha256: 'c'.repeat(64) }],
};
const lock: SourceLock = {
  ...candidate,
  license: 'Apache-2.0',
  sourceUrl: `https://github.com/${candidate.repo}`,
  localFile: 'unused',
  maturity: 'UNSPECIFIED',
  review: 'fixture',
  notices: [{ upstreamFile: 'LICENSE', localFile: 'unused', sha256: 'c'.repeat(64) }],
};
const input = {
  previous: { candidates: [candidate], failures: [] },
  current: { candidates: [candidate], failures: [] },
  locks: [lock],
  gaps: [{ apiId: 'TMF777', major: 'v5' }],
  heads: [{ repo: candidate.repo, commit: candidate.upstreamCommit }],
  previousRepositories: [candidate.repo],
  currentRepositories: [candidate.repo],
};

test('fresh heads, same-version content, license changes, and blocked-pair candidates are separate findings', () => {
  const next = structuredClone(input);
  next.heads[0].commit = 'd'.repeat(40);
  next.current.candidates = [
    {
      ...candidate,
      upstreamCommit: next.heads[0].commit,
      sha256: 'e'.repeat(64),
      licenseAssets: [{ path: 'LICENSE', sha256: 'f'.repeat(64) }],
    },
    { ...candidate, apiId: 'TMF777', upstreamFile: 'outage.yaml', license: null },
  ];
  next.currentRepositories.push('tmforum-apis/new-repository');
  const report = compareUpstream(next);
  assert.equal(report.status, 'COMPLETE');
  assert.equal(report.repositoryChanges.length, 1);
  assert.equal(report.newRepositories.length, 1);
  assert.equal(report.gapCandidates.length, 1);
  assert.equal(report.gapCandidates[0].license, null);
  assert.equal(report.gapCandidates[0].acceptance, 'REQUIRES_SOURCE_LICENSE_AND_CONTRACT_REVIEW');
  assert.deepEqual(report.lockedFileChanges[0].reasons, [
    'PINNED_CONTENT_CHANGED',
    'LICENSE_OR_NOTICE_CHANGED',
  ]);
  assert.equal(input.locks[0].sha256, 'b'.repeat(64));
  const unchanged = compareUpstream(input);
  assert.equal(
    unchanged.repositoryChanges.length +
      unchanged.candidateChanges.length +
      unchanged.lockedFileChanges.length,
    0,
  );
});

test('repository failure is incomplete and cannot be reported as pinned file removal', () => {
  const report = compareUpstream({
    ...input,
    heads: [],
    current: { candidates: [], failures: [{ repo: candidate.repo, reason: 'fetch failed' }] },
  });
  assert.equal(report.status, 'INCOMPLETE');
  assert.equal(report.lockedFileChanges.length, 0);
  assert.deepEqual(report.missingRepositories, [candidate.repo]);
  const warnings = compareUpstream({
    ...input,
    current: {
      ...input.current,
      failures: [{ repo: candidate.repo, path: 'bad.yaml', reason: 'parse error' }],
    },
  });
  assert.equal(warnings.status, 'COMPLETE_WITH_PARSE_WARNINGS');
});

test('previously unlicensed gap candidates stay visible even without new bytes', () => {
  const report = compareUpstream({ ...input, gaps: [candidate] });
  assert.equal(report.gapCandidates.length, 1);
  assert.equal(report.gapCandidates[0].changedSinceSnapshot, false);
});
test('new out-of-scope mirror versions are review leads and do not become supported candidates', () => {
  const report = compareUpstream({
    ...input,
    current: {
      ...input.current,
      outOfScope: [
        {
          apiId: 'TMF629',
          major: 'v6',
          exactVersion: '6.0.0',
          repo: candidate.repo,
          path: 'new.yaml',
        },
      ],
    },
  });
  assert.equal(report.newOutOfScopeCandidates.length, 1);
  assert.equal(report.candidateChanges.length, 0);
  assert.equal(report.gapCandidates.length, 0);
});

test('official source access and new download leads are observed without bypass or artifact acceptance', async () => {
  const previous = {
    url: 'https://www.tmforum.org/open-digital-architecture/open-apis',
    status: 403,
    sourceLinks: [],
  };
  const accessible = await checkOfficialPage(previous, (async (_url, options) => {
    assert.equal(options?.redirect, 'error');
    return new Response(
      '<a href="/downloads/new.oas.yaml">spec</a><a href="javascript:openapi">bad</a>',
    );
  }) as typeof fetch);
  assert.equal(accessible.newlyAccessible, true);
  assert.deepEqual(accessible.newLinks, ['https://www.tmforum.org/downloads/new.oas.yaml']);
  const blocked = await checkOfficialPage(
    previous,
    (async () => new Response('', { status: 403 })) as typeof fetch,
  );
  assert.equal(blocked.newlyAccessible, false);
  assert.equal(blocked.result, 'HTTP_403; ACCESS_RESTRICTIONS_RESPECTED');
});
