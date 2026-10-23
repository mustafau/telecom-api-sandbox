import { readFile } from 'node:fs/promises';
import YAML from 'yaml';
import { json, key, save, sha256 } from './lib.js';
import { canonicalContract } from './source-comparison.js';

const { candidates } = await json('catalog/source-candidates.json');
const selections: any[] = [];
// Compare normalized documents, retaining every validation keyword, method,
// path, response, and parameter. Only presentation annotations are ignored.
const groups = Map.groupBy(
  candidates.filter((c: any) => c.license === 'Apache-2.0' && !c.variantReview),
  (c: any) => `${key(c)}/${c.exactVersion}`,
);
for (const [_group, options] of groups) {
  if (options.length < 2 || new Set(options.map((o: any) => o.sha256)).size === 1) continue;
  const hashes = [];
  for (const option of options)
    hashes.push(
      sha256(
        JSON.stringify(canonicalContract(YAML.parse(await readFile(option.cachePath, 'utf8')))),
      ),
    );
  if (new Set(hashes).size === 1) {
    const sorted = options.sort((a: any, b: any) => a.upstreamFile.localeCompare(b.upstreamFile));
    selections.push({
      apiId: sorted[0].apiId,
      major: sorted[0].major,
      exactVersion: sorted[0].exactVersion,
      sha256: sorted[0].sha256,
      rationale:
        'Compared parsed documents after sorting object keys and excluding presentation annotations (description, summary, title, example(s), externalDocs). Routing and schema semantics are identical. Deterministic filename ordering selects exact bytes.',
      equivalentCandidates: sorted.map((o: any) => ({
        repo: o.repo,
        path: o.upstreamFile,
        sha256: o.sha256,
      })),
      semanticHash: hashes[0],
    });
  }
}
// The sole v1 geographic-location contract is explicitly reviewed rather than
// silently accepted by a filename heuristic. No admin counterpart is in tree.
const legacy = candidates.find(
  (c: any) =>
    c.apiId === 'TMF675' &&
    c.major === 'v1' &&
    c.upstreamFile === 'GeographicLocation.regular.swagger.json',
);
if (legacy?.license === 'Apache-2.0') {
  const doc = YAML.parse(await readFile(legacy.cachePath, 'utf8'));
  if (String(doc.info.version) !== '1.0.0' || !doc.paths)
    throw new Error('Legacy review no longer applies');
  selections.push({
    apiId: legacy.apiId,
    major: legacy.major,
    exactVersion: legacy.exactVersion,
    sha256: legacy.sha256,
    rationale:
      'Explicit legacy review: GeographicLocation.regular.swagger.json is the sole v1 Swagger contract in the actual TMF675 repository tree; info.version is 1.0.0. Repository README identifies these resources as the Apache-2.0 official API mirror. Only its declared operations are included; no admin semantics inferred.',
  });
}
const reviewedFiles: Record<string, { path: string; reason: string }> = {
  'TMF684/v1': {
    path: 'shipmentTracking_v10_Jan18_SwaggerValidatorPassed.json',
    reason:
      'The repository contains two info.version 1.0.0 documents, one explicitly prefixed OLD_. Pin the non-OLD file marked SwaggerValidatorPassed, already parsed as Swagger 2.0. Retain the OLD edition as an alternative in discovery; do not merge its schemas.',
  },
  'TMF670/v4': {
    path: 'TMF670_Payment_Method_Management_API_v4.0.0_swagger.json',
    reason:
      'Same-version editions differ in required payment-subtype fields and polymorphic attributes. Pin the descriptive API edition with explicit subtype requirements. Alternative bytes are not interchangeable; this lock promises only the selected edition.',
  },
  'TMF645/v4': {
    path: 'TMF645-ServiceQualification-v4.0.1.swagger.json',
    reason:
      'The file labelled v4.0.1 still declares info.version 4.0.0. It and the descriptive API edition return QueryServiceQualification for the query operation; the other v4.0.0 file incorrectly references CheckServiceQualification. Preserve actual info.version 4.0.0 and disclose the filename mismatch.',
  },
  'TMF664/v4': {
    path: 'TMF664_Resource_Function_Activation_Management_API_v4.0.0_swagger.json',
    reason:
      'Same-version editions differ in URI/base64 constraints and endpoint representation. Pin the descriptive API edition with explicit URI and base64 constraints; do not merge its schemas with the other edition.',
  },
  'TMF639/v4': {
    path: 'TMF639-ResourceInventory-v4.0.0.swagger.json',
    reason:
      'Same-version editions differ in declared resources. Pin the edition explicitly declaring resource, physicalResource and logicalResource operations. Include all of those operations; preserve the alternative edition in source-candidates rather than merging payloads.',
  },
  'TMF644/v4': {
    path: 'TMF644_Privacy_Management_API_v4.0.0_swagger.json',
    reason:
      'Same-version editions differ in engagedParty versus engagedPartyRole and URI constraints. Pin the descriptive API edition using engagedParty; this is an explicit edition selection, not a claim that both contracts have identical semantics.',
  },
  'TMF720/v4': {
    path: 'TMF720-DigitalIdentity-v4.0.0.swagger.json',
    reason:
      'Same-version editions differ in extension attributes and URI constraints. Pin the edition with explicit href URI formats; preserve its entity definitions without merging the alternative edition.',
  },
  'TMF680/v2': {
    path: 'Recommendation_Management.admin.swagger.json',
    reason:
      'Explicit legacy variant review: this is the sole v2 contract in the actual repository tree, title Recommendation Management and info.version 2.0. It is an admin variant and is surfaced as such. All declared operations are immutable mock responses; no administrative action is performed.',
  },
  'TMF936/v5': {
    path: 'TMF936-Open_Gateway_Operate_API_-_Product_Catalog-v5.0.0.oas.yaml',
    reason:
      'Explicit Open Gateway review: the repository contains one Swagger/OpenAPI document for Product Catalog, info.version 5.0.0. Enumerate every path and operation in that document; the directory badge alone is not coverage evidence.',
  },
  'TMF931/v5': {
    path: 'TMF931-Open_Gateway_Operate_API_Onboarding_and_Ordering-v5.2.1.oas.yaml',
    reason:
      'Explicit suite review: the repository exposes one combined OpenAPI document per patch, not a ZIP of invented interfaces. Pin the newest parsed major-5 document, info.version 5.2.1, and enumerate all its declared operations. No claim is made about additional suite assets outside that document.',
  },
};
for (const [pair, review] of Object.entries(reviewedFiles)) {
  const candidate = candidates.find(
    (c: any) => key(c) === pair && c.upstreamFile === review.path && c.license === 'Apache-2.0',
  );
  if (!candidate) throw new Error(`Reviewed source no longer present: ${pair}`);
  selections.push({
    apiId: candidate.apiId,
    major: candidate.major,
    exactVersion: candidate.exactVersion,
    sha256: candidate.sha256,
    rationale: review.reason,
    alternativeFiles: candidates
      .filter((c: any) => key(c) === pair)
      .map((c: any) => ({
        repo: c.repo,
        path: c.upstreamFile,
        version: c.exactVersion,
        sha256: c.sha256,
      })),
  });
}
await save('catalog/source-selections.json', selections);
console.log(
  `Recorded ${selections.length} source selection reviews; conflicting contracts remain blocked.`,
);
