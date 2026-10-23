# 0001: Compile offline and serve through one Worker

- Date: 2026-10-22
- Status: Accepted

## Context

The inventory spans 159 API/major pairs. Parsing their specifications and generating fixtures during HTTP requests would increase bundle size, startup work, and CPU use. Running a separate service per contract would add operational cost.

## Decision

Use TypeScript and Hono in one Cloudflare Worker, with Workers Static Assets for fixtures, normalized specs, and the explorer. Parse Swagger 2/OpenAPI 3.0, normalize, sample deterministically, and validate offline. Ship compact routing metadata to the runtime. Public requests require no database, upstream calls, or LLM service.

See [architecture](../architecture.md), [compiler](../../tools/compile.ts), and [Worker](../../apps/api-worker/src/index.ts).

## Alternatives considered

- One service per API/version: unnecessary deployment and maintenance overhead.
- Runtime schema parsing/generation: more request-time work and less predictable responses.
- Static JSON alone: insufficient for parameterized routing, method semantics, and seeded IDs.

## Consequences

Sources must be rebuilt before changes become visible. Generated assets and route metadata must stay consistent. Build verification enumerates source operations; workerd HTTP checks verify the actual runtime. Hosting fit still requires measured production CPU after authorized deployment.
