import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { assertSameBuild, buildIdentity } from './build-identity.js';
import { json, save } from './lib.js';
import type { BuildIdentity } from './models.js';

const build = await json<BuildIdentity>('generated/build-info.json');
assertSameBuild(build, await buildIdentity());
const coverage = await json('generated/reports/coverage.json');
assert.equal(coverage.failedOperations, 0);
const port = Number(process.env.RUNTIME_CHECK_PORT ?? 8791);
assert(Number.isInteger(port) && port > 1024 && port < 65536);
const origin = `http://127.0.0.1:${port}`;
await mkdir('.cache', { recursive: true });
const logs: string[] = [];
const server = spawn(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--local',
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--log-level',
    'error',
    '--persist-to',
    '.wrangler/runtime-check',
  ],
  {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  },
);
server.stdout.on('data', (chunk) => logs.push(chunk.toString()));
server.stderr.on('data', (chunk) => logs.push(chunk.toString()));
let ended = false;
server.on('exit', () => {
  ended = true;
});
const run = (args: string[], env = process.env) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Command failed with exit code ${code}: ${args.join(' ')}`)),
    );
  });
try {
  let ready = false;
  for (let attempt = 0; attempt < 180 && !ended; attempt++) {
    try {
      const response = await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(500) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Poll until workerd starts or the bounded deadline expires. */
    }
    await delay(500);
  }
  assert(ready, 'workerd could not start; inspect .cache/workerd.log (a supported OS is required)');
  await run(['--import', 'tsx', 'tools/http-smoke.ts'], { ...process.env, SMOKE_ORIGIN: origin });
  await run(['node_modules/wrangler/bin/wrangler.js', 'deploy', '--dry-run', '--outdir', 'dist'], {
    ...process.env,
    WRANGLER_SEND_METRICS: 'false',
  });
  const smoke = await json('generated/reports/http-smoke.json');
  assertSameBuild(smoke.build, build);
  const bundleBytes = (await stat('dist/index.js')).size;
  assert(bundleBytes <= 64 * 1024 * 1024, 'Worker bundle exceeds the checked free-tier size limit');
  const wrangler = JSON.parse(await readFile('node_modules/wrangler/package.json', 'utf8'));
  const report = {
    build,
    status: 'PASS',
    runtime: 'workerd',
    platform: process.platform,
    wranglerVersion: wrangler.version,
    passedOperations: smoke.passed,
    totalOperations: smoke.operations,
    metaEndpoints: smoke.metaEndpoints,
    bundleBytes,
    productionDeployed: false,
    cloudflareCpuMs: null,
  };
  await save('generated/reports/runtime.json', report);
  const assets = await json('generated/reports/free-tier.json');
  assert(assets.assetLimitsPass, 'Static assets exceed the checked free-tier limits');
  await save('generated/reports/free-tier.json', {
    ...assets,
    workerBundleBytes: bundleBytes,
    moduleSizeLimitPass: true,
    localWorkerdIntegration: 'PASS',
    status: 'LOCAL_ASSET_AND_MODULE_LIMITS_PASS; PRODUCTION_CPU_NOT_MEASURED',
  });
  const publicCoverage = await json('public/coverage.json');
  publicCoverage.runtime = report;
  await save('public/coverage.json', publicCoverage);
  await save('generated/reports/coverage.json', publicCoverage);
  console.log(
    `workerd: ${smoke.passed}/${smoke.operations} operations passed; bundle ${bundleBytes} bytes.`,
  );
} catch (error) {
  await save('generated/reports/runtime.json', {
    build,
    status: 'FAIL',
    reason: String(error),
    productionDeployed: false,
  });
  throw error;
} finally {
  await writeFile('.cache/workerd.log', logs.join(''));
  if (server.pid && !ended) {
    try {
      if (process.platform === 'win32') server.kill('SIGTERM');
      else process.kill(-server.pid, 'SIGTERM');
    } catch {
      /* The process may already have exited. */
    }
    for (let attempt = 0; attempt < 20 && !ended; attempt++) await delay(100);
    if (!ended) {
      try {
        if (process.platform === 'win32') server.kill('SIGKILL');
        else process.kill(-server.pid, 'SIGKILL');
      } catch {
        /* Already exited. */
      }
    }
  }
}
