const annotations = new Set([
  'description',
  'summary',
  'title',
  'example',
  'examples',
  'externalDocs',
]);
const maps = new Set([
  'properties',
  'patternProperties',
  'definitions',
  '$defs',
  'schemas',
  'paths',
  'responses',
  'headers',
  'parameters',
  'requestBodies',
  'content',
  'mapping',
  'securitySchemes',
  'callbacks',
  'links',
  'webhooks',
]);
const literalValues = new Set(['enum', 'const', 'default', 'required', 'discriminator']);

/** Ignore presentation annotations while retaining names in maps and literal values. */
export function canonicalContract(
  value: unknown,
  context: 'object' | 'map' | 'literal' | 'components' = 'object',
): unknown {
  if (Array.isArray(value))
    return value.map((item) =>
      canonicalContract(item, context === 'literal' ? 'literal' : 'object'),
    );
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([name, child]) => {
        if (context === 'object' && annotations.has(name)) return [];
        const next =
          context === 'literal'
            ? 'literal'
            : context === 'map'
              ? 'object'
              : context === 'components'
                ? 'map'
                : literalValues.has(name)
                  ? 'literal'
                  : name === 'components'
                    ? 'components'
                    : maps.has(name)
                      ? 'map'
                      : 'object';
        return [[name, canonicalContract(child, next)]];
      }),
  );
}
