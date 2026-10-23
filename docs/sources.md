# Sources and licenses

The [catalog](../catalog/catalog.json) is the target inventory. The [lock](../catalog/spec-lock.json) is evidence of obtained contracts. Each locked source records its actual `info.version`, upstream commit, file path, SHA256, license texts, and review rationale.

## Scope authority

Use the [official TM Forum Open API directory](https://www.tmforum.org/open-digital-architecture/open-apis) to review future API/major scope changes. The committed inventory is a dated snapshot, not a claim that the live directory can never change. Compare the live listings with the snapshot before accepting additions/removals, and update inventory tests, source/gap accounting, baseline policy, and published counts in the same reviewed change. Mirror discoveries outside the inventory are review leads only. If directory access fails, record that current scope could not be verified. Never acquire an out-of-scope contract solely as context-path evidence.

## Discovery and locking

```sh
npm run catalog:check
npm run sources:discover
npm run sources:review
npm run sources:lock
npm run sources:fallback
npm run sources:audit
```

Discovery paginates the actual `tmforum-apis` organization, inspects repository trees, and parses candidate files, including legacy files without conventional extensions. It never invents repository names or treats a filename as a verified version. `GITHUB_TOKEN` is optional for GitHub API limits and belongs only in your environment.

The local `.cache/` contains shallow repository checkouts and candidate blobs. Existing checkouts retain their pinned HEAD. For a deliberate refresh, remove the specific cached checkout, rerun discovery, and review the resulting candidate and source diffs. Updates are never automatically deployed.

Some mirrors contain distinct files with the same version string. Selection records explain which edition was pinned. The comparison tool ignores presentation annotations while preserving schema property names, literal values, routes, parameters, and validation constraints. It does not merge conflicting editions.

## Gaps and maturity

Every target pair is either locked or explicitly blocked with a reason. The official directory fallback records public links and access failures without bypassing restrictions. A different older major is not a substitute for the requested major.

`UNSPECIFIED` maturity means the official release maturity has not been established. Preview status must be reported when verified; numeric version strings alone do not prove a stable release.

## Monitoring upstream

Run `npm run sources:check` to scan current default-branch HEADs using fresh temporary checkouts. Git and network access are required; `GITHUB_TOKEN` is optional locally for API limits. Reports appear in `.cache/upstream-check/report.json` and `report.md`. The scratch checkout is removed after the scan. Reviewed catalog records, locks, baselines, and original source files are never updated by this command.

The [upstream workflow](../.github/workflows/upstream-check.yml) runs Mondays at 07:23 UTC and can be run manually from Actions. It uploads the reports for 30 days and adds a job summary. It uses a read-only GitHub token, creates no issues or pull requests, and performs no deployment. Scheduled runs start after the workflow is pushed to the default branch. GitHub can delay scheduled runs or disable them after repository inactivity; monitor Actions and use manual runs when necessary. See [GitHub's schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

The report compares with committed discovery evidence and locks, so unreviewed findings repeat across runs. It shows:

- New organization repositories, changed observed HEADs, and commit comparison links. Different commits can indicate divergence or force-pushes as well as new work.
- New/changed parsed spec candidates, including candidates for currently blocked pairs and license/notice changes. Existing unlicensed candidates remain visible and unaccepted.
- Newly observed mirror majors outside the inventory, flagged for scope review against the official directory. New organization repositories can also signal new APIs that need directory review.
- Changed or absent pinned contract candidates.
- Accessibility and download-link changes on the recorded official directory/version pages. Links are leads, not verified specifications; pages that remain restricted are unresolved.

`INCOMPLETE` returns a nonzero exit status when repository enumeration or repository scans fail, or a pinned repository has no observed HEAD. Parse warnings are reported separately; they can prevent detecting a particular candidate. The scanner uses the existing repository/file discovery heuristics, so a clean scan is not proof that no specification exists elsewhere. It checks the fixed target inventory; expanding that inventory is a separate review. Use the normal discovery, source review, locking, baseline, and verification workflow to accept findings. See [ADR 0005](adr/0005-reproducible-builds-and-release-evidence.md).

## Context-path evidence

[Context overrides](../catalog/context-path-overrides.json) fill missing v5 server contexts using verified in-scope v4 evidence or explicitly identified project conventions. TMF638 uses the project convention `/tmf-api/serviceInventory/v5`, like other APIs without an in-scope v4 context; its out-of-scope v4 source is not retained. Generated specs expose the effective server and its derivation. Source hash changes or a newly supplied upstream context require override review. See [ADR 0004](adr/0004-routing-and-context-paths.md).

## Redistribution

Project code uses MIT. Upstream files and their derivatives retain the applicable third-party license. Preserve each original LICENSE/NOTICE beside the source. The audit verifies their hashes along with the specification bytes.

Converted specification files carry an `x-telecom-sandbox-provenance` notice that identifies the modifications, original source URL, commit, hash, exact version, license, and license asset links. The build publishes the original license texts and third-party attribution with the web assets. Original upstream files remain unchanged.

Respect the [Apache 2.0 redistribution conditions](https://www.apache.org/licenses/LICENSE-2.0), each artifact's actual license, and source access restrictions. Do not use the TM Forum marks or logos as this project's branding or imply endorsement or certification.
