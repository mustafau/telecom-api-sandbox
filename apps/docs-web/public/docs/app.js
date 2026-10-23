import { exampleId, examplePath } from './example-path.js';

const $ = (id) => document.getElementById(id);
let catalog,
  operations = [],
  projections = [];
const text = (tag, value) => {
  const e = document.createElement(tag);
  e.textContent = value;
  return e;
};
async function load() {
  const [coverage, data, scenarioIndex] = await Promise.all(
    ['/coverage', '/catalog', '/scenarios'].map(async (path) => {
      const r = await fetch(path);
      if (!r.ok) throw Error(`Failed to load ${path}`);
      return r.json();
    }),
  );
  const scenarios = await Promise.all(
    scenarioIndex.map(async (item) => {
      const r = await fetch(item.href);
      if (!r.ok) throw Error(`Failed to load ${item.href}`);
      return r.json();
    }),
  );
  projections = scenarios.flatMap((scenario) => scenario.projections ?? []);
  catalog = data;
  $('summary').replaceChildren();
  const stats = text('div', '');
  stats.className = 'stats';
  for (const [number, label] of [
    [`${coverage.sourceVerifiedPairs}/159`, 'Verified source contracts'],
    [`${coverage.contractMockedPairs}/159`, 'Contract mocks passing'],
    [coverage.passedOperations, 'Operations passing'],
    [coverage.blockedPairs.length, 'Blocked pairs'],
  ]) {
    const s = text('div', '');
    s.className = 'stat';
    s.append(text('b', number), text('span', label));
    stats.append(s);
  }
  $('summary').append(stats);
  render();
}
function render() {
  const query = $('search').value.toLowerCase();
  $('apis').replaceChildren();
  for (const api of catalog.apis.filter((a) =>
    `${a.api_id} ${a.name} ${a.category}`.toLowerCase().includes(query),
  )) {
    const row = document.createElement('tr');
    row.append(text('td', api.api_id), text('td', api.name), text('td', api.category));
    const versions = text('td', '');
    for (const version of api.versions) {
      const button = text('button', `${version.major} · ${version.state}`);
      button.className = `version ${version.state === 'CONTRACT_MOCKED' || version.state === 'SEEDED' ? 'good' : 'blocked'}`;
      button.onclick = () => select(api, version);
      versions.append(button);
    }
    row.append(versions);
    $('apis').append(row);
  }
}
async function select(api, version) {
  const r = await fetch(`/catalog/${api.api_id}/${version.major}`);
  const data = await r.json();
  operations = data.operations || [];
  $('explorer').hidden = false;
  $('selected').textContent = `${api.api_id} · ${version.major} · ${api.name}`;
  $('details').textContent =
    `${version.state} · pinned ${version.exactVersion || 'unavailable'} · ${operations.length} callable route variants`;
  $('reason').textContent =
    version.detail || (version.failures || []).map((f) => f.reason).join('; ');
  $('spec').href = `/catalog/${api.api_id}/${version.major}/openapi.json`;
  $('spec').hidden = !operations.length;
  $('operation').replaceChildren(
    ...operations.map((op, i) => {
      const option = text('option', `${op.method} ${op.pathTemplate}`);
      option.value = i;
      return option;
    }),
  );
  $('try').disabled = $('copy').disabled = !operations.length;
  updateCurl();
  $('explorer').scrollIntoView({ behavior: 'smooth' });
}
function selected() {
  const op = operations[Number($('operation').value)];
  if (!op) return;
  const id = exampleId(op, projections);
  return { ...op, url: location.origin + examplePath(op.pathTemplate, id) };
}
function updateCurl() {
  const op = selected();
  $('curl').textContent = op
    ? `curl -i -X ${op.method} '${op.url}'`
    : 'No compiled operations available.';
  $('response').textContent = '';
}
$('search').addEventListener('input', render);
$('operation').addEventListener('change', updateCurl);
$('copy').onclick = () => navigator.clipboard.writeText($('curl').textContent);
$('try').onclick = async () => {
  const op = selected();
  if (!op) return;
  try {
    const r = await fetch(op.url, {
      method: op.method,
    });
    $('response').textContent = `HTTP ${r.status}\n${await r.text()}`;
  } catch (e) {
    $('response').textContent = String(e);
  }
};
load().catch((e) => {
  $('summary').textContent = String(e);
});
