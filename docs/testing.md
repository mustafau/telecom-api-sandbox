# Testing and release evidence

Use npm, the committed lockfile, and the Node version in `.node-version`.

```sh
npm ci
npm run format
npm run build
npm run lint
npm run typecheck
npm test
npm run verify:runtime
```

`build` audits every source hash, starts from empty generated directories, compiles all locked contracts, validates scenario projections, packs routes, and invokes every source-declared operation through the Worker Fetch handler. Explicit catalog source gaps are allowed; a failing locked contract is a build failure.

The regression suite covers malformed/missing baselines, newly locked failures, changed source hashes, source-equivalence property names, schema normalization, external-reference safety, route collisions, immutable mutations, and cross-API links. Direct npm dependencies must remain exact versions.

`verify:runtime` starts a local workerd server on port 8791, runs the complete HTTP suite, performs a Wrangler bundle dry run, and stops the server. Set `RUNTIME_CHECK_PORT` if needed. The Node preview is available through `npm run dev:node`, but it does not establish workerd acceptance.

## Generated evidence

Reports are under `generated/reports/` and are uploaded by the GitHub Actions workflow. They are excluded from the source repository. Normal builds remove old evidence first.

- `coverage.json`: all target pairs, source/contract coverage, operation results, bodyless versus schema-validated responses, and scenario read coverage.
- `integration-failures.json`, `exceptions.json`, `scenario-exceptions.json`: concrete failures and limitations.
- `http-smoke.json`, `runtime.json`: results from the actual local workerd HTTP test and bundle dry run.
- `free-tier.json`: measured local asset/module sizes and local handler timing; production CPU is explicitly unmeasured.

Coverage, HTTP, runtime, and free-tier reports identify the Git revision when available, a content fingerprint of build inputs, the lock hash, and the trusted origin. Exception lists accompany those reports in the same artifact. Changing those inputs requires a rebuild. Local source archives without Git metadata still have a content fingerprint.

## Updating an accepted baseline

The baseline is required, nonempty, and validated. It records accepted source hashes and declared operation counts. Missing or malformed baselines cannot turn regression checks off.

An intentional source refresh can make verification fail against the previous baseline even when the new source's operations pass. Review the generated report, source edition, license evidence, and operation diff first. The baseline command only accepts a fresh report in which every locked contract passed:

```sh
npm run coverage:baseline
npm run build
npm run verify:runtime
```

Include the baseline change and rationale in the pull request. CI must pass using the updated baseline. Baseline updates never excuse failing operations or unavailable licenses.
