/** Serialize a non-null JSONB parameter for PostgreSQL. */
export function jsonbParameter(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Preserve SQL NULL for nullable JSONB columns instead of writing JSON `null`. */
export function nullableJsonbParameter(value: unknown): string | null {
  return value == null ? null : jsonbParameter(value);
}

