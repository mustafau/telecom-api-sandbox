import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as Sampler from 'openapi-sampler';

// OAS annotations have no validation effect. Nullable and response writeOnly
// semantics are translated explicitly; source contracts remain byte-identical.
const annotations = new Set([
  'example',
  'discriminator',
  'xml',
  'externalDocs',
  'deprecated',
  'nullable',
]);
const validators = new WeakMap<object, Map<string, ReturnType<Ajv['compile']>>>();
export function schemaForValidation(value: any): any {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(schemaForValidation);
  const result: any = {};
  for (const [k, v] of Object.entries(value)) {
    if (annotations.has(k)) continue;
    if (['properties', 'patternProperties', '$defs', 'definitions'].includes(k))
      result[k] = Object.fromEntries(
        Object.entries(v as any).map(([name, s]) => [name, schemaForValidation(s)]),
      );
    else if (k === 'components')
      result[k] = {
        schemas: Object.fromEntries(
          Object.entries((v as any).schemas ?? {}).map(([name, s]) => [
            name,
            schemaForValidation(s),
          ]),
        ),
      };
    else if (['default', 'const', 'enum', 'examples'].includes(k)) result[k] = v;
    else result[k] = schemaForValidation(v);
  }
  if (value.nullable) {
    if (typeof result.type === 'string') result.type = [result.type, 'null'];
    // OAS 3.0 nullable only takes effect alongside an explicit type.
  }
  if (result.required && value.properties)
    result.required = result.required.filter((p: string) => !value.properties[p]?.writeOnly);
  return result;
}
export function validatorFor(schema: any, doc: any) {
  const cache = validators.get(doc) ?? new Map();
  validators.set(doc, cache);
  const cacheKey = JSON.stringify(schema);
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: true, logger: false });
  addFormats(ajv);
  for (const format of ['float', 'double', 'decimal'])
    ajv.addFormat(format, { type: 'number', validate: Number.isFinite });
  ajv.addFormat('int32', {
    type: 'number',
    validate: (n) => Number.isInteger(n) && n >= -2147483648 && n <= 2147483647,
  });
  ajv.addFormat('int64', { type: 'number', validate: Number.isSafeInteger });
  ajv.addFormat('byte', /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
  ajv.addFormat('base64', /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
  ajv.addFormat('binary', true);
  ajv.addFormat('password', true);
  const root = schemaForValidation({ ...schema, components: doc.components });
  // Unknown format checks fail explicitly, instead of Ajv silently ignoring them.
  const visit = (x: any) => {
    if (x && typeof x === 'object') {
      if (typeof x.format === 'string' && !ajv.formats[x.format])
        throw new Error(`Unsupported schema format: ${x.format}`);
      for (const v of Object.values(x)) visit(v);
    }
  };
  visit(root);
  const validate = ajv.compile(root);
  cache.set(cacheKey, validate);
  return validate;
}
export function sample(schema: any, doc: any, minimal = false): any {
  const value = Sampler.sample(
    schema,
    { skipWriteOnly: true, skipNonRequired: minimal, quiet: true },
    doc,
  );
  // The sampler can omit a required readOnly property declared by a sibling
  // allOf branch. Collect the object's effective properties before completing it.
  function complete(raw: any, data: any, depth = 0): any {
    if (depth > 15 || data == null) return data;
    const s = resolveRef(raw, doc);
    if (Array.isArray(data)) return data.map((v) => complete(s.items ?? {}, v, depth + 1));
    if (typeof data !== 'object') {
      if (s.const !== undefined) return s.const;
      if (s.enum && !s.enum.includes(data)) return s.enum[0];
      for (const branch of s.allOf ?? []) data = complete(branch, data, depth + 1);
      return data;
    }
    const properties: Record<string, any> = {},
      required = new Set<string>();
    const gather = (x: any, seen = new Set<any>()) => {
      const r = resolveRef(x, doc);
      if (seen.has(r)) return;
      seen.add(r);
      Object.assign(properties, r.properties ?? {});
      for (const name of r.required ?? []) required.add(name);
      for (const branch of r.allOf ?? []) gather(branch, seen);
    };
    gather(s);
    for (const name of required) {
      if (data[name] !== undefined || resolveRef(properties[name] ?? {}, doc).writeOnly) continue;
      const prop = properties[name];
      data[name] = prop
        ? Sampler.sample(prop, { skipWriteOnly: true, skipNonRequired: true, quiet: true }, doc)
        : name === 'href'
          ? 'https://sandbox.example.invalid/synthetic-001'
          : 'synthetic-001';
    }
    for (const [name, item] of Object.entries(data))
      if (properties[name]) data[name] = complete(properties[name], item, depth + 1);
    return data;
  }
  return complete(schema, value);
}

export function resolveRef(value: any, doc: any): any {
  const seen = new Set<string>();
  while (value?.$ref) {
    const ref = value.$ref;
    if (!ref.startsWith('#/') || seen.has(ref))
      throw new Error(`Unresolved or circular object reference: ${ref}`);
    seen.add(ref);
    value = ref
      .slice(2)
      .split('/')
      .reduce((o: any, p: string) => o?.[p.replace(/~1/g, '/').replace(/~0/g, '~')], doc);
    if (!value) throw new Error(`Missing reference: ${ref}`);
  }
  return value;
}
