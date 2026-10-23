# Changelog

## 0.1.0 — Unreleased

Initial public preview of the contract-driven Telecom API Sandbox.

- 109 verified API/version contracts from the 159-pair directory target inventory.
- 2,532 generated HTTP operations, including 1,863 schema-validated response bodies and 669 bodyless responses.
- Fourteen schema-validated read projections for the synthetic fiber-outage scenario.
- Immutable mock mutations, unique effective contract routes, static docs, and machine-readable coverage.
- Pinned sources and dependencies, license attribution, strict coverage gates, Linux workerd CI checks, and Dependabot updates.

Known limitations include 50 source gaps, unsupported advanced queries, no persistent writes, no webhook delivery, and unmeasured production CPU. See the README and source-gap inventory for details.

- Added ADRs, an ADR template, and agent/contributor instructions requiring architecture decision review.
- Added fresh weekly/manual upstream monitoring with source, commit, license, and official-page reports.
- Filled 13 missing v5 server contexts: seven derived from verified in-scope v4 evidence and six explicit sandbox conventions, including TMF638. Affected resource, hub, listener, and scenario URLs now use API-specific contexts; generated specs disclose the overrides.
- Removed runtime contract-selector headers and variant handling. Duplicate effective routes now fail build verification.
