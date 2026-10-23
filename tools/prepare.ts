import { cp, mkdir, rm } from 'node:fs/promises';
import { buildIdentity } from './build-identity.js';
import { save } from './lib.js';
import { readBaseline } from './verification-policy.js';

await readBaseline();
// Both directories are ignored build output; checked-in web sources live in apps/.
await rm('public', { recursive: true, force: true });
await rm('generated', { recursive: true, force: true });
await mkdir('generated/reports', { recursive: true });
await cp('apps/docs-web/public', 'public', { recursive: true });
const identity = await buildIdentity();
await save('generated/build-info.json', identity);
await save('public/build-info.json', identity);
console.log('Prepared clean build outputs and recorded the source fingerprint.');
