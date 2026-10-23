import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, sep } from 'node:path';
import app from '../apps/api-worker/src/index.js';

const root = resolve('public');
const types: Record<string, string> = {
  '.json': 'application/json',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};
const ASSETS = {
  fetch: async (request: Request) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      let file = resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(root + sep)) return new Response(null, { status: 400 });
      if ((await stat(file)).isDirectory()) file += '/index.html';
      const extension = file.slice(file.lastIndexOf('.'));
      return new Response(await readFile(file), {
        headers: { 'Content-Type': types[extension] ?? 'application/octet-stream' },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  },
};
const port = Number(process.env.PORT ?? 8787);
const server = createServer(async (incoming, outgoing) => {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    // Public immutable mocks do not consume request bodies.
    incoming.resume();
    const request = new Request(`http://localhost:${port}${incoming.url}`, {
      method: incoming.method,
      headers,
    });
    const response = await app.fetch(request, { ASSETS });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500);
    outgoing.end('Local preview error');
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Node preview: http://localhost:${port}/docs/ (Hono Fetch adapter; not workerd)`),
);
