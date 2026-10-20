/** Opt-in fixture for a dedicated Vercel Preview account. Never an auth bypass. */
export function previewAiAllowed(
  user: { email: string; displayName: string },
  brand: { name: string },
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.NODE_ENV !== "production" && env.VERCEL_ENV === "preview" &&
    !!env.VERCEL &&
    env.MARKETINGPILOT_PREVIEW_TEST_AI === "true" &&
    env.MARKETINGPILOT_JSON_FIXTURE !== "true" &&
    !!(env.DATABASE_URL?.trim() || env.DIRECT_URL?.trim()) &&
    !!env.MARKETINGPILOT_PREVIEW_TEST_EMAIL?.endsWith("@example.invalid") &&
    user.email === env.MARKETINGPILOT_PREVIEW_TEST_EMAIL &&
    /^TESZT\b/.test(user.displayName) &&
    /^TESZT\b/.test(brand.name)
  );
}
export function previewAiResponse(body: Record<string, unknown>) {
  const format = body.response_format as { json_schema?: { name?: string } };
  if (format?.json_schema?.name !== "factual_post_variants")
    throw new Error("Az előnézeti tesztválasz csak a posztszöveg ellenőrzéséhez használható.");
  const messages = body.messages as Array<{ role: string; content: string }>;
  const input = JSON.parse(messages.find((m) => m.role === "user")!.content);
  const system = messages.find((m) => m.role === "system")!.content;
  const context = JSON.parse(system.slice(system.lastIndexOf("\n{") + 1));
  if (!/kenyér/i.test(context.products) || !/kakaós csiga/i.test(context.products))
    throw new Error("A csatornateszt előkészített TESZT pékséget igényel.");
  const variants = input.platforms.map((platform: string) => {
    if (platform !== "facebook" && platform !== "instagram")
      throw new Error("Az előnézeti tesztválasz csak Facebook és Instagram szöveghez használható.");
    const instagram = platform === "instagram";
    const cta = instagram ? "Mentsd el, ha erre jársz!" : "Írj nekünk!";
    const missing = input.requiredPlaceholders ?? [];
    return {
      platform,
      content: `${instagram ? "Kenyér és kakaós csiga. 🥐" : `${context.brandName}: kenyér és kakaós csiga.`}\n\n${missing.join(" ")}\n${cta}`,
      cta,
      hashtags: instagram
        ? ["#pékség", "#kenyér", "#reggeli", "#kakaóscsiga", "#helyi"]
        : ["#pékség"],
      ellenorizendo: missing,
    };
  });
  return Response.json({
    model: "preview-test-fixture",
    choices: [{ message: { content: JSON.stringify({ variants }) } }],
    usage: { prompt_tokens: 0, completion_tokens: 0, cost: 0 },
  });
}
