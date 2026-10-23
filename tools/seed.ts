import { cp, mkdir } from 'node:fs/promises';
import type { Operation } from '../apps/api-worker/src/types.js';
import { json, key, save } from './lib.js';
import { resolveRef, sample, validatorFor } from './schema.js';

const origin = process.env.PUBLIC_ORIGIN ?? 'http://localhost:8787';
const parsedOrigin = new URL(origin);
if (
  !['http:', 'https:'].includes(parsedOrigin.protocol) ||
  parsedOrigin.pathname !== '/' ||
  parsedOrigin.search ||
  parsedOrigin.hash ||
  parsedOrigin.username ||
  parsedOrigin.password
)
  throw new Error('PUBLIC_ORIGIN must be a bare trusted HTTP(S) origin');
const graph = await json('scenarios/support-fiber-outage/canonical.json');
const manifest: Operation[] = await json('generated/manifest.json');
const definitions = [
  { apiId: 'TMF632', resource: 'individual', type: 'Individual', entity: 'party' },
  { apiId: 'TMF629', resource: 'customer', type: 'Customer', entity: 'customer' },
  { apiId: 'TMF620', resource: 'productOffering', type: 'ProductOffering', entity: 'offering' },
  { apiId: 'TMF637', resource: 'product', type: 'Product', entity: 'product' },
  { apiId: 'TMF638', resource: 'service', type: 'Service', entity: 'service' },
  { apiId: 'TMF639', resource: 'resource', type: 'Resource', entity: 'resource' },
  { apiId: 'TMF621', resource: 'troubleTicket', type: 'TroubleTicket', entity: 'ticket' },
  { apiId: 'TMF641', resource: 'serviceOrder', type: 'ServiceOrder', entity: 'order' },
];
const targets: any[] = [];
for (const definition of definitions)
  for (const major of ['v4', 'v5']) {
    const collection = manifest.find(
      (o) =>
        o.apiId === definition.apiId &&
        o.major === major &&
        o.method === 'GET' &&
        o.pathTemplate.endsWith(`/${definition.resource}`),
    );
    const detail =
      collection &&
      manifest.find(
        (o) =>
          key(o) === key(collection) &&
          o.method === 'GET' &&
          o.pathTemplate === `${collection.pathTemplate}/{id}`,
      );
    if (collection && detail)
      targets.push({
        ...definition,
        major,
        collection,
        detail,
        id: graph[definition.entity].id,
        href: `${origin}${collection.pathTemplate}/${graph[definition.entity].id}`,
      });
  }
const target = (entity: string, major: string) =>
  targets.find((t) => t.entity === entity && t.major === major) ??
  targets.find((t) => t.entity === entity);
const ref = (entity: string, major: string, type?: string) => {
  const t = target(entity, major);
  if (!t) throw new Error(`Missing scenario dependency: ${entity}`);
  return { id: t.id, href: t.href, '@type': type ?? `${t.type}Ref`, '@referredType': t.type };
};
const partyRole = (major: string, customer = true) => {
  const entity = customer ? 'customer' : 'party';
  return major === 'v4'
    ? { ...ref(entity, major, 'RelatedParty'), role: 'customer' }
    : {
        '@type': 'RelatedPartyRefOrPartyRoleRef',
        role: 'customer',
        partyOrPartyRole: ref(entity, major, customer ? 'PartyRoleRef' : 'PartyRef'),
      };
};
const exceptions: any[] = [],
  projections: any[] = [];
function properties(schema: any, doc: any, seen = new Set<any>()): any {
  const s = resolveRef(schema, doc);
  if (seen.has(s)) return {};
  seen.add(s);
  return Object.assign(
    {},
    ...(s.allOf ?? []).map((b: any) => properties(b, doc, seen)),
    s.properties ?? {},
  );
}
for (const t of targets) {
  try {
    const doc = await json(`public/specs/${t.apiId}/${t.major}/openapi.json`);
    const rawPath = Object.keys(doc.paths).find((p) => p === `/${t.resource}/{id}`)!;
    const detailResponse = resolveRef(
      doc.paths[rawPath].get.responses[String(t.detail.status)],
      doc,
    );
    const detailSchema = detailResponse.content[t.detail.mediaType].schema;
    const props = properties(detailSchema, doc);
    const entity = graph[t.entity];
    const overlay: any = {
      id: t.id,
      href: t.href,
      '@type': t.type,
      ...(entity.name ? { name: entity.name } : {}),
      ...(entity.description ? { description: entity.description } : {}),
    };
    switch (t.entity) {
      case 'party':
        Object.assign(overlay, { givenName: entity.givenName, familyName: entity.familyName });
        break;
      case 'customer':
        Object.assign(overlay, {
          engagedParty: ref('party', t.major, t.major === 'v5' ? 'PartyRef' : 'RelatedParty'),
          status: 'engaged',
        });
        break;
      case 'offering':
        Object.assign(overlay, { lifecycleStatus: 'Active', isBundle: false });
        break;
      case 'product':
        Object.assign(overlay, {
          status: 'active',
          productOffering: ref('offering', t.major),
          realizingService: [ref('service', t.major)],
          relatedParty: [partyRole(t.major)],
        });
        break;
      case 'service':
        Object.assign(overlay, {
          state: 'active',
          isServiceEnabled: false,
          supportingResource: [ref('resource', t.major)],
          relatedParty: [partyRole(t.major)],
          serviceOrderItem: [
            {
              '@type': 'RelatedServiceOrderItem',
              itemId: '1',
              serviceOrderId: graph.order.id,
              serviceOrderHref: target('order', t.major).href,
            },
          ],
        });
        break;
      case 'resource':
        Object.assign(overlay, {
          operationalState: t.major === 'v5' ? 'disabled' : 'disable',
          relatedParty: [partyRole(t.major)],
        });
        break;
      case 'ticket': {
        const relatedEntity = ['service', 'resource'].map((entity) => {
          const r = ref(entity, t.major, 'RelatedEntity');
          return t.major === 'v4'
            ? { ...r, role: 'affected' }
            : {
                '@type': 'RelatedEntity',
                role: 'affected',
                entity: { ...r, '@type': 'EntityRef' },
              };
        });
        Object.assign(overlay, {
          status: 'inProgress',
          severity: 'major',
          ticketType: 'incident',
          relatedParty: [partyRole(t.major)],
          relatedEntity,
          creationDate: graph.referenceTime,
          expectedResolutionDate: graph.outage.estimatedRestoration,
        });
        break;
      }
      case 'order':
        Object.assign(overlay, {
          state: 'inProgress',
          orderDate: graph.referenceTime,
          relatedParty: [partyRole(t.major)],
          serviceOrderItem: [
            {
              id: '1',
              action: 'modify',
              state: 'inProgress',
              service: ref('service', t.major, 'ServiceRefOrValue'),
            },
          ],
        });
        break;
    }
    const data = sample(detailSchema, doc, true);
    for (const [name, value] of Object.entries(overlay))
      if (props[name] || name === 'id' || name === 'href') data[name] = value;
    // Required nested fields are completed from this major's own schema.
    const validateDetail = validatorFor(detailSchema, doc);
    const notes: string[] = [];
    if (
      !validateDetail(data) &&
      t.major === 'v5' &&
      validateDetail.errors?.some(
        (e: any) => e.keyword === 'oneOf' && e.instancePath.startsWith('/relatedParty/'),
      )
    ) {
      delete data.relatedParty;
      notes.push(
        'Optional relatedParty omitted: the pinned PartyRefOrPartyRoleRef oneOf branches overlap, so the proposed reference fails strict JSON Schema validation. Canonical ownership remains available in scenario documents.',
      );
    }
    if (!validateDetail(data)) throw new Error(JSON.stringify(validateDetail.errors));
    const listResponse = resolveRef(
      doc.paths[`/${t.resource}`].get.responses[String(t.collection.status)],
      doc,
    );
    const listSchema = listResponse.content[t.collection.mediaType].schema;
    const validateList = validatorFor(listSchema, doc);
    if (!validateList([data])) throw new Error(JSON.stringify(validateList.errors));
    const fixture = `/fixtures/${t.apiId}/${t.major}/seed-${t.resource}.json`;
    await save(`public${fixture}`, data);
    await save(`public${fixture.replace('.json', '-list.json')}`, [data]);
    t.detail.fixture = fixture;
    t.detail.seeded = true;
    t.collection.fixture = fixture.replace('.json', '-list.json');
    t.collection.seeded = true;
    projections.push({
      apiId: t.apiId,
      major: t.major,
      resource: t.resource,
      id: t.id,
      href: t.href,
      collection: t.collection.pathTemplate,
      detail: t.detail.pathTemplate,
      fixture,
      state: 'SEEDED_READS',
      notes,
      links: [],
    });
  } catch (e) {
    exceptions.push({ apiId: t.apiId, major: t.major, entity: t.entity, reason: String(e) });
  }
}
// Do not publish a seeded graph whose references point to unavailable seeds.
const unavailable = new Set<string>();
for (const p of projections) {
  const data = await json(`public${p.fixture}`);
  const links: string[] = [];
  const visit = (x: any) => {
    if (x && typeof x === 'object') {
      if (typeof x.href === 'string' && x.href.startsWith(origin)) links.push(x.href);
      if (typeof x.serviceOrderHref === 'string') links.push(x.serviceOrderHref);
      Object.values(x).forEach(visit);
    }
  };
  visit(data);
  p.links = [...new Set(links)];
}
let changed = true;
while (changed) {
  changed = false;
  for (const p of projections)
    if (
      !unavailable.has(p.href) &&
      p.links.some(
        (l: string) =>
          !projections.some((other) => other.href === l && !unavailable.has(other.href)),
      )
    ) {
      unavailable.add(p.href);
      changed = true;
    }
}
for (const p of projections.filter((p) => unavailable.has(p.href))) {
  exceptions.push({
    apiId: p.apiId,
    major: p.major,
    reason: 'SCENARIO_REFERENCE_TARGET_UNAVAILABLE',
  });
  // Restore original generic operation metadata from pre-seed compiler output.
  const original = await json(`generated/operations/${p.apiId}/${p.major}.json`);
  for (const op of manifest.filter((o) => key(o) === key(p) && o.seeded))
    Object.assign(
      op,
      original.find((g: any) => g.method === op.method && g.pathTemplate === op.pathTemplate),
      { seeded: false },
    );
}
const valid = projections.filter((p) => !unavailable.has(p.href));
await save('generated/manifest.json', manifest);
await save(
  'generated/runtime.json',
  manifest.map(({ parameters, ...op }) => ({
    ...op,
    parameters: parameters.map(({ name, in: location, required }) => ({
      name,
      in: location,
      required,
    })),
  })),
);
await save('public/manifest.json', manifest);
for (const pair of new Set(manifest.map(key))) {
  const [apiId, major] = pair.split('/');
  await save(
    `public/operations/${apiId}/${major}.json`,
    manifest.filter((o) => key(o) === pair),
  );
}
await save('generated/reports/scenario-exceptions.json', exceptions);
await save('public/scenarios/support-fiber-outage.json', {
  id: graph.id,
  synthetic: true,
  referenceTime: graph.referenceTime,
  origin,
  state: valid.length ? 'PARTIAL_SEEDED_SCENARIO' : 'UNAVAILABLE',
  projections: valid,
  unavailable: exceptions,
  outageSource: graph.outage.source,
  documents: ['support-policy', 'outage-playbook', 'faq'].map(
    (name) => `/scenarios/support-fiber-outage/documents/${name}.md`,
  ),
});
await save('public/scenarios/index.json', [
  {
    id: graph.id,
    href: '/scenarios/support-fiber-outage',
    seededReadPairs: valid.length,
    synthetic: true,
  },
]);
await mkdir('public/scenarios/support-fiber-outage/documents', { recursive: true });
await cp(
  'scenarios/support-fiber-outage/documents',
  'public/scenarios/support-fiber-outage/documents',
  { recursive: true },
);
console.log(
  `Scenario: ${valid.length} schema-validated read projections; ${exceptions.length} disclosed exceptions. Trusted origin: ${origin}`,
);
