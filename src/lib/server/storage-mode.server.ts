/** PostgreSQL is the normal runtime. JSON needs explicit, isolated fixture opt-in. */
export function assertJsonFixtureAllowed() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL ||
    process.env.MARKETINGPILOT_JSON_FIXTURE !== "true"
  ) {
    throw new Error(
      "Az adatbázis még nincs beállítva. A JSON-tároló kizárólag elkülönített fejlesztői teszthez engedélyezhető.",
    );
  }
}
