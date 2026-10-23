# 0002: Use directory scope and verified, licensed, pinned contracts

- Date: 2026-10-22
- Status: Accepted

## Context

A directory version badge does not prove an accessible specification exists. Mirrors contain conflicting editions, filename/version mismatches, and artifacts whose license cannot be established.

## Decision

Separate target inventory from verified contracts. Lock original source bytes, actual version, repository commit, SHA256, licenses/notices, and selection rationale. Preserve original upstream files. Report missing or unlicensed sources as explicit gaps. Every locked contract must pass all declared operations; a required reviewed baseline prevents silent source or operation regressions. Generated derivatives retain modification and attribution notices.

Use the [official TM Forum Open API directory](https://www.tmforum.org/open-digital-architecture/open-apis) as the authority for API/major scope. The committed catalog is a dated snapshot. Review live additions/removals before changing the inventory, its checks, and published counts. Mirror files outside the inventory are review leads, not authority to expand support. If directory access fails, current scope changes remain unverified. Do not acquire out-of-scope contracts solely to derive context paths; use the conventions in [ADR 0004](0004-routing-and-context-paths.md).

See [source workflow](../sources.md), [lock](../../catalog/spec-lock.json), [gaps](../../catalog/source-gaps.json), and [verification policy](../../tools/verification-policy.ts).

## Alternatives considered

- Fabricate missing specs or substitute another major: unsupported coverage claims.
- Always accept the newest filename: filenames do not establish identity, version, or equivalence.
- Permit failing newly locked contracts outside the baseline: weakens the acceptance gate.
- Treat every mirrored historical major as supported: expands scope beyond directory evidence.

## Consequences

Coverage can remain below the target inventory despite a passing build. Updates require license, edition, and operation review. Contract mocking describes response fidelity, not certification or complete business behavior. Automated observations remain separate from acceptance; see [ADR 0005](0005-reproducible-builds-and-release-evidence.md).
