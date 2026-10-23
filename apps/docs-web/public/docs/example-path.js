// Seeded detail routes accept only the published scenario id. Other routes
// accept the shared example id used by contract verification.
export const GENERIC_EXAMPLE_ID = 'synthetic-001';

export function exampleId(operation, projections) {
  if (!operation?.seeded) return GENERIC_EXAMPLE_ID;
  const projection = projections.find(
    (item) =>
      item.apiId === operation.apiId &&
      item.major === operation.major &&
      (item.detail === operation.pathTemplate || item.collection === operation.pathTemplate),
  );
  return projection?.id ?? GENERIC_EXAMPLE_ID;
}

export function examplePath(pathTemplate, id = GENERIC_EXAMPLE_ID) {
  return pathTemplate.replace(/\{[^}]+\}/g, id);
}
