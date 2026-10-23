type Node<T> = { literals: Map<string, Node<T>>; variable?: Node<T>; methods: Map<string, T> };
const node = <T>(): Node<T> => ({ literals: new Map(), methods: new Map() });
export function createMatcher<T extends { method: string; pathTemplate: string }>(operations: T[]) {
  const root = node<T>();
  for (const operation of operations) {
    let current = root;
    for (const segment of operation.pathTemplate.split('/').filter(Boolean)) {
      if (/^\{[^}]+\}$/.test(segment)) current = current.variable ??= node<T>();
      else {
        if (!current.literals.has(segment)) current.literals.set(segment, node<T>());
        current = current.literals.get(segment)!;
      }
    }
    if (current.methods.has(operation.method))
      throw new Error(`Duplicate runtime route: ${operation.method} ${operation.pathTemplate}`);
    current.methods.set(operation.method, operation);
  }
  return (method: string, pathname: string) => {
    if (pathname.includes('//')) return { operation: undefined, allowed: [] };
    const parts = pathname.split('/').filter(Boolean);
    const match = (current: Node<T>, i: number): Node<T> | undefined => {
      if (i === parts.length) return current.methods.size ? current : undefined;
      const literal = current.literals.get(parts[i]);
      return (
        (literal && match(literal, i + 1)) ||
        (current.variable && match(current.variable, i + 1)) ||
        undefined
      );
    };
    const result = match(root, 0);
    return {
      operation: result?.methods.get(method),
      allowed: result ? [...result.methods.keys()] : [],
    };
  };
}
