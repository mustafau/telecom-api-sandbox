import { Hono } from 'hono';
import runtime from '../../../generated/runtime.json';
import { createMatcher } from './route-matcher.js';
import type { Env, Operation } from './types.js';

const app = new Hono<{ Bindings: Env }>();
const match = createMatcher(runtime as Operation[]);
const asset = (env: Env, path: string) =>
  env.ASSETS.fetch(new Request(`https://assets.invalid${path}`));
const error = (status: number, message: string, extra: Record<string, string> = {}) =>
  Response.json(
    { error: message },
    { status, headers: { 'Access-Control-Allow-Origin': '*', ...extra } },
  );

app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header(
    'Access-Control-Expose-Headers',
    'X-Mock-Mode, X-Contract-Version, X-Contract-SHA256, X-Total-Count, X-Result-Count',
  );
  c.header('X-Content-Type-Options', 'nosniff');
});
app.get('/healthz', (c) => c.json({ status: 'ok', mode: 'immutable-contract-mock' }));
app.get('/coverage', (c) => asset(c.env, '/coverage.json'));
app.get('/catalog', (c) => asset(c.env, '/catalog.json'));
app.get('/catalog/:apiId/:major/openapi.json', (c) => {
  if (!/^TMF\d{3}$/.test(c.req.param('apiId')) || !/^v[1-5]$/.test(c.req.param('major')))
    return error(404, 'Unknown contract');
  return asset(c.env, `/specs/${c.req.param('apiId')}/${c.req.param('major')}/openapi.json`);
});
app.get('/catalog/:apiId/:major', async (c) => {
  const data: any = await (await asset(c.env, '/catalog.json')).json();
  const api = data.apis.find((a: any) => a.api_id === c.req.param('apiId'));
  const version = api?.versions.find((v: any) => v.major === c.req.param('major'));
  if (!version) return error(404, 'Unknown catalog pair');
  const operations = await asset(
    c.env,
    `/operations/${c.req.param('apiId')}/${c.req.param('major')}.json`,
  );
  const sources: any = await (await asset(c.env, '/sources.json')).json();
  return c.json({
    apiId: api.api_id,
    name: api.name,
    ...version,
    source: sources.find((s: any) => s.apiId === api.api_id && s.major === version.major) ?? null,
    operations: operations.ok ? await operations.json() : [],
  });
});
app.get('/scenarios', (c) => asset(c.env, '/scenarios/index.json'));
app.get('/scenarios/:name', (c) =>
  /^[a-z0-9-]+$/.test(c.req.param('name'))
    ? asset(c.env, `/scenarios/${c.req.param('name')}.json`)
    : error(404, 'Unknown scenario'),
);
app.get('/docs', (c) => c.redirect('/docs/'));

app.all('*', async (c) => {
  const url = new URL(c.req.url);
  const result = match(c.req.method, url.pathname);
  if (!result.operation) {
    if (c.req.method === 'OPTIONS' && result.allowed.length)
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': result.allowed.join(', '),
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
          Allow: result.allowed.join(', '),
        },
      });
    if (result.allowed.length)
      return error(405, 'Method not declared by this contract', {
        Allow: result.allowed.join(', '),
      });
    // Unknown API routes must never fall through to a docs HTML fallback.
    if (url.pathname.startsWith('/tmf-api/') || url.pathname.startsWith('/s/'))
      return error(404, 'No compiled operation at this path');
    return asset(c.env, url.pathname);
  }
  const operation = result.operation;
  const declared = operation.parameters.filter((p) => p.in === 'query').map((p) => p.name);
  const supported = ['offset', 'limit'];
  for (const name of url.searchParams.keys()) {
    if (!declared.includes(name)) return error(400, `Query parameter is not declared: ${name}`);
    if (!supported.includes(name))
      return error(400, `Query behavior is unavailable in contract mode: ${name}`);
    if (
      !/^\d+$/.test(url.searchParams.get(name)!) ||
      !Number.isSafeInteger(Number(url.searchParams.get(name)))
    )
      return error(400, `Invalid pagination parameter: ${name}`);
  }
  const accept = c.req.header('Accept');
  if (accept && operation.mediaType) {
    const actualType = operation.mediaType.split(';')[0].trim().toLowerCase();
    const accepted = accept.split(',').some((item) => {
      const [rawType, ...parameters] = item.trim().split(';');
      const type = rawType.trim().toLowerCase();
      if (parameters.some((p) => /^\s*q=0(?:\.0*)?\s*$/.test(p))) return false;
      return type === '*/*' || type === actualType || type === `${actualType.split('/')[0]}/*`;
    });
    if (!accepted) return error(406, 'Requested media type is unavailable');
  }
  const headers = new Headers(operation.headers);
  headers.set('X-Mock-Mode', operation.seeded ? 'immutable-seeded' : 'immutable-contract');
  headers.set('X-Contract-Version', operation.exactVersion);
  headers.set('X-Contract-SHA256', operation.contractSha256);
  headers.set(
    'Cache-Control',
    ['GET', 'HEAD'].includes(c.req.method) ? 'public, max-age=60' : 'no-store',
  );
  if (!operation.fixture) return new Response(null, { status: operation.status, headers });
  const fixture = await asset(c.env, operation.fixture);
  if (!fixture.ok) return error(503, 'Compiled fixture is unavailable');
  if (!operation.seeded && !url.searchParams.size && operation.mediaType?.includes('json')) {
    headers.set('Content-Type', operation.mediaType);
    return new Response(fixture.body, { status: operation.status, headers });
  }
  let value: any = await fixture.json();
  if (operation.seeded && !Array.isArray(value)) {
    const template = operation.pathTemplate.split('/').filter(Boolean),
      actual = url.pathname.split('/').filter(Boolean);
    const idIndex = template.indexOf('{id}');
    if (idIndex >= 0 && decodeURIComponent(actual[idIndex]) !== String(value.id))
      return error(404, 'Unknown synthetic record ID');
  }
  if (url.searchParams.size && !Array.isArray(value))
    return error(400, 'Pagination is available only for collections');
  if (Array.isArray(value)) {
    const count = value.length,
      offset = Number(url.searchParams.get('offset') ?? 0),
      limit = Number(url.searchParams.get('limit') ?? count);
    value = value.slice(offset, offset + limit);
    // Count headers are emitted only where declared in the source.
    if (headers.has('X-Total-Count')) headers.set('X-Total-Count', String(count));
    if (headers.has('X-Result-Count')) headers.set('X-Result-Count', String(value.length));
  }
  headers.set('Content-Type', operation.mediaType!);
  return new Response(
    operation.mediaType?.includes('json') ? JSON.stringify(value) : String(value),
    { status: operation.status, headers },
  );
});
export default app;
