// Explicit QA preload, not imported by application builds. Saves only fictional context.
import { appendFile } from "node:fs/promises";
import path from "node:path";
if (
  process.env.NODE_ENV !== "development" ||
  process.env.MARKETINGPILOT_QA !== "1" ||
  !process.env.MARKETINGPILOT_DATA_DIR?.includes("ai-qa-")
)
  throw new Error("QA adapter requires isolated development storage.");
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (
    !url.startsWith("https://openrouter.ai/api/v1/chat/completions") &&
    !url.startsWith("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions")
  )
    return nativeFetch(input, init);
  const request = JSON.parse(String(init?.body));
  const name = request.response_format?.json_schema?.name;
  const user = JSON.parse(request.messages.find((m) => m.role === "user").content);
  const system = request.messages.find((m) => m.role === "system").content;
  const context = user.markaprofil || JSON.parse(system.slice(system.lastIndexOf("\n{") + 1));
  if (!context.brandName?.startsWith("Példa "))
    throw new Error("Only fictional QA brands may be recorded.");
  await appendFile(
    path.join(process.env.MARKETINGPILOT_DATA_DIR, "request-contexts.jsonl"),
    JSON.stringify({ schemaName: name, businessContext: context }) + "\n",
  );
  if (process.env.QA_PROVIDER_MOCK !== "true") return nativeFetch(input, init);
  const known = context.products || context.services;
  const cta = "Írj nekünk privát üzenetet!";
  const tags = ["#kínálat", "#helyivállalkozás", "#csíkszereda", "#ötlet", "#közösség"];
  let result;
  if (name === "factual_post_variants")
    result = {
      variants: user.platforms.map((platform) => ({
        platform,
        content: `${platform === "instagram" ? "Egy ötlet a kínálatunkból. ✨" : context.brandName + ": ezt kínáljuk."}\n\n${known}\n${(user.requiredPlaceholders || []).join(" ")}\n${cta}`,
        cta,
        hashtags: platform === "instagram" ? tags : ["#helyivállalkozás"],
        ellenorizendo: user.requiredPlaceholders || [],
      })),
    };
  else if (name === "weekly_campaign_plan") {
    const week = user.most_tervezendo_het,
      count = Number(user.kert_posztok.split("–")[0]);
    const topics = [
      "Kínálat bemutatása",
      "Közösségi kérdés",
      "Szolgáltatás ismertetése",
      "Hasznos választási tipp",
    ];
    result = {
      het: week.week,
      szakasz: "ismertség",
      posztok: Array.from({ length: count }, (_, i) => {
        const date = new Date(`${week.startDate}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() + Math.min(i * 2, week.length - 1));
        const channel = user.kivalasztott_csatornak[i % user.kivalasztott_csatornak.length];
        return {
          datum: date.toISOString().slice(0, 10),
          idopont: "09:00",
          csatorna: channel,
          tipus: ["termékbemutató", "kérdés", "tipp", "kulissza"][i],
          forma: "egyképes",
          tema: topics[i],
          cel: "beszélgetés",
          vazlat: `${context.brandName}. ${known}${channel === "instagram" ? " ✨" : ""}\n\n${cta}${channel === "instagram" ? "\n" + tags.join(" ") : ""}`,
          vizualis_otlet: "Saját kép a megadott kínálatról.",
          ellenorizendo: [],
        };
      }),
      temak_osszefoglalo: topics.slice(0, count),
    };
  } else throw new Error("QA schema unsupported.");
  return Response.json({
    model: "explicit-qa-mock",
    choices: [{ message: { content: JSON.stringify(result) } }],
    usage: { prompt_tokens: 1, completion_tokens: 1 },
  });
};
