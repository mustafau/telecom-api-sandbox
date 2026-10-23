# Repository instructions for agents

Read the [README](README.md), [current architecture](docs/architecture.md), and [ADR index](docs/adr/README.md) before changing implementation or workflows. Follow [Contributing](CONTRIBUTING.md) for verification and source review.

## Architecture decisions

For every task, consider whether it changes an existing architecture decision or introduces a consequential new one. Check the relevant accepted ADRs before implementation.

- Add an ADR only for a significant, lasting architectural choice with meaningful alternatives or tradeoffs, such as a new runtime/storage model, source trust policy, or deployment authorization model. Check whether an existing ADR already covers the decision first.
- Use `docs/adr/template.md` and the next unused four-digit number; update the ADR index and relevant current documentation in the same change.
- Preserve accepted decisions as history. To reverse a decision, add a replacement ADR, mark the previous one superseded, and link both directions. Correct factual mistakes without rewriting the original rationale.
- Routine fixes, dependency updates, individual source additions, context-path entries, documentation edits, and implementation details do not need new ADRs when they follow existing decisions. Update the relevant docs or existing ADR details as needed; do not create records for conversation iterations. Record the ADR review outcome in the pull request, including “no ADR change needed” with a short reason when appropriate.
- The original proposal is historical context. Current code, maintained docs, and accepted ADRs describe the implemented system; proposed ADRs do not authorize implementation or deployment.

## Upstream monitoring

Use the [official TM Forum Open API directory](https://www.tmforum.org/open-digital-architecture/open-apis) as the authority for future scope reviews. Compare its live API/major listings with `catalog/catalog.json`; review additions/removals explicitly and update inventory checks, baselines, and docs together. A mirror file alone does not put a major in scope. If the directory is inaccessible, report scope changes as unverified rather than assuming the snapshot is current. Do not acquire out-of-scope contracts solely to derive context paths; use an explicit project convention instead.

Use `npm run sources:check` to check fresh upstream heads and candidates. It writes review reports under `.cache/upstream-check/`; inspect incomplete scans and access failures before drawing conclusions. Do not use cached discovery HEADs as evidence that upstream is unchanged.

Monitoring must not rewrite `catalog/spec-lock.json`, source selections, accepted baselines, or `upstream/`. Newly discovered files and license changes require the normal reviewed acquisition and verification process. A new repository commit does not establish a new API release or compatible contract. Respect source access restrictions.

Use npm with exact dependency versions and the committed lockfile. Keep parsing and fixture generation offline, public responses immutable, original upstream bytes intact, and gaps visible. Do not deploy, publish releases, or introduce paid resources without explicit maintainer authorization.
