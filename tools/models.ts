export type Pair = { apiId: string; major: string };
export type CatalogEntry = {
  api_id: string;
  name: string;
  category: string;
  directory_major_versions: string[];
  needs_special_review: boolean;
};
export type Catalog = {
  as_of: string;
  api_count: number;
  major_version_pair_count: number;
  apis: CatalogEntry[];
};
export type SourceLock = Pair & {
  exactVersion: string;
  repo: string;
  sourceUrl: string;
  upstreamCommit: string;
  upstreamFile: string;
  localFile: string;
  sha256: string;
  license: string;
  maturity: string;
  review: string;
  notices: { upstreamFile: string; localFile: string; sha256: string }[];
};
export type SourceGap = Pair & {
  state: 'BLOCKED';
  reason: string;
  detail: string;
};
export type BaselineEntry = Pair & { declaredOperations: number; sha256: string };
export type OperationFailure = { method?: string; path?: string; reason: string };
export type CompilationReport = Pair & {
  exactVersion?: string;
  state: 'BLOCKED' | 'COMPILED' | 'CONTRACT_MOCKED';
  declaredOperations: number | null;
  compiledOperations: number;
  routedVariants?: number;
  passedOperations: number;
  failures: OperationFailure[];
  unvalidatedOperations?: { method: string; path: string }[];
  seededReads?: { method: string; path: string }[];
  callbacks?: number;
  webhooks?: number;
};
export type BuildIdentity = {
  sourceRevision: string | null;
  sourceDigest: string;
  sourceLockSha256: string;
  publicOrigin: string;
  nodeVersion: string;
};
