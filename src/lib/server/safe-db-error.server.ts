const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/** Return only structured PostgreSQL diagnostics; never include message or query text. */
export function safeDatabaseErrorMetadata(error: unknown) {
  if (error == null || typeof error !== "object") return undefined;

  const record = error as Record<string, unknown>;
  if (typeof record.code !== "string" || !/^[0-9A-Z]{5}$/.test(record.code)) return undefined;

  const metadata: {
    sqlState: string;
    table?: string;
    column?: string;
    constraint?: string;
  } = { sqlState: record.code };

  for (const key of ["table", "column", "constraint"] as const) {
    const value = record[key];
    if (typeof value === "string" && SAFE_IDENTIFIER.test(value)) metadata[key] = value;
  }

  return metadata;
}

