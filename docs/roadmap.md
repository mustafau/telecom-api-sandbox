# Roadmap

This is the maintained list of remaining work from the [original proposal](design/original-proposal.md). It records priorities and completion criteria, without release dates. Update it when work is completed or scope changes. The [README](../README.md) and [architecture](architecture.md) describe implemented behavior.

## Current baseline

The 2026-10-22 inventory contains 104 APIs and 159 major-version pairs. The current implementation verifies 109 licensed, pinned contracts and all 2,532 of their operations, with 14 seeded read projections for the fiber-outage scenario. Public mutations return immutable fixtures. Local workerd verification passes. A preview Worker is hosted at [telecom-api-sandbox.mustafaulu.workers.dev](https://telecom-api-sandbox.mustafaulu.workers.dev/docs/); production CPU acceptance remains pending.

## Next priorities

### Resolve source gaps

- Obtain and review licensed contracts for the 50 pairs in [source-gaps.json](../catalog/source-gaps.json), including missing version artifacts and unresolved license evidence.
- Record exact upstream bytes, versions, immutable references, hashes, licenses, and release maturity when verifiable.
- Accept each source only when every declared operation passes compilation, fixture validation, and runtime checks. Keep unavailable pairs explicitly blocked.

The 159-contract goal is complete only when all target pairs have verified sources and passing operations. Follow the [source workflow](sources.md) and [baseline review](testing.md) for changes.

### Measure the hosted service

- Preview deployment is live at `https://telecom-api-sandbox.mustafaulu.workers.dev` after a rebuild with that `PUBLIC_ORIGIN`. Hosted API, explorer, coverage, and scenario links have been smoke-checked.
- Continue the [maintainer checklist](maintaining.md) repository protections where not already enabled.
- Measure production CPU under representative traffic and confirm hosting limits before claiming production free-tier acceptance. Local bundle and asset measurements already exist; Worker observability is enabled for that measurement.

### Expand useful read behavior

- Add the proposed fulfilled-order scenario and a walkthrough of linked API calls and retrieval documents.
- Add version-specific projections where verified contracts support them, preserving schema validation and cross-API link checks.
- Extend query behavior beyond declared `offset`/`limit` pagination only with documented semantics and tests. Unsupported queries remain explicit errors until implemented.

## Later work

### Broader compiler support

Evaluate OpenAPI 3.1 and additional response media or schema cases as concrete sources require them. Any external or multi-file references need an explicit, pinned local dependency strategy. Preserve strict validation and source provenance.

### Automated contract refresh

Weekly/manual [upstream monitoring](sources.md#monitoring-upstream) now reports fresh HEADs, candidates for missing contracts, source/license changes, and official-page download leads. Acceptance remains manual. A later enhancement could prepare reviewed update pull requests with operation and coverage diffs. Dependabot already proposes npm and GitHub Actions updates.

### Optional private write sandboxes

After public-mode acceptance, consider isolated D1 overlays with bearer tokens, expiry, quotas, request validation, and tests for tenant isolation. Start with selected ticket and order workflows. Advertise writable or behavioral support only for operations that have dedicated verification.

### Optional integrations

Evaluate bounded error injection in private sandboxes, generated agent tool manifests, and legally accessible conformance test kits when there is a concrete use case. Contract mocks alone do not imply conformance certification.
