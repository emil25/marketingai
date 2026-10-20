// Git builds combine root vercel.json with the Build Output API configuration.
// Keep schedules in config/vercel-crons.json and emit them only into build output.
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
