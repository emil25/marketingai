export function aiDailyLimit(value: string | undefined) {
  if (value === undefined || value === "") return 100;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
    throw new Error("Az AI napi korlát beállítása hibás. Kérjük, jelezd az üzemeltetőnek.");
  return limit;
}
export function aiProviderMessage(status: number) {
  if (status === 402)
    return "A generálás átmenetileg nem érhető el. Ez nem a te hibád, próbáld újra később.";
  if (status === 429) return "Most túl sok AI-kérés érkezett. Várj egy kicsit, majd próbáld újra.";
  if (status === 401 || status === 403)
    return "Az AI-hozzáférés átmenetileg nem érhető el. Kérjük, jelezd az üzemeltetőnek.";
  return "A generálás átmenetileg nem érhető el. Próbáld újra később; a mentett tartalmaid megmaradnak.";
}
export function aiUsage(value: unknown) {
  const usage = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const number = (key: string, integer = false) => {
    const n = usage[key];
    return typeof n === "number" &&
      Number.isFinite(n) &&
      n >= 0 &&
      (!integer || Number.isSafeInteger(n))
      ? n
      : null;
  };
  return {
    inputTokens: number("prompt_tokens", true),
    outputTokens: number("completion_tokens", true),
    cost: number("cost"),
  };
}
