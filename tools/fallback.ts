import { json, mapLimit, save } from './lib.js';

const known = [
  {
    apiId: 'TMF641',
    major: 'v5',
    maturity: 'PREVIEW',
    url: 'https://www.tmforum.org/open-digital-architecture/open-apis/service-ordering-management-api-TMF641/v5.0',
  },
  {
    apiId: 'TMF777',
    major: 'v5',
    maturity: 'PREVIEW',
    url: 'https://www.tmforum.org/open-digital-architecture/open-apis/outage-management-api-TMF777/v5.0',
  },
  {
    apiId: 'TMF770',
    major: 'v5',
    maturity: 'STABLE',
    url: 'https://www.tmforum.org/open-digital-architecture/open-apis/fraud-management-api-TMF770/v5.0',
  },
];
const results = await mapLimit(
  [
    {
      apiId: null,
      major: null,
      maturity: null,
      url: 'https://www.tmforum.org/open-digital-architecture/open-apis',
    },
    ...known,
  ],
  2,
  async (page) => {
    try {
      const response = await fetch(page.url, {
        signal: AbortSignal.timeout(20_000),
        redirect: 'error',
      });
      const body = await response.text();
      const links = [...body.matchAll(/href=["']([^"']+)["']/gi)]
        .map((m) => {
          try {
            return new URL(m[1], page.url).href;
          } catch {
            return '';
          }
        })
        .filter((h) => /\.(json|ya?ml|zip)(?:\?|$)|swagger|download|openapi/i.test(h));
      return {
        ...page,
        status: response.status,
        observedAt: new Date().toISOString(),
        sourceLinks: [...new Set(links)],
        result: response.ok
          ? 'PAGE_READ; LINKS_REQUIRE_ARTIFACT_AND_LICENSE_REVIEW'
          : `HTTP_${response.status}; ACCESS_RESTRICTIONS_RESPECTED`,
      };
    } catch (e) {
      return {
        ...page,
        status: null,
        observedAt: new Date().toISOString(),
        sourceLinks: [],
        result: String(e),
      };
    }
  },
);
await save('catalog/official-source-review.json', results);
const gaps = await json('catalog/source-gaps.json');
for (const gap of gaps) {
  const page = results.find((r) => r.apiId === gap.apiId && r.major === gap.major) ?? results[0];
  gap.officialFallback = { url: page.url, result: page.result, sourceLinks: page.sourceLinks };
  if (page.apiId) gap.releaseMaturity = page.maturity;
}
await save('catalog/source-gaps.json', gaps);
console.log(results.map((r) => `${r.apiId ?? 'DIRECTORY'}: ${r.result}`).join('\n'));
