# Contributing

Use npm and the committed `package-lock.json`. Direct dependencies use exact versions; preserve that policy in dependency updates.

```sh
npm ci
npm run build
npm run lint
npm run typecheck
npm test
npm run verify:runtime
```

The runtime check starts and stops a local Wrangler server, runs every generated operation over HTTP, and performs a bundle dry run. It requires an OS supported by workerd. `npm run dev:node` is available for development on other systems.

## Making changes

Review the [architecture decision records](docs/adr/README.md) for every change. Add or supersede an ADR only for a significant, lasting architectural choice with meaningful tradeoffs that existing records do not already cover. Routine fixes, dependency updates, individual source/context additions, and documentation edits need no new record when they follow existing decisions. Explain the review outcome briefly in the pull request. Use the [template](docs/adr/template.md) when a new record is justified. Repository agents follow [AGENTS.md](AGENTS.md).

Keep changes focused. Add regression tests for compiler, coverage, routing, or safety changes. Run `npm run format` before building so the recorded source fingerprint describes the code you test. Generated `public/`, `generated/`, `dist/`, and local caches are excluded from version control.

The runtime must stay small: parse schemas and generate fixtures offline. Preserve contract methods, paths, statuses, content types, versions, and source provenance. Describe incomplete behavior honestly in the coverage report and documentation.

## Adding or updating a source contract

1. Start with the [source workflow](docs/sources.md). Use discovered official repositories and actual downloadable artifacts.
2. Check the exact artifact's license and preserve LICENSE/NOTICE files. Do not bypass access restrictions or fabricate a missing specification.
3. Record the immutable upstream reference, original bytes, `info.version`, and SHA256. Explain same-version edition conflicts in the selection record.
4. Run the compiler and inspect fixture validation, operation changes, and scenario links. Every newly locked contract must pass; explicitly blocked catalog pairs remain visible.
5. For a deliberate change to an accepted source, follow the baseline review procedure in [testing](docs/testing.md). Include the reason and coverage diff in the pull request.

Do not edit `upstream/` to fix a schema. Put an explicit, reviewed compatibility rule in tooling, retain provenance, and add a regression test.

## Contributions and conduct

Project code is MIT licensed. Upstream specifications and derived artifacts retain their applicable licenses. Contributions are submitted under those respective licenses. Follow the [code of conduct](CODE_OF_CONDUCT.md) and use the [security policy](SECURITY.md) for sensitive reports.
