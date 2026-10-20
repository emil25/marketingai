// The Nitro preset does not copy root vercel.json crons to prebuilt output.
// Preserve a single schedule source for Git builds and prebuilt deployments.
export function withProjectCrons(output, project) {
  if (!Array.isArray(project.crons) || !project.crons.length)
    throw new Error("A Vercel napi ellenőrzés ütemezése hiányzik.");
  const crons = project.crons.map(({ path, schedule }) => {
    if (typeof path !== "string" || !/^\/[a-zA-Z0-9/_-]+$/.test(path) ||
        typeof schedule !== "string" || schedule.trim().split(/\s+/).length !== 5)
      throw new Error("A Vercel ellenőrzés ütemezése érvénytelen.");
    return { path, schedule };
  });
  return { ...output, crons };
}
