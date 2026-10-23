# 0003: Keep public mocks immutable

- Date: 2026-10-22
- Status: Accepted

## Context

Anonymous demos and integration tests need repeatable linked records. Shared mutable data would let one caller disrupt another. Different API majors have different schema requirements.

## Decision

Return deterministic fixtures for public mutations without persisting changes or delivering notifications. Project one synthetic canonical scenario into separately validated API/major responses. Use stable seeded IDs and verify links. Support only implemented query semantics; currently these are declared offset/limit pagination. Private writes and domain state transitions remain future work requiring separate decisions and tests.

See [scenario](../../scenarios/support-fiber-outage/canonical.json), [architecture](../architecture.md), and [roadmap](../roadmap.md).

## Alternatives considered

- Shared public writes: cross-user interference and abuse.
- Full business simulation across all APIs: excessive domain logic for contract mocks.
- Reuse raw v4 payloads for v5: risks schema-invalid responses.

## Consequences

Successful mutation responses do not imply changed state. The docs and explorer must make that behavior clear. Seed projections are published only after schema and relationship checks pass; optional incompatible relationships are disclosed and omitted.
