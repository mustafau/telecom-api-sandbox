# Telecom API Sandbox: Contract-Driven TM Forum Open API Mock Platform

> **Historical proposal — 2026-10-22.** This document preserves the original design and its acceptance criteria. Some capabilities remain unimplemented, and commands, paths, dependency suggestions, source observations, and provider limits describe the proposal at that date. Use the [README](../../README.md) and [architecture](../architecture.md) for current behavior, the [roadmap](../roadmap.md) for remaining work, and [Contributing](../../CONTRIBUTING.md) for current engineering instructions.
>
> The original text below is unchanged. Companion filenames refer to the original local design package; the ZIP and agent handoff are excluded from the public repository. The maintained inventory is [catalog/catalog.json](../../catalog/catalog.json), and verified sources are recorded in [catalog/spec-lock.json](../../catalog/spec-lock.json).

**Status:** Implementation-ready architecture proposal, not an implemented service  
**Prepared:** 2026-10-22  
**Primary audience:** Autonomous coding agent and technical maintainer  
**Scope:** The **104 APIs / 159 API-major-version combinations** in the user-provided TM Forum directory snapshot, including v1, v2, v3, v4, and v5.  
**Branding:** Working name "Telecom API Sandbox"; independent project, **not** an official TM Forum service.  
**Companion files:** `catalog.json`, `catalog.csv`, `source_leads.json`, `AGENT_HANDOFF.md`, `build_catalog.py`.

> **Critical truthfulness rule:** `catalog.json` is a user-supplied directory inventory, **not** evidence that all 159 source specifications have been obtained or validated. A successfully generated mock must be traced back to an actual, verified and licensable upstream contract. Do not synthesize missing OpenAPI specifications while claiming they are official.

## 0. Executive decision record

Build **one small TypeScript/Cloudflare Workers runtime** driven by **generated, version-specific metadata and fixtures**. Keep OpenAPI parsing, schema dereferencing, example generation, and validation in **offline build tooling**, not inside HTTP request handlers. Ship a fully static, unauthenticated public API first; only then add optional session-scoped mutations with Cloudflare D1.

Reasons:

1. Generating an independent server for each of 104 APIs (or 159 major versions) is unnecessary and expensive for an AI coding agent to maintain.
2. A schema-valid response for every declared operation can be generated at build time; basic read/list/filter operations can be handled by one generic engine.
3. Most demo/RAG/tool-calling workloads need **predictable, stable, linked records**, not real telecom provisioning.
4. Workers can host a minimal runtime with no always-on VM; static assets avoid runtime module-size and CPU pressure.
5. Versions **must be distinguished by actual source contract**; v4 and v5 are not interchangeable JSON representations.

**Do not** use 104 microservices, Kubernetes, Camunda, Kafka, LLM calls, a vector database, GraphQL, remote SaaS mock instances, or a heavy server-side Swagger renderer in v1. These are not requirements. Consider Prism only as a **development/reference or offline fixture generation** tool, not as 159 permanently running services.

## 1. Goals, explicit non-goals, and support levels

### Product goals

- Public HTTPS base URL on `*.workers.dev` with **no user account**, no payment or request-time dependence on GitHub/TM Forum.
- Catalog browsing for all **104 directory entries**, with user-visible, truthful status of **all 159 version combinations**.
- For every obtained/validated major-version OpenAPI contract: expose every declared HTTP operation with correct method/path/status/media type and schema-valid example where that response has a machine-readable schema. Handle `204`, binary and empty responses appropriately.
- Make common GET/list/detail requests reliably useful to developers and agents: stable IDs, deterministic data, cross-API links, documented filtering and pagination.
- Support POST/PATCH/DELETE in **private, time-limited sandboxes** in a later phase; do not let anonymous users corrupt shared data.
- Downloadable browsable specs and an operation explorer, plus copyable curl and tool-calling examples.
- Cheap local development, automated upstream-contract refresh, regression tests, evidence of completeness, and a zero-dollar production configuration under the provider's free-tier constraints.
- Synthetic datasets, no customer PII, and no real outbound provisioning.

### Non-goals (initial version)

- Becoming a TM Forum certified conformant implementation. Contract-level mocking **does not imply** conformance certification or faithful domain business logic.
- Implementing every workflow's true business rules, provisioning equipment, rating usage, fraud models, billing engines, inventory consistency or SLA calculations.
- Publishing the official TM Forum name/logo as the project's own mark.
- Implementing TM Forum APIs not listed in the supplied baseline (can be added through refresh).
- Supporting **every historical patch/minor version**. Baseline means *every major-version badge shown in the directory*; track exact pinned semver within each major. If full patch-by-patch support is later required, explicitly expand the matrix.
- Claiming APIs without accessible specifications are complete.

### Precisely defined support levels

- `LISTED`: present in directory manifest, source spec not yet verified.
- `DISCOVERED`: provenance, license, and exact version of candidate contract recorded.
- `COMPILED`: source parsed, references resolved, routes and fixtures compiled.
- `CONTRACT_MOCKED`: **all** declared operations exposed and contract-valid happy-path mock responses tested; no guarantee of state coherence.
- `SEEDED`: read responses use a stable, linked telecom scenario with documented filters/pagination.
- `SANDBOX_WRITABLE`: isolated CRUD writes pass integration tests where operation is defined.
- `BEHAVIORAL`: named domain state transitions or special action semantics implemented with dedicated tests.
- `BLOCKED`: source missing, license uncertain, corrupt schema, conflicting version, or incompatible semantics, with an explicit reason.

**Public documentation must show the achieved level per API/version, never a misleading blanket "fully implemented."** The ambition is eventual contract coverage for all 159, not a dishonest launch claim.

## 2. Inventory and versions: authoritative baseline

Input source: the directory list supplied in the conversation on **2026-10-22**, also hosted at [TM Forum Open API Directory](https://www.tmforum.org/open-digital-architecture/open-apis). The URL is a live catalog, so refreshes may add/remove versions. The 104 count is exact for this supplied snapshot. Machine-readable source of truth: `catalog.json`.

| Category | Distinct APIs |
|---|---:|
| Marketing Sales | 1 |
| Customer | 14 |
| Product | 10 |
| Service | 13 |
| Resource | 16 |
| Business Partner | 15 |
| Common | 35 |
| **Total** | **104** |

| Major | Contract combinations |
|---|---:|
| v1 | 5 |
| v2 | 2 |
| v3 | 7 |
| v4 | 78 |
| v5 | 67 |
| **Total** | **159** |

Important version traps:

- TMF676 is **v1 and v4**, *not v5*, in this snapshot.
- TMF680 is **v2 and v4**.
- TMF633 is **v3 and v4**, not v5.
- TMF638 is **v5 only** in the supplied directory listing. Do not invent a v4 support claim from old repos.
- TMF657 is **v1 and v4**; TMF685 is **v3 and v5**.
- TMF684 and TMF910 are **v1 only**.
- TMF759 is called **Private Optimized Binding** and TMF931 is a **component suite**; verify their downloadable asset types and operations before treating them as conventional REST CRUD APIs.
- Open Gateway API groups TMF931/TMF936/TMF937 may contain component/bundled interfaces; establish actual paths and count individual contracts, not merely a visible catalog badge.
- Some v5 official pages clearly label a release **Preview** (e.g., TMF777 v5); represent release status in metadata, and don't call it stable unless the source says so.
- The names include original directory typos (e.g., "Fraud Managment" and "Service Quality Management Management"); preserve them as **display names** for fidelity, but don't derive operation paths, SDK names, or filesystem paths from display text.

**Appendix A** contains the complete 104-row inventory. The precise major-version pair matrix is also available as `catalog.csv`.

## 3. Sources, provenance, licensing, and download strategy

### Sources in priority order

1. [Official directory](https://www.tmforum.org/open-digital-architecture/open-apis) and its specific API/version detail pages: authoritative release status, version badge, and linked OAS/Swagger assets.
2. [TM Forum GitHub organization](https://github.com/tmforum-apis): publicly mirrored individual API files, often a mix of `.swagger.json` and `.oas.yaml`, under repository-level Apache-2.0 licenses. These repositories explicitly describe themselves as mirrors and point back to the official directory.
3. [Open_Api_And_Data_Model](https://github.com/tmforum-apis/Open_Api_And_Data_Model): additional reference repository, but may be older than the directory.
4. [TM Forum RAND schemas](https://github.com/tmforum-rand/schemas): a supplemental schema source, not proof a given release/version is supported.
5. API-specific official sample implementations, Postman collections, CTKs and conformance profiles when available. Use as **test evidence**, not as substitutes for a missing OpenAPI contract.

**Concrete checked examples:**

- [TMF629 repo](https://github.com/tmforum-apis/TMF629_CustomerManagement) includes `TMF629-Customer-v4.0.0.swagger.json` and `TMF629-Customer_Management-v5.0.1.oas.yaml`.
- [TMF620 repo](https://github.com/tmforum-apis/TMF620_ProductCatalog) includes `TMF620_Product_Catalog_Management_API_v4.1.0_swagger.json` and `TMF620-Product_Catalog_Management-v5.0.0.oas.yaml`.
- [TMF635 repo](https://github.com/tmforum-apis/TMF635_UsageManagement) includes Swagger v4.0.0 and OAS v5.0.0.
- [TMF622 repo](https://github.com/tmforum-apis/TMF622_ProductOrder) contains v4 Swagger and v5 OAS files.
- [TMF637 repo](https://github.com/tmforum-apis/TMF637_ProductInventory) contains v4 Swagger and v5 OAS files.
- [TMF621 repo](https://github.com/tmforum-apis/TMF621_TroubleTicket) contains v4 Swagger and v5 OAS files.
- [TMF638 repo](https://github.com/tmforum-apis/TMF638_ServiceInventory) contains v5 OAS, plus older v3/v4 mirror files; the supplied directory lists only v5.
- [TMF641 repo](https://github.com/tmforum-apis/TMF641_ServiceOrder) lists multiple v4 Swagger files but no clearly named v5 OAS file in its root listing as observed; **TMF641 v5 requires separate official-source discovery**.
- `source_leads.json` records these **observed candidate filenames**; it is not a checked source lock and may be outdated.
- [TMF770 v5 official page](https://www.tmforum.org/open-digital-architecture/open-apis/fraud-management-api-TMF770/v5.0) lists v5.0.0 stable and an OAS asset (released 2026-09-04). The expected GitHub repo name `TMF770_FraudManagement` was **not verified**; do not presume naming patterns are stable.
- [TMF777 v5 official page](https://www.tmforum.org/open-digital-architecture/open-apis/outage-management-api-TMF777/v5.0) describes a preview release, another reminder to capture maturity.

### Agent acquisition procedure: repeatable, reproducible

1. Load `catalog.json`: create 159 **target pairs** `(TMF###, vMajor)`.
2. Discover public GitHub repositories using the GitHub REST API, with pagination, **not** guessed repository URLs. Enumerate org repositories, search names/descriptions for API identifier. Query file trees, filename matches and `info.version`, not guessed filenames.
3. For each target pair, gather candidate specification URLs from the mirror and official version page. If the official directory download is login-gated or unobtainable, mark `BLOCKED` / `NEEDS_MANUAL_SOURCE`; do **not** bypass access restrictions or scrape bulk site assets contrary to terms.
4. Only accept candidate OAS 2/Swagger or OAS 3 JSON/YAML documents after parsing and matching their actual API identity and semantic version. Separate stable from RC/preview; default to newest **stable patch within the listed major**, but retain a preview if that's the only official published major and clearly flag status.
5. Resolve filename/version mismatches explicitly. Do not silently select an arbitrary `.admin.swagger.json`, `.regular.swagger.json`, test asset, obsolete draft, or a document for the wrong API.
6. Record source URL, origin type, resolved Git commit/blob SHA or immutable download reference, UTC retrieval date, exact `info.version`, semver, source SHA-256, SPDX license/attribution, release maturity, OAS dialect and any known discrepancies. Commit a reviewed `spec-lock.json`.
7. Save original files to `upstream/<TMF-ID>/<vMajor>/<filename>` if redistribution is permitted, with license and NOTICE obligations. Preserve source bytes; treat generated normalized files as derived artifacts with mapping back to the originals.
8. On refresh, generate a **pull request/report**, never auto-deploy newly discovered unreviewed contracts. Report additions, removals, changed hashes, route count changes, generated schemas, and fixture test failures.
9. Strictly enumerate unavailable pairs and the reason. Coverage calculation counts `CONTRACT_MOCKED` pairs separately from `LISTED` pairs.

### Suggested `spec-lock.json` entry

```json
{
  "apiId": "TMF629",
  "major": "v5",
  "source": "github",
  "sourceUrl": "https://github.com/tmforum-apis/TMF629_CustomerManagement",
  "upstreamFile": "TMF629-Customer_Management-v5.0.1.oas.yaml",
  "upstreamCommit": "<resolve-actual-commit-sha>",
  "infoVersion": "<read-from-file>",
  "releaseMaturity": "<from-authoritative-directory>",
  "license": "Apache-2.0",
  "sha256": "<computed-from-downloaded-bytes>",
  "dialect": "<parse-from-file>",
  "state": "DISCOVERED"
}
```

Placeholders **must be filled from evidence** by the agent; never commit literal placeholders as resolved source metadata.

### Trademark and copyright

TM Forum's site [terms](https://tmforum.org/legal/website-terms-of-use) protect its marks and limit bulk copying of website materials except where the applicable license grants the necessary rights. Official API detail pages frequently indicate **"Apache 2.0 unless stated."** That is not a blanket permission to republish *all* files on the website. Check the exact artifact and license. Apache 2.0 permits substantial use and redistribution of appropriately licensed source material subject to notices and conditions, but **does not grant trademark rights**. Respect `LICENSE`/`NOTICE`, avoid trademarked logos, and prominently say: "Independent mock implementation of selected TM Forum Open API specifications. Not affiliated with, endorsed by, or certified by TM Forum." This is practical guidance, not a legal opinion.

## 4. Proposed monorepo

```text
telecom-api-sandbox/
  AGENT_HANDOFF.md
  README.md
  LICENSE                        # Own code license (proposed Apache-2.0 or MIT)
  NOTICE                         # Third-party material notices as needed
  catalog/
    catalog.json                 # 104 entries, directory version claims
    spec-lock.json               # Precise provenance & SHA per resolved pair
    source-gaps.json             # Target pairs not resolved
  upstream/
    TMF629/v4/<actual-file>
    TMF629/v5/<actual-file>
    ...
  tools/
    discover.ts                   # GitHub/official source candidate scan
    lock.ts                       # Pin and download reviewed sources
    compile.ts                    # Normalize, generate route/fixture artifacts
    verify.ts                     # Contract checks & coverage report
  generated/
    manifest.json                 # Compact routing/index metadata
    operations/<TMF-ID>/<major>.json
    fixtures/<TMF-ID>/<major>/*.json
    specs/<TMF-ID>/<major>/openapi.json
    reports/{coverage,exceptions}.json
  scenarios/
    support-fiber-outage/
      canonical.json             # Meaningful linked logical records
      documents/*.md             # Retrieval/RAG text, original synthetic content
      projections/*.ts           # Optional hand-curated version-specific mappings
    empty-account/
    fulfilled-service-order/
  apps/
    api-worker/src/
      index.ts
      route-matcher.ts
      response-resolver.ts
      query.ts
      sandbox.ts                 # Phase 2 only
      errors.ts
      types.ts
    docs-web/                    # Static docs, can live in Workers assets
  migrations/
    0001_init.sql                # Phase 2 only
  tests/
    catalog.test.ts
    compile.test.ts
    contract-generated.test.ts
    read-scenarios.test.ts
    sandbox.test.ts
    safety.test.ts
  public/                        # Deployment-ready static assets
    manifest.json
    specs/...                    # Only licensable assets
    fixtures/...
    docs/...
  wrangler.jsonc
  package.json
  tsconfig.json
```

**Note:** The monorepo layout is conceptual; use a manageable number of packages and scripts. Do not write all 159 schema projections by hand.

## 5. Compiler: OpenAPI -> immutable, portable mock artifacts

The compiler is the hardest and most valuable component. It must be **repeatable** (`source files + tool version + fixed seed -> identical generated artifacts`).

### Pipeline stages

1. **Source validation:** file readable, valid YAML/JSON, `swagger: '2.0'` or `openapi: 3.x`, actual version and TMF ID established.
2. **Reference resolution:** bundle relative `$ref`s, circular schemas, remote dependencies only if explicitly pinned/allowlisted. Block SSRF, arbitrary fetches and local `../` traversal. Prefer [Redocly CLI bundle](https://redocly.com/docs/cli/commands/bundle) or a mature standards parser. Do not blindly dereference cyclic graphs to a single circular JSON document.
3. **Dialect conversion (when needed):** Swagger 2.0 -> normalized OAS 3 using an established converter (e.g. `swagger2openapi`), retaining the original. Check path/method/status/media-type preservation, especially form data, consumes/produces, parameters and `basePath`.
4. **Operation index:** enumerate every declared `path + method` (`get`, `post`, `patch`, `put`, `delete`, `head`, `options`, `trace` as applicable). Extract **the URL path in the upstream spec**, not routes guessed from API names. Combine Swagger `basePath` / OAS `servers[*].url` pathname with `paths` properly. Resolve OAS server variables or report ambiguity. Ignore webhook definitions for HTTP request routing, but represent them in the coverage report.
5. **Schema extraction:** identify request body, parameters, acceptable responses, headers, media types, discriminator, inheritance (`allOf`, `oneOf`, `anyOf`), polymorphic `@type`, format constraints and examples. Preserve version isolation.
6. **Happy-path response generation:** prioritize an explicitly licensed `example`/`examples`, then hand-curated scenario projection, then a deterministic offline schema sampler. For an operation returning a collection, synthesize **arrays of valid entity instances**, not scalar examples. For actions, use documented action-specific response shape, not generic CRUD.
7. **Validation:** parse/compile relevant JSON Schemas and check generated payloads, `required`, enum, nullable, date/time/URI, discriminator and `additionalProperties` correctly. Prefer `Ajv` + formats with careful OAS compatibility; keep a per-operation exceptions report rather than suppressing failures globally.
8. **Artifact emission:** write compact operation routes, fixed version-specific fixtures, per-version spec/doc links, status mappings, and a machine-readable coverage report. **Do not bundle hundreds of schemas into the Worker JS.**
9. **Executable smoke generation:** produce `tests/generated/<TMF-ID>/<major>.test.ts` or equivalent data-driven suite that makes every supported operation reachable and validates successful contract responses.
10. **Pack for Workers Static Assets** with predictable paths; the runtime fetches a requested fixture/route metadata through the `ASSETS` binding when needed.

### Operation manifest format

```json
{
  "apiId": "TMF629",
  "major": "v5",
  "exactVersion": "5.0.1",
  "operations": [
    {
      "method": "GET",
      "pathTemplate": "/tmf-api/customerManagement/v5/customer/{id}",
      "operationId": "<from-contract>",
      "successStatus": 200,
      "responseMediaType": "application/json",
      "responseFixture": "/fixtures/TMF629/v5/customer-detail.json",
      "params": [{"name": "id", "in": "path", "required": true}],
      "mode": "contract",
      "contractSha256": "<computed>"
    }
  ]
}
```

The above is **illustrative**, not a claim the exact `operationId` or `pathTemplate` was verified against the file. The compiler must derive every operation from the source.

### Risky schema nuances the agent must handle explicitly

- `$ref` graph cycles; absent examples; polymorphic `@type`; abstract base schemas and concrete subclasses; discriminators.
- Multiple success responses (200, 201, 202, 204), different content types; binary/file downloads and multipart uploads; 204 with no body.
- v1-v3 older Swagger variations, `basePath` differences, unconventional parameters and possibly incomplete machine-readable schemas.
- Versions whose directory badge covers a family of assets or components rather than exactly one REST definition (especially TMF931 and TMF759).
- Different representations across majors; never rewrite `@type`, `@baseType` or `@schemaLocation` arbitrarily to make v4 payloads pass v5 validators.
- Servers with absolute production URLs: **rebase paths onto mock host**, never proxy to the production host.
- Notification/event webhook `listener` and `hub` patterns: count HTTP endpoints, callback definitions and asynchronous messaging separately; do not pretend an outbound event delivered unless it did.
- API resource paths that overlap other contracts; order matching by **method + exact literal segments + constrained variables + deterministic priority**, with collisions detected at build time.

### Discoverable coverage report example

```json
{
  "expectedApiCount": 104,
  "expectedMajorPairs": 159,
  "sourceResolvedPairs": 0,
  "contractMockedPairs": 0,
  "operationCount": 0,
  "byVersion": {"v1": 5, "v2": 2, "v3": 7, "v4": 78, "v5": 67},
  "unresolved": [{"apiId": "TMF000", "major": "v0", "reason": "EXAMPLE_ONLY"}]
}
```

Example zeros are **initial state**, not project achievements. Real generated reports should contain only actual catalog pairs in `unresolved` (the illustrative TMF000 entry above must never be emitted).

## 6. Runtime architecture (Cloudflare Workers + Hono)

```text
                         Public HTTPS client (curl / agent / RAG app)
                                          |
                           Cloudflare workers.dev endpoint
                                          |
                    +---------------------+-----------------------+
                    |                                             |
            Static Assets router                              Worker (Hono)
        docs / specs / example JSON             request router & method/path matcher
                    |                                 |                 |
              Edge cached files              public contract mock    sandbox mode
                                                 |                     |
                                              ASSETS             Cloudflare D1
                                          precompiled fixtures    overlay state
                                                 |                     |
                                        seeded domain scenarios  TTL & quotas
```

### Request flow for public mode

1. HTTPS receives `/tmf-api/...`, parse method, path, query, accept/content-type.
2. Match a **compiled, source-derived operation** using a small route trie/segment matcher; resolve the exact version and operation; a missing operation is a 404 (or 405 when the path exists under other methods).
3. Resolve the precomputed response definition and scenario. Prefer a stable, linked fixture for supported seeded entities; otherwise use a schema-checked operation fixture.
4. Apply supported query operations: resource ID lookups, filter-by-property, result fields projection, sorting, pagination **only where the contract declares these behaviors**. Unknown filtering should be documented; avoid returning misleading unchanged results.
5. Return a version-correct status, response media type and headers, with `href` links pointing at the mock host. Ensure absolute links do not reference genuine telecom services.
6. No database query, no outbound HTTP call, no LLM invocation for public GET.

### Public service-owned meta endpoints

Do not mix these with upstream TMF endpoints:

```text
GET  /healthz                          -> runtime status, not spec completeness
GET  /catalog                         -> 104 records; current completeness states
GET  /catalog/TMF629/v5               -> version, source, operations, support level
GET  /catalog/TMF629/v5/openapi.json  -> bundled spec (when redistribution allowed)
GET  /scenarios                      -> available mock datasets
GET  /scenarios/support-fiber-outage -> scenario overview + sample calls
GET  /coverage                       -> generated summary + unresolved gaps
GET  /docs                           -> static API portal
```

Public examples (only after source paths are checked; the examples below use commonly seen TMF paths, not authoritative proof for each version):

```bash
BASE='https://<your-worker>.workers.dev'
curl "$BASE/tmf-api/customerManagement/v4/customer"
curl "$BASE/tmf-api/productInventory/v4/product"
curl "$BASE/tmf-api/troubleTicket/v4/troubleTicket"
curl "$BASE/catalog/TMF629/v5"
```

### Runtime dispatch pseudocode

```ts
async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const match = routeIndex.match(req.method, url.pathname);
  if (!match) return contractAwareNotFound(req.method, url.pathname);

  const { apiId, major, operation, params } = match;
  const payload = await resolveScenarioOrFixture({
    apiId, major, operation, params, query: url.searchParams,
    assets: env.ASSETS
  });

  const result = applyDeclaredQuerySemantics(payload, operation, url.searchParams);
  // Build-time schema checks are primary. Optional bounded runtime checks only.
  return serializeContractResponse(result, operation, req);
}
```

No unrestricted runtime eval, dynamic source-module imports, arbitrary upstream fetches, schema-compilation storm or heavy faker on each request. Match and fixture retrieval should be cheap enough for the free Workers CPU budget; measure and reduce complexity if not.

### Static Asset deployment configuration (illustrative)

Use the current Wrangler version; verify this syntax against its installed schema:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "telecom-api-sandbox",
  "main": "apps/api-worker/src/index.ts",
  "compatibility_date": "2026-10-22",
  "assets": {
    "directory": "./public",
    "binding": "ASSETS",
    "run_worker_first": ["/tmf-api/*", "/catalog*", "/coverage", "/scenarios*", "/healthz", "/sandboxes*", "/s/*"]
  }
}
```

Use [Workers Static Asset bindings](https://developers.cloudflare.com/workers/static-assets/binding/) (`env.ASSETS.fetch(...)`). Ensure the static docs and OAS files bypass the Worker where possible. A Worker invocation to serve a `public/` fixture still counts toward Worker requests even if the underlying asset is free to retrieve. The platform supports a limited number of static assets; collapse very small fixture files per API/version if necessary.

## 7. Realistic telecom data: canonical scenario and version adapters

Random objects that validate individually are not useful to a support agent. Provide **deterministic linked datasets** on top of generic contract mocking. Do not build a giant normalized telecom database. Create small canonical scenario graphs, project them into each *known* API/version schema, and publish supporting documents for RAG.

### Scenario 1: fiber outage impacting a subscriber

Canonical graph (illustrative synthetic IDs):

```text
party-001 (individual)
  |
customer-001 -- billing-account-001
  |
product-001 -- product-offering-001
  |
service-001 -- resource-001
  |                 |
  +-- trouble-ticket-001 -- outage-001
  |
  +-- service-order-001
```

At minimum, seed these **contract-backed** interfaces where available: TMF632 Party, TMF629 Customer, TMF620 Product Catalog, TMF637 Product Inventory, TMF638 Service Inventory, TMF639 Resource Inventory, TMF621 Trouble Ticket, TMF641 Service Ordering, TMF777 Outage. Optional: TMF666 Account, TMF678 Customer Bill, TMF622 Product Ordering, TMF688 Event Management.

Example agent questions:

1. "Who owns service-001, and which product is affected?"
2. "Is there an active outage corresponding to trouble-ticket-001?"
3. "What was the original order, and what is its current state?"
4. "Summarize the outage, restoration estimate, and customer-facing next steps."
5. "Can a new support ticket be created?" (only in writable sandbox mode).

Provide `scenarios/support-fiber-outage/documents/{support-policy,outage-playbook,faq}.md` as **original synthetic content**. The RAG developer indexes those files in their own vector store; the mock API supplies structured facts. This project does **not** host an embedding service.

### Projection rules

- Maintain `canonical.json` using a small semantic model only for seeded scenarios, **not** as a replacement for all 159 source schemas.
- Each API+major projection maps canonical facts to that version's legal fields, required values, enums, type discrimination and relationships.
- Populate path parameters, embedded IDs, `href`, dates and statuses deterministically; a link from one API must resolve when that downstream endpoint and version is exposed.
- Seed scenario version-specific payloads **offline** and validate against the exact response schema. If a projection fails, mark the scenario for that version unavailable; use a separate generic schema fixture for contract coverage, not malformed data.
- The same semantic scenario can map to different schema shapes across v4/v5. A developer requesting v4 should not receive a v5 object.
- Use stable random seed and fixed reference dates in fixtures; if a current relative date is important, document that dynamically rewritten fields are not byte-stable.
- Never include real people's names, addresses, phone numbers, passwords, payment information, or production IDs. Use clearly fictional example data.

### List/detail consistency requirements

- Every collection item's `id` exists at its detail endpoint (when detail is declared).
- `href` points to a valid same-host resource URL and version, not tmforum.org or a genuine operator.
- Related objects use valid IDs; special linked resource references must match their per-contract representation.
- Pagination is stable and ordered with deterministic tie-breaking by resource ID.
- `fields` projection should preserve required identity fields if mandated by the relevant API semantics, and be documented accurately.
- Empty-list response is `[]`, not `null`, unless contract indicates otherwise.
- For an unsupported advanced query, return a documented client error rather than silently claiming a filtered result.

## 8. Stateful sandboxes (Phase 2)

### Isolation and authentication

**Read-only public mode is anonymous.** Writes require a **sandbox bearer token**. API keys for the public GET endpoints are unnecessary and cumbersome for users testing agents.

Proposed flow:

```text
POST /sandboxes                  -> creates sandbox (strict quota/anti-abuse)
                                 returns sandboxId, bearer token, expiresAt
GET  /s/{sandboxId}/tmf-api/...  -> read with overlay (token required)
POST /s/{sandboxId}/tmf-api/...  -> create record (only if upstream spec allows)
PATCH /s/{sandboxId}/tmf-api/... -> update record (only if allowed)
DELETE /s/{sandboxId}/tmf-api/...-> delete record (only if allowed)
DELETE /sandboxes/{sandboxId}     -> delete own sandbox (token required)
```

Namespace `/s/<sandboxId>/...` belongs only to the mock service; inside it, preserve the original TMF route verbatim. An alternative of placing the sandbox identity only in an HTTP header is possible, but explicit URLs are easier for agents and documentation. Use one canonical mode to avoid confusion. Never allow anonymous public writes to the globally seeded dataset.

- Generate at least 128 bits of cryptographically secure random token entropy; return the secret exactly once.
- Hash tokens before storing (e.g., SHA-256 for high-entropy random tokens, verify with constant-time comparison where applicable); keep hashes separate from identifiers. Tokens must not be exposed in logs or URLs.
- Send `Cache-Control: no-store` for sandbox responses and tokens. Do not cache sandbox data across users.
- Enforce short TTL (example: 24 hours), small max resources, per-sandbox write caps, and request body size limits before parsing.
- If `POST /sandboxes` is abused, disable new anonymous sandboxes through a configuration switch; basic accountless mode is inherently vulnerable to bot creation without a platform-level anti-abuse control.
- D1 read quota is shared account-wide; add fair-use protection and graceful throttling, not a claim of guaranteed uptime.

### D1 schema sketch

```sql
CREATE TABLE IF NOT EXISTS sandboxes (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  write_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sandbox_resources (
  sandbox_id TEXT NOT NULL,
  api_id TEXT NOT NULL,
  major TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  payload_json TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (sandbox_id, api_id, major, resource_type, resource_id),
  FOREIGN KEY (sandbox_id) REFERENCES sandboxes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sandbox_expiry ON sandboxes(expires_at);
```

Each sandbox starts from immutable public seed data (if the API/version has a seeded dataset), then overlays inserted/updated records and tombstones. Non-seeded API operations may use a generated contract fixture and a generic per-resource store, subject to the operation's actual request/response schemas. Never assume every API has a CRUD schema.

Atomic operations: for create/update, validate request payload against the exact version-specific request schema; enforce protected ID/href fields; create IDs atomically with the mutation; apply conditional `If-Match` only if supported; maintain deterministic error response shapes. D1 batch/transaction behavior must be verified with tests. No cross-API distributed transactions in v1.

**Version semantics:** default sandbox records are keyed by `(apiId, major, resourceType, id)` and thus isolated per major. Avoid promising that a PATCH via TMF629 v4 appears in TMF629 v5. Cross-version shared domain state requires explicit projection logic and version-aware semantics, so it is a separate feature.

Lifecycle example: if you implement a service order progression, expose named transitions only where documented, e.g. `acknowledged -> inProgress -> completed`. Never apply guessed lifecycle transitions to all order APIs. Add a scenario clock override or test-only transition controls if developers need deterministic behavior.

## 9. HTTP contract fidelity checklist

Use **only operations and parameters declared by the imported spec**, plus service-owned meta endpoints above. Per-operation test these aspects:

| Aspect | Required behavior |
|---|---|
| Routing | Correct verb, exact version path, path params, allowed methods; 404 vs 405 |
| Methods | GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, etc. *when declared* |
| Responses | Choose a declared success status (200/201/202/204), correct body or no body |
| Media types | Honor published `application/json`, JSON Patch / merge-patch, binary, multipart as applicable |
| Required data | Honor required fields, enum values, nullable, arrays, object shapes, headers |
| Error cases | Stable 400/401/403/404/405/409/415/422/429/500 *as relevant*, documented mock examples |
| Pagination | `offset`, `limit`, counts, ordering only if the spec supports them |
| Filtering | Exact field matching / supported expression grammar for declared params |
| Fields | Contract-compatible field projection, not mutation of original dataset |
| HTTP caching | Public GET can use cache when stable; sandbox endpoints `no-store` |
| Links | `href`s match mock host, API version and retrievable target |
| Versioning | v1, v2, v3, v4, v5 isolated; patch pinned in lock and page metadata |
| Validation | Offline response schema tests; bounded runtime input validation in sandbox mode |
| Malformed spec | `BLOCKED` with source and reason; never fabricate an official contract |
| Events | Separate HTTP operation coverage from async notification delivery |

**Edge cases:** zero items, IDs that do not exist, malformed query encoding, invalid UUID, query parameters not declared in spec, trailing slashes, `Accept` negotiation, OPTIONS/CORS, oversized bodies, unescaped URLs, malformed JSON, nested object filters, single/multiple result ambiguity, `@type` polymorphism, date formats, null-vs-omitted, and non-ASCII strings.

### Fixture generator algorithm

Suggested deterministic offline generator:

```text
for each (TMF-ID, listed-major) in catalog.json:
    source = resolve_exact_pinned_spec_or_block()
    spec   = parse_bundle_and_normalize(source)
    for each declared HTTP operation in spec:
        response = choose_declared_success_response()
        if has_no_body(response): emit empty fixture/metadata
        else:
            example = select_explicit_example_or_seed_projection()
            if not example:
                example = deterministic_schema_sampler(response.schema, seed)
            check(example, response.schema)
            if invalid:
                report exception and block this operation (not the entire build)
            else:
                emit versioned fixture and operation manifest record
    verify no declared operation omitted
    set pair support level to CONTRACT_MOCKED only if every operation passes
```

When an operation lacks a machine-readable body schema, mock valid status/header behavior according to the source and label that response as **not schema-validated**; don't label missing validation as successful schema validation.

## 10. Cost and operational constraints (checked 2026-10-22)

Cloudflare's official documentation currently lists [Workers Free](https://developers.cloudflare.com/workers/platform/limits/) at **100,000 Worker requests/day**, **10 ms CPU/request**, **128 MB memory**, **50 subrequests/request**, up to **64 MiB Worker script size**, **20,000 static asset files**, and **25 MiB per static asset**. Historic pages showed a smaller bundle limit, so check the current official page before deployment. Importantly, avoid shipping all OAS files in the Worker bundle even when the size limit is larger.

[Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) requests are **free and unlimited**, and static asset storage has no extra charge, but requests that invoke the Worker count against Worker limits.

[D1 Free](https://developers.cloudflare.com/d1/platform/pricing/) currently offers **5,000,000 rows read/day**, **100,000 rows written/day**, and **5 GB storage**. Exceeding Free limits results in failed operations rather than automatic usage-billed scaling, but the service can become unavailable. Free tier is **not a service-level uptime guarantee**.

**Practical zero-dollar safeguards:**

- Use Workers **Free**, not paid plan, and use provided `workers.dev` hostname (no paid custom domain).
- Never add billable external APIs, hosted vector stores, SaaS mock servers, or third-party telemetry.
- Host specs, docs, response fixtures as Worker Static Assets; make the Worker a lightweight router.
- No database access for public read-only requests; D1 only for opt-in sandboxes.
- Prefer immutable versioned build artifacts and edge/static delivery to per-request JSON Schema compilation.
- Put caps on anonymous sandbox creation and resource writes; disable sandboxes by environment variable if abuse starts.
- Keep Worker execution bounded (<10 ms CPU objective, measured); lower fixture counts or move more to assets if breached.
- Add response cache rules only for public deterministic GET, never for authenticated variants.
- Monitor free dashboard and analytics periodically; plan for users reaching the free daily cap and receiving errors.
- Document no uptime SLA, acceptable-use policy, and a graceful error when overloaded.

If the public workload exceeds 100,000 requests/day, the **non-paying** options are to throttle, shorten the scope, serve more literal response files directly as static assets, or migrate to another free platform; **do not secretly upgrade to a paid service**.

## 11. Security, privacy, and abuse model

Main threats: bot-created sandboxes; write amplification; huge JSON bodies; pathological filters; schema/ref injection; cache poisoning; SSRF through OpenAPI external refs or webhook targets; speculative LLM agents hitting arbitrary paths; leaked session tokens; host header forgery; exposing unsanitized upstream example secrets/PII.

Minimum controls:

1. Only build-reviewed, pinned specs may define runtime operations. Never fetch a client-supplied OpenAPI URL at runtime.
2. Safe `$ref` resolution in build CI: allowlisted origins, max depth/size, source SHA verification, no localhost/private network access, no arbitrary filesystem traversal.
3. Strict request body size (e.g. 256 KiB), maximum list limit (e.g. 100), max nested filter complexity, finite response size and configured request time.
4. Validate all sandbox writes; parameterize D1 SQL; no request-provided SQL, JS, `eval` or arbitrary JSONPath execution.
5. Use actual request origin/host only after validating expected hostname; never echo attacker-supplied `Host`/forwarded headers into trusted `href` links.
6. No outbound webhook delivery initially. If later built, outbound targets must use strong allowlists/ownership verification, re-resolved DNS checks and blocked private IP ranges. No SSRF.
7. Configure CORS for public GET (wildcard origin okay where no credentials) but avoid credentialed wildcard CORS. Session bearer tokens must not be exposed to arbitrary origins via an overly permissive sandbox endpoint.
8. Sandbox auth token only in Authorization header; never log it. Store token hashes, use HTTPS, expire/revoke sessions.
9. Clear attribution/licensing and fully synthetic scenario data; vet upstream example payloads for production secrets.
10. Never run user-supplied scripts/plugins from specs or documents.

## 12. Build tools and dependency suggestions

**Runtime:** TypeScript, Hono, Wrangler, native Fetch/URL/Web Crypto, Workers Static Assets binding. D1 only in phase 2.

**Offline toolchain:** Node.js LTS; TypeScript; YAML parser (`yaml`); robust OpenAPI parser/bundler (Redocly CLI and/or Swagger Parser); Swagger 2 converter (`swagger2openapi` where needed); schema validator (`ajv` / `ajv-formats` or a tool that understands OAS dialect quirks); fixture sampler (`openapi-sampler` or `json-schema-faker`) **offline**; Vitest; MSW/Miniflare/Wrangler local runtime tests. [Prism](https://github.com/stoplightio/prism) is useful to benchmark mock generation and validate your approach, but keeping Prism 159 times at runtime is not the lean Worker design.

**Version policy:** Pin exact package versions in `package-lock.json` and `spec-lock.json`. Do not handpick dependency major versions from this document without checking compatibility. Build a spike around actual TMF629 v4/v5 and TMF620 v4/v5 specs before standardizing the converter and schema-validation stack.

**GitHub Actions:** compile, validate, test and deploy only reviewed green artifacts. Run source discovery periodically with a pull-request report; public GitHub API has rate limits, so authenticate CI access with a repository token where appropriate. Runtime must function without GitHub access.

## 13. CI, proof of completeness, and measurable acceptance criteria

### CI jobs

- `catalog-check`: **104 unique IDs**, exact category counts, **159** version pairs (baseline mode), valid versions, no duplicate pairs, metadata consistency.
- `source-audit`: for every target pair, source provenance + license evidence + pin/hash or explicit `BLOCKED` reason.
- `compile`: parse, bundle, extract method/paths, validate no route collision and all source operations accounted for.
- `schema-check`: verify each generated fixture has an allowed content type and schema-valid content when a schema exists.
- `routing-check`: for all compiled path templates, test literal paths and parameterized paths, methods and version selection.
- `scenario-check`: list/detail consistency, valid links, known-case relationships, stable IDs, both v4 and v5 when present.
- `security-check`: wrong token, expired session, body size, unknown operation, SSRF attempts, CORS, path traversal.
- `free-tier-smoke`: deploy to a test Worker, check actual bundle/static asset sizes and representative CPU timings.
- `coverage-report`: generate HTML and JSON showing **all 159 target pairs** and achieved support levels. No private partial failures hidden in CI output.

### Definition of done: contract-coverage project

A pair reaches `CONTRACT_MOCKED` only when **100% of operations in its pinned source contract** are enumerated and each has a callable result respecting its declared status/media semantics. Responses with machine-readable schemas must validate, or be explicitly reported as unresolved. **No silent stubs** that return HTTP 200 with `{}` for every route.

Project-wide "all versions supported" requires:

1. All 104 directory entries represented in discoverable `/catalog`.
2. All 159 pairs have resolved, licensed, pinned source contracts or a source-status exception clearly disclosed; **source exceptions mean the 159-contract goal is not complete**.
3. For all resolved contracts, 100% declared HTTP operations appear in generated route index and pass contract-smoke tests.
4. An independent count of `compiledOperations`, `passedOperations`, `failedOperations` and `blockedOperations` appears in CI and public docs.
5. Stable linkable scenario data works for the seed graph, including v4/v5 variations where available.
6. All resource mutation methods, if advertised, are isolated and consistent in sandbox mode.
7. No unauthenticated shared-data writes; no production external API calls; Free plan deploys without required credit card spend beyond what the provider's signup process may request.

**Coverage formula:**

```text
catalogCoverage        = listedPairs / expectedPairs             # 159/159 from baseline
sourceCoverage         = sourceVerifiedPairs / expectedPairs
contractCoverage       = contractMockedPairs / expectedPairs
operationCoverage      = passedDeclaredOperations / declaredOperationsFromResolvedSpecs
behavioralCoverage     = separately enumerated hand-curated operations/scenarios
```

Do not conflate `catalogCoverage = 100%` with `contractCoverage = 100%`.

## 14. Implementation order, without shrinking end scope

### Phase A: inventory and source lock (do first)

- Import `catalog.json` and validate 104/159 counts.
- Implement GitHub organization API discovery and official-version fallback workflow.
- Produce `source-gaps.json`, with one line per unresolved pair.
- Pin source SHA/version/license and capture sources for **all 159 targets** that can be legally obtained.
- Export a map of OAS versions, repo availability, operation counts, paths, webhooks, and special assets. This is a valuable standalone deliverable even before HTTP hosting.

### Phase B: compiler proof, then mass generation

- Test exact specs for TMF629 v4/v5, TMF620 v4/v5, TMF641 v4/v5, and an old v1 or v2 spec (when sourced) to exercise both Swagger 2 and OAS 3.
- Implement multi-file ref handling, route extraction, fixture generation and schema checks.
- **Run the same compiler across every resolved pair automatically**, not manual API-by-API implementations.
- Emit route/fixture artifacts, failure report and completeness evidence for all 159 targeted pairs.

### Phase C: zero-dollar public launch

- Deploy Worker/Hono router and Static Assets to `workers.dev`.
- Expose all compiler-passed contract mocks, per-pair status and source/asset links.
- Add static docs with API/version browser, curl examples and coverage report.
- Keep public mode fully immutable, predictable and no-auth.

### Phase D: data coherence and RAG demonstration

- Build fiber-outage and fulfilled-order canonical scenarios.
- Map high-value APIs into version-specific output schemas.
- Test customer -> product -> service -> resource -> ticket/order links.
- Publish RAG documents and walkthrough of tool-calling against hosted APIs.

### Phase E: optional write sandboxes

- Add D1 schema, session tokens, TTL, quotas and overlay semantics.
- Enable only verbs declared by each source contract and test every declared writable operation type.
- Add safe domain-specific behavior for selected APIs, starting with trouble tickets and service orders.
- Do not expand into dozens of handwritten lifecycle adapters until cross-API read behavior is solid.

### Phase F: future updates

- Scheduled source discovery with PRs, updated release list and compatibility matrices.
- Optional controllable error injection (`x-mock-scenario: rate-limit`, `x-mock-latency`), **sandbox only** and bounded.
- Optional generated MCP server/tool manifests derived from catalog for agent use, separate from core platform.
- Optional conformance test kit integration for APIs with legally accessible CTKs.

## 15. Concrete developer commands (target CLI, to implement)

These are **planned commands**, not verified commands of an existing repository:

```bash
npm ci
npm run catalog:check
npm run sources:discover
npm run sources:lock          # review URLs/license/hashes before accepting
npm run sources:audit
npm run specs:compile
npm run fixtures:validate
npm run test
npm run dev
npm run coverage
npm run deploy               # must require explicit human approval for production
```

**Expected artifacts after `specs:compile`:** `generated/manifest.json`, per-pair route and fixture assets, bundled OpenAPI docs, `generated/reports/coverage.json`, and `generated/reports/exceptions.json`. CI fails if a previously `CONTRACT_MOCKED` pair regresses or an operation silently disappears.

### Suggested `GET /coverage` response

```json
{
  "catalogSnapshot": "2026-10-22",
  "expectedApiCount": 104,
  "expectedMajorPairs": 159,
  "sourceVerifiedPairs": 0,
  "contractMockedPairs": 0,
  "seededPairs": 0,
  "totalDeclaredOperations": null,
  "passedOperations": 0,
  "blockedPairs": [],
  "isComplete": false
}
```

`null` means the tool has **not yet computed** the denominator, not zero operations. Fill these numbers from actual compilation, never from aspirational estimates.

## 16. Architecture alternatives and decisions

| Option | Benefits | Problems for this goal | Decision |
|---|---|---|---|
| Prism instance per contract | Mature examples and validations | 159 processes / difficult free hosting / isolated state | Offline reference only |
| Java Spring Boot unified mock | Familiar tools, JVM schemas | Always-on infra, large footprint, cost | No for zero-dollar service |
| Cloudflare Worker with all specs in JS | Simple in principle | Bundle/startup cost, CPU spent parsing huge OAS | Reject |
| Cloudflare Worker + static generated artifacts | Tiny runtime, one deploy, cacheable specs and fixtures | Requires solid offline compiler | **Choose** |
| Cloudflare Worker + D1 for all GET | Simple dynamic DB retrieval | Unnecessary reads/cost for immutable examples | Only for private sandboxes |
| Static JSON only / no dynamic router | Free unlimited assets | Poor filtering, parameterized IDs and CRUD behavior | Good fallback, not whole service |
| Full business simulation for 104 APIs | Realistic interactions | Extremely high implementation/maintenance cost | Hand-curated subset after generic coverage |

## 17. Open questions and explicit choices to preserve

| Question | Default decision | Reason |
|---|---|---|
| Every patch or every listed major? | Listed majors, pinned latest usable patch | Directory displays majors only |
| Missing official specification? | `BLOCKED` and visible; no invented schema | Trustworthiness |
| Preview versions? | Include with preview badge if downloadable/allowed | User wants *all* directory versions |
| Public authentication? | None for GET | Agent onboarding friction |
| Writes? | Sandbox token only, phase E | Prevent contamination |
| Data storage public GET? | No D1 | Keep free and fast |
| Schema generation location? | Build-time | 10 ms Worker CPU and stability |
| Should all API data be cross-linked? | Selected seeded scenarios only | 104-domain semantic mapping infeasible initially |
| Is project officially TM Forum? | No; independent brand/disclaimer | Trademark prudence |
| How to claim "supported"? | Discrete per-pair support levels | Avoid false completeness claims |

## 18. Primary source bibliography and checkpoints

Read these before coding anything that depends on release details:

1. TM Forum official Open API directory: https://www.tmforum.org/open-digital-architecture/open-apis
2. TM Forum Open API overview and shared schema model: https://www.tmforum.org/oda/open-apis/ and https://www.tmforum.org/oda/governance/api-governance
3. Public GitHub organization: https://github.com/tmforum-apis
4. TMF629 v4/v5 concrete repository: https://github.com/tmforum-apis/TMF629_CustomerManagement
5. TMF620 v4/v5 concrete repository: https://github.com/tmforum-apis/TMF620_ProductCatalog
6. TMF635 v4/v5 concrete repository: https://github.com/tmforum-apis/TMF635_UsageManagement
7. TMF770 official v5 release: https://www.tmforum.org/open-digital-architecture/open-apis/fraud-management-api-TMF770/v5.0
8. TMF777 official v5 preview: https://www.tmforum.org/open-digital-architecture/open-apis/outage-management-api-TMF777/v5.0
9. TM Forum terms/trademark: https://tmforum.org/legal/website-terms-of-use
10. Cloudflare Workers current limits: https://developers.cloudflare.com/workers/platform/limits/
11. Worker static-asset binding: https://developers.cloudflare.com/workers/static-assets/binding/
12. Worker static-asset billing: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
13. Cloudflare D1 free pricing: https://developers.cloudflare.com/d1/platform/pricing/
14. Stoplight Prism reference: https://github.com/stoplightio/prism
15. Redocly CLI spec bundling: https://redocly.com/docs/cli/commands/bundle

**Freshness note:** Vendor pricing and API release versions can change after 2026-10-22. Upstream per-repo file presence was only spot-checked, **not** exhaustively verified for all 159 pairs in preparing this design. The implementation agent must perform discovery and source verification before claiming deployed coverage.

---

## Appendix A: Complete inventory (user-provided, 2026-10-22)

The listing below is supplied-directory evidence, not proof that a given OpenAPI file is available through the public mirror.

### Marketing Sales (1)

| API | Display name | Directory versions |
|---|---|---|
| TMF699 | Sales Management API | v4, v5 |

### Customer (14)

| API | Display name | Directory versions |
|---|---|---|
| TMF646 | Appointment Management API | v4, v5 |
| TMF678 | Customer Bill Management API | v4, v5 |
| TMF629 | Customer Management API | v4, v5 |
| TMF717 | Customer360 Management API | v4, v5 |
| TMF770 | Fraud Managment API | v5 |
| TMF676 | Payment Management API | v1, v4 |
| TMF670 | Payment Method Management API | v4 |
| TMF654 | Prepay Balance Management API | v4 |
| TMF760 | Product Configuration Management API | v5 |
| TMF622 | Product Ordering Management API | v4, v5 |
| TMF648 | Quote Management API | v4, v5 |
| TMF680 | Recommendation Management API | v2, v4 |
| TMF696 | Risk Management API | v4, v5 |
| TMF663 | Shopping Cart Management API | v4, v5 |

### Product (10)

| API | Display name | Directory versions |
|---|---|---|
| TMF658 | Loyalty Management API | v4, v5 |
| TMF936 | Open Gateway Product Catalog API | v5 |
| TMF937 | Open Gateway Product Usage API | v5 |
| TMF620 | Product Catalog Management API | v4, v5 |
| TMF637 | Product Inventory Management API | v4, v5 |
| TMF679 | Product Offering Qualification Management API | v4, v5 |
| TMF767 | Product Usage Catalog Management API | v5 |
| TMF635 | Product Usage Management API | v4, v5 |
| TMF671 | Promotion Management API | v4, v5 |
| TMF677 | Usage Consumption Management API | v5 |

### Service (13)

| API | Display name | Directory versions |
|---|---|---|
| TMF924 | DCS 5GSlice Service Activation API | v4 |
| TMF914 | IoT Service Management API | v4 |
| TMF909 | Network as a Service Management API | v3, v4 |
| TMF777 | Outage Management API | v5 |
| TMF640 | Service Activation Management API | v4, v5 |
| TMF633 | Service Catalog Management API | v3, v4 |
| TMF638 | Service Inventory Management API | v5 |
| TMF641 | Service Ordering Management API | v4, v5 |
| TMF656 | Service Problem Management API | v5 |
| TMF645 | Service Qualification Management API | v4, v5 |
| TMF657 | Service Quality Management Management API | v1, v4 |
| TMF653 | Service Test Management API | v4, v5 |
| TMF727 | Service Usage Management API | v4, v5 |

### Resource (16)

| API | Display name | Directory versions |
|---|---|---|
| TMF642 | Alarm Management API | v4, v5 |
| TMF908 | IoT Agent and Device Management API | v4 |
| TMF759 | Private Optimized Binding | v5 |
| TMF702 | Resource Activation Management API | v4, v5 |
| TMF634 | Resource Catalog Management API | v4, v5 |
| TMF664 | Resource Function Activation Management API | v4, v5 |
| TMF639 | Resource Inventory Management API | v4, v5 |
| TMF652 | Resource Order Management API | v4, v5 |
| TMF685 | Resource Pool Management API | v3, v5 |
| TMF689 | Resource Portability API | v5 |
| TMF761 | Resource Qualification API | v5 |
| TMF716 | Resource Reservation | v4 |
| TMF768 | Resource Role API | v5 |
| TMF771 | Resource Usage API | v5 |
| TMF730 | Software And Compute Management API | v4 |
| TMF687 | Stock Management API | v4, v5 |

### Business Partner (15)

| API | Display name | Directory versions |
|---|---|---|
| TMF666 | Account Management API | v4, v5 |
| TMF651 | Agreement Management API | v4 |
| TMF668 | Partnership Management API | v3, v4 |
| TMF683 | Party Interaction Management API | v4, v5 |
| TMF632 | Party Management API | v4, v5 |
| TMF669 | Party Role Management API | v4, v5 |
| TMF644 | Privacy Management API | v4, v5 |
| TMF736 | Revenue Sharing Algorithm Management API | v5 |
| TMF738 | Revenue Sharing Model Management | v5 |
| TMF737 | Revenue Sharing Report Management API | v5 |
| TMF711 | Shipment Management Management API | v4, v5 |
| TMF684 | Shipment Tracking Management API | v1 |
| TMF700 | Shipping Order Management API | v4 |
| TMF623 | SLA Management API | v2 |
| TMF713 | Work Management | v4, v5 |

### Common (35)

| API | Display name | Directory versions |
|---|---|---|
| TMF915 | AI Management API | v4 |
| TMF735 | CDR Transaction Management API | v5 |
| TMF655 | Change Management API | v3, v4 |
| TMF681 | Communication Management API | v3, v4 |
| TMF764 | Cost Management API | v5 |
| TMF720 | Digital Identity Management API | v4, v5 |
| TMF667 | Document Management API | v4, v5 |
| TMF728 | Dunning Case Management | v4, v5 |
| TMF662 | Entity Catalog Management API | v3, v4 |
| TMF703 | Entity Inventory Management API | v4 |
| TMF688 | Event Management API | v4 |
| TMF691 | Federated ID Management API | v4, v5 |
| TMF710 | General Test Artifact Management API | v4 |
| TMF673 | Geographic Address Management API | v4, v5 |
| TMF675 | Geographic Location Management API | v1, v4 |
| TMF674 | Geographic Site Management API | v4, v5 |
| TMF724 | Incident Management API | v4 |
| TMF921 | Intent Management API | v4, v5 |
| TMF725 | Metadata Catalog Management API | v4 |
| TMF931 | Open Gateway Onboarding and Ordering Component Suite | v5 |
| TMF628 | Performance Management API | v5 |
| TMF649 | Performance Thresholding Management API | v4, v5 |
| TMF701 | Process Management API | v4, v5 |
| TMF910 | Self Care Management API | v1 |
| TMF704 | Test Case Management API | v4 |
| TMF706 | Test Data Management API | v4 |
| TMF705 | Test Environment Management API | v4 |
| TMF708 | Test Execution Management API | v4 |
| TMF707 | Test Result Management API | v4 |
| TMF709 | Test Scenario Management API | v4 |
| TMF686 | Topology Management API | v4 |
| TMF621 | Trouble Ticket Management API | v4, v5 |
| TMF672 | User Role Permission Management API | v5 |
| TMF715 | Warranty Management | v4 |
| TMF714 | Work Qualification Management | v4 |


## Appendix B: Contract pair inventory and verification semantics

`catalog.json` contains exactly 104 records, each with `directory_major_versions`. Expand them as `(api_id, vMajor)` to obtain 159 pairs. Every pair begins `UNVERIFIED`; the source-discovery agent must populate a separate pinned `spec-lock.json` and never rewrite the user-supplied baseline to suggest all source files are already known.
