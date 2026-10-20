// Explicit test-runner preload only. Never imported by application code or production builds.
import { mkdir, appendFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
if (
  process.env.MARKETINGPILOT_E2E !== "1" ||
  process.env.NODE_ENV !== "development" ||
  !process.env.MARKETINGPILOT_DATA_DIR?.includes("beta-e2e")
)
  throw new Error("Provider mocks require an isolated development test directory.");
const directory = process.env.MARKETINGPILOT_DATA_DIR;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url === "https://api.resend.com/emails") {
    await mkdir(directory, { recursive: true });
    await appendFile(path.join(directory, "outbox.jsonl"), `${init.body}\n`);
    return Response.json({ id: "test-email" });
  }
  if (url.startsWith("https://challenges.cloudflare.com/turnstile/"))
    return Response.json({
      success: true,
      action: new URLSearchParams(init.body).get("response"),
      hostname: "127.0.0.1",
    });
  if (url.startsWith("https://openrouter.ai/")) {
    let control;
    try {
      control = JSON.parse(await readFile(path.join(directory, "provider-control.json"), "utf8"));
    } catch {
      /* default success */
    }
    if (control?.status) {
      await unlink(path.join(directory, "provider-control.json"));
      return Response.json(
        { error: { message: "test-provider-failure" } },
        { status: control.status },
      );
    }
    const body = JSON.parse(init.body);
    const name = body.response_format?.json_schema?.name;
    const user = JSON.parse(body.messages.find((m) => m.role === "user").content);
    let result;
    if (name === "factual_post_variants") {
      const missing = user.requiredPlaceholders || [];
      result = {
        variants: user.platforms.map((platform) => {
          const cta = platform === "instagram" ? "Mentsd el, ha erre jársz!" : "Írj nekünk!";
          return {
            platform,
            content: `${/Írd át lényegesen rövidebbre/.test(user.brief) ? "Kenyér és kakaós csiga." : /barátságosabb hangon/.test(user.brief) ? "Nézz be hozzánk egy kakaós csigára!" : platform === "instagram" ? "Kenyér és kakaós csiga. 🥐" : "Műhely Pékség: kenyér és kakaós csiga Csíkszeredában."}\n${missing.join(" ")}\n${cta}`,
            cta,
            hashtags:
              platform === "instagram"
                ? ["#pékség", "#kenyér", "#csíkszereda", "#reggeli", "#kakaóscsiga"]
                : /felhasználó szerkesztett posztját/.test(user.brief)
                  ? ["#pékség"]
                  : [],
            ellenorizendo: missing,
          };
        }),
      };
    } else if (name === "post_opening_options") {
      const openings = [
        "Te melyiket választod: kovászos kenyeret vagy kakaós csigát?",
        "Kovászos kenyérrel vagy kakaós csigával kezdenéd?",
        "Egy egyszerű választás a megadott kínálatból.",
        "Melyik illik jobban ahhoz, amit most ennél?",
        "Neked melyik jut eszedbe először?",
      ];
      result = {
        options: ["kérdés", "konkrét kép", "hasznos tipp", "szezon", "érzés"].map((megkozelites, index) => ({
          megkozelites,
          text: openings[index],
        })),
      };
    } else if (name === "post_question_closings") {
      result = { questions: [
        "Te melyiket választanád?",
        "Melyik illik jobban a reggelidhez?",
        "Kovászos kenyeret vagy kakaós csigát kérnél?",
        "Neked melyik esne jobban?",
      ] };
    } else if (name === "improve_user_copy") {
      result = {
        content: user.eredeti,
        cta: "",
        hashtags: [],
        reasons: [
          { change: "Erősebb nyitás", reason: "A megadott tényekre építve indít." },
          { change: "Rövidebb mondatok", reason: "A mondanivaló tömör maradt." },
        ],
      };
    } else if (name === "similar_posts") {
      result = { posts: [
        { megkozelites: "kérdés", title: "Kérdés a választásról", content: "Te melyiket választanád? Kovászos kenyér és kakaós csiga. Írj nekünk!", cta: "Írj nekünk!", hashtags: [], ellenorizendo: [] },
        { megkozelites: "hasznos tipp", title: "Tipp a kínálathoz", content: "Egy rövid tipp: gondold át, melyik illik most hozzád. Kovászos kenyér és kakaós csiga. Írj nekünk!", cta: "Írj nekünk!", hashtags: [], ellenorizendo: [] },
        { megkozelites: "kulissza", title: "A poszt témája", content: "A mai bejegyzés témája a kovászos kenyér és a kakaós csiga. Írj nekünk!", cta: "Írj nekünk!", hashtags: [], ellenorizendo: [] },
      ] };
    } else if (name === "business_idea_bank") {
      result = { ideas: [
        "Kenyérválasztási szempontok", "Kakaós csiga bemutatása", "Kérdés a reggeli szokásokról", "A kínálat bemutatása", "Pékáru párosítási ötletek",
        "A vásárlók gyakori kérdései", "Kenyérfajták közötti különbségek", "Reggelihez illő választások", "A pékség hangulatának bemutatása", "Kovászos kenyér témája",
        "Kakaós csiga témája", "Helyi ízekről szóló kérdés", "Sütési folyamat általános bemutatása", "Kenyér tárolásáról szóló általános tipp", "A pékség bemutatkozása",
        "Kedvenc kenyérfélékről szóló kérdés", "A liszt szerepe a kenyérben", "A kenyér szeletelésének bemutatása", "Kovászos kenyér fotóötlete", "A reggeli választás megkönnyítése",
      ] };
    } else if (name === "weekly_campaign_plan") {
      const week = user.most_tervezendo_het;
      const count = Number(user.kert_posztok.split("–")[0]);
      const topics = [
        "Kenyér bemutatása",
        "Reggeli választás",
        "Kakaós csiga ajánlat",
        "Pékségi kulissza",
      ];
      const start = new Date(`${week.startDate}T12:00:00Z`);
      result = {
        het: week.week,
        szakasz: week.week < 3 ? "ismertség" : "bizalom",
        posztok: Array.from({ length: count }, (_, i) => {
          const date = new Date(start);
          date.setUTCDate(date.getUTCDate() + Math.min(i * 2, week.length - 1));
          const channel = user.kivalasztott_csatornak[i % user.kivalasztott_csatornak.length];
          const tags =
            channel === "instagram"
              ? " 🥐\n#pékség #kenyér #csíkszereda #reggeli #kakaóscsiga"
              : "";
          return {
            datum: date.toISOString().slice(0, 10),
            idopont: `${8 + i}:30`.padStart(5, "0"),
            csatorna: channel,
            tipus: ["termékbemutató", "kérdés", "hasznos_tipp_ellenorzo_lista", "kulissza"][i],
            forma: "egyképes",
            tema: `${topics[i]} ${week.week}. hét`,
            cel: "forgalom",
            vazlat: `Műhely Pékség, Csíkszereda. Kenyér és kakaós csiga. Cím: [cím].\nÍrj nekünk!${tags}`,
            vizualis_otlet: "Fotó a megadott termékekről.",
            ellenorizendo: ["[cím]"],
          };
        }),
        temak_osszefoglalo: topics.slice(0, count).map((t) => `${t} ${week.week}. hét`),
      };
    } else throw new Error(`Test mock missing schema: ${name}`);
    await appendFile(
      path.join(directory, "mock-calls.jsonl"),
      JSON.stringify({ schema: name, model: body.model }) + "\n",
    );
    return Response.json({
      model: "test-mock",
      choices: [{ message: { content: JSON.stringify(result) } }],
      usage: { prompt_tokens: 100, completion_tokens: 100, cost: 0 },
    });
  }
  return realFetch(input, init);
};
