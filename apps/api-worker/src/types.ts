export type Operation = {
  apiId: string;
  major: string;
  exactVersion: string;
  method: string;
  pathTemplate: string;
  operationId: string;
  fixture: string | null;
  status: number;
  mediaType: string | null;
  headers: Record<string, string>;
  parameters: { name: string; in: string; required?: boolean; schema?: any }[];
  schemaValidation: 'VALIDATED' | 'NO_SCHEMA';
  contractSha256: string;
  seeded?: boolean;
};
export type Env = { ASSETS: { fetch: (request: Request) => Promise<Response> } };
