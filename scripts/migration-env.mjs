// Only a wholly unconfigured local invocation may load a project's .env.
// An injected runtime connection must never acquire a different direct target.
export function loadMigrationEnvironment(env, readLocalEnv) {
  if (env.VERCEL || env.DATABASE_URL?.trim() || env.DIRECT_URL?.trim()) return;
  let raw;
  try {
    raw = readLocalEnv();
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    env[match[1]] = value;
  }
}
