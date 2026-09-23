export type JsonSchema = Record<string, any>;

/**
 * Inlines every `$ref` in an OpenAPI schema fragment against
 * `document.components.schemas` so each MCP tool's `inputSchema` is fully
 * self-contained. Not every MCP client dereferences external/local `$ref`s
 * the same way, so shipping a flat schema per tool is the safer choice.
 */
export function dereference(
  schema: JsonSchema | undefined,
  components: Record<string, JsonSchema>,
  seen: Set<string> = new Set(),
): JsonSchema {
  if (!schema || typeof schema !== 'object') return { type: 'object' };

  if (schema.$ref) {
    const refName = String(schema.$ref).replace('#/components/schemas/', '');
    if (seen.has(refName)) {
      // Cyclical reference - stop descending, keep the schema structurally valid.
      return { type: 'object' };
    }
    const target = components[refName];
    if (!target) return { type: 'object' };
    return dereference(target, components, new Set(seen).add(refName));
  }

  const result: JsonSchema = { ...schema };

  if (Array.isArray(schema.allOf)) {
    const merged: JsonSchema = { type: 'object', properties: {}, required: [] };
    for (const sub of schema.allOf) {
      const resolved = dereference(sub, components, seen);
      Object.assign(merged.properties, resolved.properties ?? {});
      if (Array.isArray(resolved.required))
        merged.required.push(...resolved.required);
      for (const key of Object.keys(resolved)) {
        if (key !== 'properties' && key !== 'required')
          merged[key] = resolved[key];
      }
    }
    if (merged.required.length === 0) delete merged.required;
    return merged;
  }

  if (schema.type === 'array' && schema.items) {
    result.items = dereference(schema.items, components, seen);
  }

  if (schema.type === 'object' || schema.properties) {
    if (schema.properties) {
      result.properties = Object.fromEntries(
        Object.entries(schema.properties as Record<string, JsonSchema>).map(
          ([key, value]) => [key, dereference(value, components, seen)],
        ),
      );
    }
    if (
      schema.additionalProperties &&
      typeof schema.additionalProperties === 'object'
    ) {
      result.additionalProperties = dereference(
        schema.additionalProperties,
        components,
        seen,
      );
    }
  }

  return result;
}
