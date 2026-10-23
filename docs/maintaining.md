# Publishing and maintaining

## First public repository

Run the full [verification pipeline](testing.md) from a clean checkout or source copy. Check that `git status` includes source code, docs, catalog records, the npm lockfile, and licensed upstream sources. Generated directories, local caches, and credentials remain ignored. The original design ZIP/handoff are not part of the public source tree; the preserved proposal is under `docs/design/`.

After creating the GitHub repository:

1. Require the **Verify pinned contracts / verify** status check before merging to the default branch.
2. Enable Dependabot alerts/security updates, secret scanning/push protection, and private vulnerability reporting where available.
3. Review the npm and GitHub Actions update pull requests from `.github/dependabot.yml`. Exact versions and immutable action references remain enforced by policy and CI. Major npm updates are kept separate from grouped minor/patch updates.
4. Add repository topics and a description using the independent Telecom API Sandbox name. Publish the current supported counts and gaps accurately.
5. Review the weekly **Check upstream sources** job summaries/artifacts for new candidates, changed HEADs, and incomplete scans. This workflow observes sources; maintainers accept changes through the [source workflow](sources.md#monitoring-upstream).

These repository settings require a GitHub repository and maintainer permissions; local configuration files do not enable them by themselves. See [GitHub's repository security guide](https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository).

## Release

Review the changelog and source/license changes, ensure CI is green for the exact revision, and create the release manually. Attach the corresponding CI coverage and static-asset artifacts if useful. The static-asset archive includes `public/`, the project's `LICENSE`, and `NOTICE`; preserve those notices when redistributing it. The workflow uploads artifacts but does not create tags, publish releases, or deploy.

Do not describe all 159 target pairs as implemented while source gaps remain. Response-schema validation, bodyless status checks, seeded scenarios, and business behavior are separate measures.

## Deployment

The default `npm run deploy` command refuses automatic publication. After explicit authorization, rebuild with the actual trusted Worker origin:

```sh
PUBLIC_ORIGIN=https://your-approved-worker.workers.dev npm run build
npm run verify:runtime
```

The authorized maintainer can then run `npx wrangler deploy`. This uses the installed, pinned Wrangler dependency. Check the current account plan, limits, request volume, and measured production CPU before claiming free-tier acceptance. No paid upgrade is authorized by this repository's tooling.
