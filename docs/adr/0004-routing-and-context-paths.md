# 0004: Use unique effective routes and explicit context overrides

- Date: 2026-10-22
- Status: Accepted

## Context

Sources define effective paths through servers/basePath and operation overrides. Some v5 specs omit API-specific contexts, leaving root-level resources, hubs, and listeners. One Worker needs unambiguous URLs while retaining the original specifications and making any routing modifications visible.

## Decision

Derive paths from each pinned source. For missing v5 contexts, apply reviewed, hash-bound [overrides](../../catalog/context-path-overrides.json): use an already verified in-scope v4 context with only its version segment changed to v5, or an explicit project convention when no in-scope v4 source is available. Do not acquire out-of-scope sources for this purpose. TMF638 uses the project convention `/tmf-api/serviceInventory/v5`.

Apply the context to resources, hubs, and listeners while preserving explicit path/operation server overrides. Publish effective servers and `x-telecom-sandbox-context-path` metadata distinguishing `DERIVED_FROM_V4` from `PROJECT_CONVENTION`. Preserve original upstream bytes. Re-review overrides when source hashes change or upstream supplies a context. Individual path entries belong in the override manifest rather than separate ADRs.

Route directly by effective method/path, with literal paths taking priority over parameterized paths. Require each method/path to identify exactly one operation, canonicalizing variable names when checking duplicates. Duplicate routes fail build verification; the runtime matcher also rejects them defensively. There is no contract-selector header, variant grouping, or ambiguous root alias.

See [normalization](../../tools/context-paths.ts), [route matcher](../../apps/api-worker/src/route-matcher.ts), and [routing tests](../../tests/router.test.ts).

## Alternatives considered

- Keep ambiguous root paths with a routing header: adds a client-facing selector and runtime branching instead of API-specific URLs.
- Pick the first matching route: hides ambiguity and depends on iteration order.
- Guess every context: unnecessary when in-scope v4 evidence is available.
- Edit original source files: obscures provenance.

## Consequences

Overridden URLs are documented sandbox choices, not claims to amend official specifications. Scenarios, explorer examples, generated specs, and verification must use the same effective paths. New conflicting sources require an explicit source or context correction before acceptance. Tests cover context derivation and conventions, preservation of explicit servers, duplicate-route rejection, and direct HTTP requests without selector-specific CORS or Vary behavior.
