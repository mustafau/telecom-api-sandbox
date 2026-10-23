# 0005: Verify reproducible builds and review upstream updates

- Date: 2026-10-22
- Status: Accepted

## Context

A public repository needs repeatable builds and evidence tied to the actual inputs. Generated outputs can otherwise conceal stale fixtures or successful checks against another source revision.

Missing specifications can appear later and pinned repositories can change. Discovery caches deliberately retain old Git HEADs, so update monitoring needs fresh observations without automatically accepting new contracts.

## Decision

Use npm, exact direct dependency versions, the committed package lock, an exact Node version for CI, and immutable GitHub Actions references. Dependabot proposes reviewed updates. Rebuild generated directories from tracked inputs, record source fingerprints in reports, and require lint, type checking, regression tests, all-operation verification, real workerd HTTP checks, and a bundle dry run in CI. Exclude generated deployment assets and local caches from source control.

Require explicit maintainer authorization for deployment; the current workflow verifies and uploads artifacts without publishing. See [testing](../testing.md), [maintaining](../maintaining.md), and [workflow](../../.github/workflows/verify.yml).

Use `npm run sources:check` and the weekly/manual [upstream workflow](../../.github/workflows/upstream-check.yml) to scan fresh default-branch checkouts and compare them with committed source evidence. Report changed HEADs, new/changed candidates, pinned source/license changes, out-of-scope leads, and recorded official-page access/download links. Publish Markdown/JSON reports and a workflow summary. Keep this automation read-only: it does not update locks or baselines, create issues or pull requests, or deploy. Acceptance requires the reviewed source and verification process in [ADR 0002](0002-verified-pinned-contracts.md).

## Alternatives considered

- Floating dependency ranges/actions: less predictable changes between runs.
- Commit generated output as build input: risks stale or irreproducible artifacts.
- Treat Node preview or a dry run as production acceptance: neither measures deployed CPU.
- Reuse cached HEADs for monitoring: misses new commits and files.
- Automatically accept upstream updates: bypasses license, edition, and operation review.

## Consequences

Updates pass explicit review and gates. Changed build inputs invalidate previous runtime evidence. Monitoring findings repeat until committed evidence is deliberately refreshed. A different HEAD is not proof of a release or descendant commit. Parse failures and inaccessible pages limit conclusions; repository scan failures produce an incomplete report. Schedules require the workflow on the default branch and may be delayed or disabled after inactivity. See [monitoring instructions](../sources.md#monitoring-upstream).

A future deployment workflow should extend this record if it follows the existing authorization model. A materially different model requires a new decision addressing credentials, permissions, trusted origin, and verification of the published revision.
