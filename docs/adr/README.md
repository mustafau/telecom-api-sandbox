# Architecture decision records

ADRs preserve the context, decision, alternatives, and consequences behind consequential choices. [Architecture](../architecture.md) describes the current system; the [roadmap](../roadmap.md) describes remaining work. The [original proposal](../design/original-proposal.md) is historical background.

## Decisions

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-offline-compiler-and-worker.md) | Compile offline; serve through one Worker and static assets | Accepted |
| [0002](0002-verified-pinned-contracts.md) | Use directory scope, licensed pinned sources, and complete operation verification | Accepted |
| [0003](0003-immutable-public-mocks.md) | Keep public mocks immutable and scenario projections version-specific | Accepted |
| [0004](0004-routing-and-context-paths.md) | Use unique effective routes with explicit missing-context overrides | Accepted |
| [0005](0005-reproducible-builds-and-release-evidence.md) | Pin and verify builds; monitor upstream without automatic acceptance | Accepted |

These five initial records consolidate the design decisions before the first public release. Implementation details and intermediate proposals belong in current documentation or change history.

## When to write an ADR

Consider ADR impact in every change, but add a record only for a significant, lasting architectural choice with meaningful alternatives or tradeoffs. Examples include a new storage model, changing the source trust policy, or adopting a different deployment authorization model. Check whether an existing record already covers the choice.

Routine fixes, dependency updates, individual source additions, context-path entries, documentation edits, and implementation details do not need new ADRs when they follow existing decisions. Update the appropriate current docs or clarify existing ADR details. Do not create a record for each conversation iteration. Explain the review outcome briefly in the pull request.

Copy the [template](template.md) to the next unused `NNNN-short-title.md`. Use Proposed for unresolved choices and Accepted for decisions adopted in the same reviewed change. Keep records concise and link implementation and related decisions. Add the new entry here and update maintained documentation.

An accepted record is history. To reverse it, add a replacement record and mark the old one “Superseded by ADR NNNN,” linking both records. Avoid rewriting its original rationale. The PR template and root [agent instructions](../../AGENTS.md) keep this review part of future work; they do not mechanically determine architectural significance.
