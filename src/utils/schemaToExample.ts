/**
 * Converts an OpenAPI/Swagger schema to an example JSON object
 */
export function schemaToExample(schema: any): any {
  if (!schema) return null;

  // Use provided example if available
  if (schema.example !== undefined) {
    return schema.example;
  }

  // Handle $ref (just return a note, actual refs should be resolved elsewhere)
  if (schema.$ref) {
    return `<ref: ${schema.$ref}>`;
  }

  // Handle different types
  switch (schema.type) {
    case 'object':
      if (!schema.properties) {
        return {};
      }
      const obj: any = {};
      Object.entries(schema.properties).forEach(([key, propSchema]: [string, any]) => {
        obj[key] = schemaToExample(propSchema);
      });
      return obj;

    case 'array':
      if (schema.items) {
        const itemExample = schemaToExample(schema.items);
        return schema.example || [itemExample];
      }
      return [];

    case 'string':
      if (schema.enum) {
        return schema.enum[0];
      }
      if (schema.format === 'date') return '2024-01-01';
      if (schema.format === 'date-time') return '2024-01-01T00:00:00Z';
      if (schema.format === 'email') return 'user@example.com';
      if (schema.format === 'uri' || schema.format === 'url') return 'https://example.com';
      if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
      return schema.default || 'string';

    case 'number':
    case 'integer':
      if (schema.enum) {
        return schema.enum[0];
      }
      return schema.default ?? (schema.minimum ?? 0);

    case 'boolean':
      return schema.default ?? true;

    default:
      return null;
  }
}

/**
 * Converts schema to formatted JSON string
 */
export function schemaToExampleJSON(schema: any): string {
  const example = schemaToExample(schema);
  if (example === null) return '';
  return JSON.stringify(example, null, 2);
}
