import type { Pair, SourceLock } from './models.js';

export type Candidate = Pair & {
  repo: string;
  upstreamCommit: string;
  upstreamFile: string;
  sha256: string;
  exactVersion: string;
  license: string | null;
  licenseAssets: { path: string; sha256: string }[];
};
export type ScanFailure = { repo: string; path?: string; reason: string };
export type Snapshot = {
  candidates: Candidate[];
  failures: ScanFailure[];
  outOfScope?: (Pair & { repo: string; path: string; exactVersion: string })[];
};
export type Head = { repo: string; commit: string };
export type OfficialPage = {
  url: string;
  status: number | null;
  sourceLinks: string[];
};
const pairKey = (pair: Pair) => `${pair.apiId}/${pair.major}`;
const fileKey = (candidate: Candidate) =>
  `${pairKey(candidate)}/${candidate.repo}/${candidate.upstreamFile}`;
const notices = (assets: { path: string; sha256: string }[]) =>
  JSON.stringify(assets.map((asset) => `${asset.path}:${asset.sha256}`).sort());
const observation = (candidate: Candidate) => ({
  apiId: candidate.apiId,
  major: candidate.major,
  repo: candidate.repo,
  upstreamFile: candidate.upstreamFile,
  upstreamCommit: candidate.upstreamCommit,
  exactVersion: candidate.exactVersion,
  sha256: candidate.sha256,
  license: candidate.license,
  sourceUrl: `https://github.com/${candidate.repo}/blob/${candidate.upstreamCommit}/${candidate.upstreamFile.split('/').map(encodeURIComponent).join('/')}`,
});

export function compareUpstream(input: {
  previous: Snapshot;
  current: Snapshot;
  heads: Head[];
  locks: SourceLock[];
  gaps: Pair[];
  previousRepositories: string[];
  currentRepositories: string[];
}) {
  const previousFiles = new Map(input.previous.candidates.map((c) => [fileKey(c), c]));
  const gapKeys = new Set(input.gaps.map(pairKey));
  const scopeKey = (candidate: Pair & { repo: string; path: string; exactVersion: string }) =>
    `${pairKey(candidate)}/${candidate.repo}/${candidate.path}/${candidate.exactVersion}`;
  const previousOutsideScope = new Set((input.previous.outOfScope ?? []).map(scopeKey));
  const changes = input.current.candidates.flatMap((candidate) => {
    const prior = previousFiles.get(fileKey(candidate));
    const reasons = [];
    if (!prior) reasons.push('NEW_CANDIDATE');
    else {
      if (prior.sha256 !== candidate.sha256) reasons.push('CONTENT_CHANGED');
      if (
        prior.license !== candidate.license ||
        notices(prior.licenseAssets) !== notices(candidate.licenseAssets)
      )
        reasons.push('LICENSE_OR_NOTICE_CHANGED');
    }
    return reasons.length ? [{ ...observation(candidate), reasons }] : [];
  });
  const knownCommits = new Map<string, Set<string>>();
  for (const source of [...input.previous.candidates, ...input.locks]) {
    const commits = knownCommits.get(source.repo) ?? new Set<string>();
    commits.add(source.upstreamCommit);
    knownCommits.set(source.repo, commits);
  }
  const repositoryChanges = input.heads.flatMap((head) => {
    const previous = [...(knownCommits.get(head.repo) ?? [])].sort();
    return previous.length && previous.some((commit) => commit !== head.commit)
      ? [
          {
            ...head,
            previousCommits: previous,
            comparisons: previous
              .filter((commit) => commit !== head.commit)
              .map(
                (commit) => `https://github.com/${head.repo}/compare/${commit}...${head.commit}`,
              ),
          },
        ]
      : [];
  });
  const lockedFileChanges = input.locks.flatMap((lock) => {
    // A failed repository scan cannot establish that its files were removed.
    if (
      !input.heads.some((head) => head.repo === lock.repo) ||
      input.current.failures.some((failure) => failure.repo === lock.repo && !failure.path)
    )
      return [];
    const candidate = input.current.candidates.find(
      (c) =>
        c.repo === lock.repo &&
        c.upstreamFile === lock.upstreamFile &&
        pairKey(c) === pairKey(lock),
    );
    const reasons = [];
    if (!candidate) reasons.push('PINNED_FILE_ABSENT_OR_NO_LONGER_A_CANDIDATE');
    else {
      if (candidate.sha256 !== lock.sha256) reasons.push('PINNED_CONTENT_CHANGED');
      if (
        candidate.license !== lock.license ||
        notices(candidate.licenseAssets) !==
          notices(
            lock.notices.map((notice) => ({ path: notice.upstreamFile, sha256: notice.sha256 })),
          )
      )
        reasons.push('LICENSE_OR_NOTICE_CHANGED');
    }
    return reasons.length
      ? [
          {
            apiId: lock.apiId,
            major: lock.major,
            repo: lock.repo,
            upstreamFile: lock.upstreamFile,
            pinnedCommit: lock.upstreamCommit,
            reasons,
            current: candidate ? observation(candidate) : null,
          },
        ]
      : [];
  });
  const missingRepositories = [...new Set(input.locks.map((lock) => lock.repo))].filter(
    (repo) => !input.heads.some((head) => head.repo === repo),
  );
  return {
    status:
      missingRepositories.length || input.current.failures.some((failure) => !failure.path)
        ? 'INCOMPLETE'
        : input.current.failures.length
          ? 'COMPLETE_WITH_PARSE_WARNINGS'
          : 'COMPLETE',
    newRepositories: input.currentRepositories
      .filter((repo) => !input.previousRepositories.includes(repo))
      .sort(),
    repositoryChanges,
    newOutOfScopeCandidates: (input.current.outOfScope ?? []).filter(
      (candidate) => !previousOutsideScope.has(scopeKey(candidate)),
    ),
    candidateChanges: changes,
    gapCandidates: input.current.candidates
      .filter((candidate) => gapKeys.has(pairKey(candidate)))
      .map((candidate) => ({
        ...observation(candidate),
        changedSinceSnapshot: changes.some(
          (change) =>
            change.repo === candidate.repo &&
            change.upstreamFile === candidate.upstreamFile &&
            pairKey(change) === pairKey(candidate),
        ),
        acceptance: 'REQUIRES_SOURCE_LICENSE_AND_CONTRACT_REVIEW',
      })),
    lockedFileChanges,
    missingRepositories,
    scanFailures: input.current.failures,
    observedHeads: input.heads,
  };
}

export async function checkOfficialPage(previous: OfficialPage, fetcher: typeof fetch = fetch) {
  try {
    const url = new URL(previous.url);
    if (url.protocol !== 'https:' || !['www.tmforum.org', 'tmforum.org'].includes(url.hostname))
      throw new Error('Unapproved source-page host');
    const response = await fetcher(url, { signal: AbortSignal.timeout(20_000), redirect: 'error' });
    const body = response.ok ? await response.text() : '';
    const sourceLinks = [
      ...new Set(
        [...body.matchAll(/href=["']([^"']+)["']/gi)].flatMap((match) => {
          try {
            const link = new URL(match[1].replaceAll('&amp;', '&'), url);
            return link.protocol === 'https:' &&
              /\.(json|ya?ml|zip)(?:\?|$)|swagger|download|openapi/i.test(link.href)
              ? [link.href]
              : [];
          } catch {
            return [];
          }
        }),
      ),
    ].sort();
    return {
      url: url.href,
      status: response.status,
      previousStatus: previous.status,
      newlyAccessible:
        response.ok && !(previous.status && previous.status >= 200 && previous.status < 300),
      sourceLinks,
      newLinks: sourceLinks.filter((link) => !previous.sourceLinks.includes(link)),
      result: response.ok
        ? 'LINKS_REQUIRE_ARTIFACT_AND_LICENSE_REVIEW'
        : `HTTP_${response.status}; ACCESS_RESTRICTIONS_RESPECTED`,
    };
  } catch {
    return {
      url: previous.url,
      status: null,
      previousStatus: previous.status,
      newlyAccessible: false,
      sourceLinks: [],
      newLinks: [],
      result: 'REQUEST_FAILED_OR_REDIRECT_BLOCKED; MANUAL_REVIEW_REQUIRED',
    };
  }
}

// Escape upstream-controlled strings before inserting them into Actions Markdown.
const md = (value: unknown) =>
  String(value)
    .replaceAll(/[\r\n]/g, ' ')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '\\|')
    .replaceAll('`', "'");
export function renderUpstreamReport(
  report: ReturnType<typeof compareUpstream> & {
    checkedAt: string;
    officialPages: Awaited<ReturnType<typeof checkOfficialPage>>[];
    scopeAuthority?: {
      url: string;
      catalogSnapshot: string;
      apiCount: number;
      majorVersionPairs: number;
      result: string;
    };
  },
) {
  const sections: string[] = [
    '# Upstream source check',
    '',
    `Checked: ${report.checkedAt}`,
    `GitHub scan: **${report.status}**`,
    '',
    'Observations are compared with committed discovery evidence and source locks. Candidates are not accepted contracts. A different HEAD does not prove a new release or a descendant commit.',
    '',
    `New repositories: ${report.newRepositories.length}; changed repository heads: ${report.repositoryChanges.length}; changed/new candidates: ${report.candidateChanges.length}; candidates for blocked pairs: ${report.gapCandidates.length}; pinned file/license changes: ${report.lockedFileChanges.length}.`,
    '',
  ];
  const section = (title: string, rows: string[]) =>
    sections.push(`## ${title}`, '', ...(rows.length ? rows : ['None observed.']), '');
  section('Repository changes', [
    ...report.newRepositories.map((repo) => `- New: ${md(repo)}`),
    ...report.repositoryChanges.map(
      (head) =>
        `- ${md(head.repo)}: ${head.previousCommits.map(md).join(', ')} → ${md(head.commit)}. ${head.comparisons.join(' ')}`,
    ),
  ]);
  section('Scope review', [
    ...(report.scopeAuthority
      ? [
          `- Authority: ${md(report.scopeAuthority.url)}. Committed snapshot ${md(report.scopeAuthority.catalogSnapshot)}: ${report.scopeAuthority.apiCount} APIs / ${report.scopeAuthority.majorVersionPairs} major-version pairs. ${md(report.scopeAuthority.result)}`,
        ]
      : []),
    ...report.newOutOfScopeCandidates.map(
      (candidate) =>
        `- New out-of-scope mirror lead: ${md(pairKey(candidate))} ${md(candidate.exactVersion)} — ${md(candidate.repo)} / ${md(candidate.path)}. Check the official directory before changing scope.`,
    ),
  ]);
  section(
    'Candidates for blocked pairs',
    report.gapCandidates.map(
      (candidate) =>
        `- ${md(pairKey(candidate))} ${md(candidate.exactVersion)}: ${md(candidate.repo)} / ${md(candidate.upstreamFile)}; license ${md(candidate.license ?? 'UNVERIFIED')}; changed since snapshot: ${candidate.changedSinceSnapshot}. Requires review.`,
    ),
  );
  section(
    'New or changed candidates',
    report.candidateChanges.map(
      (candidate) =>
        `- ${md(pairKey(candidate))}: ${md(candidate.repo)} / ${md(candidate.upstreamFile)} — ${candidate.reasons.join(', ')}`,
    ),
  );
  section(
    'Pinned source changes',
    report.lockedFileChanges.map(
      (change) =>
        `- ${md(pairKey(change))}: ${md(change.repo)} / ${md(change.upstreamFile)} — ${change.reasons.join(', ')}`,
    ),
  );
  section(
    'Official source pages',
    report.officialPages.map(
      (page) =>
        `- ${md(page.url)}: ${md(page.result)}; newly accessible: ${page.newlyAccessible}; new download leads: ${page.newLinks.length}.`,
    ),
  );
  section('Scan exceptions', [
    ...report.missingRepositories.map(
      (repo) => `- No observed HEAD for pinned repository: ${md(repo)}`,
    ),
    ...report.scanFailures.map(
      (failure) => `- ${md(failure.repo)} ${md(failure.path ?? '')}: ${md(failure.reason)}`,
    ),
  ]);
  sections.push(
    'Inspect the JSON artifact for source hashes, immutable links, observed heads, and official download leads. Inaccessible pages and parse failures limit what this scan establishes. Follow docs/sources.md before changing locks or baselines.',
    '',
  );
  return sections.join('\n');
}
