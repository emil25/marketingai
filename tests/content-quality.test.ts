import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  assertContentReady,
  contentPlaceholders,
  contentReviewItems,
  contentRuleViolations,
} from "../src/lib/content-quality";

test("resolved placeholder reminders disappear but independent fact checks remain", () => {
  const warnings = ["[cím] hiányzik", "[nyitvatartás]", "Az ajánlat érvényességét erősítsd meg"];
  assert.deepEqual(contentReviewItems(warnings, ["Cím: [cím]"]), [
    "[cím] hiányzik",
    "Az ajánlat érvényességét erősítsd meg",
  ]);
  assert.deepEqual(contentReviewItems(warnings, ["Cím: TESZT utca 1."]), [
    "Az ajánlat érvényességét erősítsd meg",
  ]);
});
import { parseAiJson, requestAiJson } from "../src/lib/server/ai-json.server";
import { campaignWeeks, generateWeeklyPlan } from "../src/lib/server/weekly-plan.server";
import { generateFactualPost } from "../src/lib/server/post-content.server";
import type { BusinessContext } from "../src/lib/business-types";

const context: BusinessContext = {
  businessType: "local_business",
  businessTypeLabel: "Helyi vállalkozás",
  brandName: "Pékség · TESZT",
  industry: "pékség",
  website: "",
  region: "Csíkszereda",
  language: "magyar",
  products: "kenyér",
  services: "reggeli elvitelre",
  offers: "",
  audience: "helyiek",
  tone: "közvetlen",
  ctaStyle: "Látogass el!",
  preferredPhrases: "",
  avoidedPhrases: "",
  learnedBrandVoice: "",
  address: "",
  openingHours: "",
  guardrails: "Csak tények",
  brandDescription: "",
};

test("unresolved content, CTA and hashtags cannot be scheduled or published", () => {
  assert.deepEqual(contentPlaceholders("Cím: [cím]", "[cím]", "[nyitvatartás]"), [
    "[cím]",
    "[nyitvatartás]",
  ]);
  assert.throws(
    () => assertContentReady("Kész poszt", "Írj a [telefon] számon"),
    /hiányzó adatokat/,
  );
  assert.throws(() => assertContentReady("Kész", "", "#[település]"), /település/);
  assert.doesNotThrow(() =>
    assertContentReady("Friss kenyér Csíkszeredában.", "Látogass el hozzánk!"),
  );
});

test("JSON code fences are accepted, malformed response retried exactly once", async () => {
  assert.deepEqual(parseAiJson('```json\n{"ok":true}\n```'), { ok: true });
  let attempts = 0;
  const input = {
    messages: [{ role: "user" as const, content: "test" }],
    schemaName: "test",
    schema: {},
    maxTokens: 100,
  };
  const send = async () => {
    attempts++;
    return Response.json({
      choices: [{ message: { content: attempts === 1 ? "{bad" : '```json\n{"ok":true}\n```' } }],
    });
  };
  assert.deepEqual(await requestAiJson(input, z.object({ ok: z.boolean() }), send), { ok: true });
  assert.equal(attempts, 2);
  attempts = 0;
  await assert.rejects(
    requestAiJson(input, z.object({ ok: z.boolean() }), async () => {
      attempts++;
      return Response.json({ choices: [] });
    }),
    /két próbálkozás/,
  );
  assert.equal(attempts, 2);
  attempts = 0;
  await assert.rejects(
    requestAiJson(input, z.unknown(), async () => {
      attempts++;
      return new Response("provider private details", { status: 402 });
    }),
    /kreditkerete/,
  );
  assert.equal(attempts, 1);
});

test("30-day windows use four complete weeks and a short final week without duplicated days", () => {
  const weeks = campaignWeeks("2026-12-15", 30);
  assert.deepEqual(
    weeks.map((week) => week.length),
    [7, 7, 7, 7, 2],
  );
  assert.equal(weeks[4].endDate, "2027-01-13");
  assert.equal(campaignWeeks("2026-12-29", 7)[0].endDate, "2027-01-04");
});

test("channel format, unknown daily claims and accented calls to action are checked", () => {
  assert.deepEqual(
    contentRuleViolations("Kenyér elvitelre. Látogasson el hozzánk!", "facebook", "kenyér"),
    [],
  );
  assert.ok(
    contentRuleViolations(
      "Sziasztok! Ha sietsz, elviheted a reggelit. Gyere el!",
      "facebook",
      "reggeli",
    ).some((error) => error.includes("te és ti")),
  );
  assert.deepEqual(
    contentRuleViolations("Friss kenyér elvitelre. Te mit kérsz reggelire?", "facebook", "kenyér"),
    [],
  );
  assert.deepEqual(
    contentRuleViolations("Kenyér elvitelre. 🍞 Mentsd el, ha erre jársz!", "instagram", "kenyér", [
      "#kenyér",
      "#helyi",
      "#pékség",
      "#reggeli",
    ]),
    [],
  );
  assert.ok(
    contentRuleViolations("Kenyér 🍞. Mentsd el!", "instagram", "kenyér", ["", "", "", ""]).some(
      (error) => error.includes("hashtag"),
    ),
  );
  assert.ok(
    contentRuleViolations(
      "A pékség reggelije kenyérrel vár. Látogass el!",
      "facebook",
      "kenyér",
    ).some((error) => error.includes("nyitómondat")),
  );
  assert.ok(
    contentRuleViolations("Naponta friss kenyér. Látogass el!", "facebook", "kenyér").some(
      (error) => error.includes("napi rendszeresség"),
    ),
  );
  assert.deepEqual(
    contentRuleViolations("Naponta friss kenyér. Látogass el!", "facebook", "Naponta friss kenyér"),
    [],
  );
  assert.ok(
    contentRuleViolations("Írd meg kommentben! Látogass el!", "facebook", "").some((error) =>
      error.includes("CTA"),
    ),
  );
  assert.ok(
    contentRuleViolations("Ismerd meg a kenyereinket! Látogass el!", "facebook", "kenyér").some(
      (error) => error.includes("CTA"),
    ),
  );
  assert.ok(
    contentRuleViolations("Friss kenyér elvitelre.", "facebook", "kenyér").some((error) =>
      error.includes("Hiányzik a konkrét CTA"),
    ),
  );
  assert.ok(
    contentRuleViolations(
      "Reggelente már korán munkába állunk. Látogass el!",
      "facebook",
      "kenyér",
    ).some((error) => error.includes("korai nyitás")),
  );
  assert.deepEqual(contentRuleViolations("Vizitează-ne!", "facebook", "", [], "román"), []);
  assert.ok(
    contentRuleViolations("Kész poszt #a", "google_business", "").some((error) =>
      error.includes("hashtag"),
    ),
  );
  assert.deepEqual(
    contentRuleViolations(
      "Friss kenyér 🍞. Látogass el! #kenyér #pékség #reggeli #helyi",
      "instagram",
      "Friss kenyér",
    ),
    [],
  );
});

test("a separate second CTA is rejected and the repaired closing sentence is copied only once", async () => {
  let attempts = 0;
  const result = await generateFactualPost(
    {
      businessContext: context,
      brief: "Reggeli elvitelre",
      title: "TESZT",
      platforms: ["facebook"],
      ctaStyle: "Kérdés",
    },
    async (request) => {
      attempts++;
      if (attempts === 2) assert.match(request.messages.at(-1)!.content, /cta mező/);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  {
                    platform: "facebook",
                    content:
                      attempts === 1
                        ? "Kenyér elvitelre. Gyere el!"
                        : "Kenyér elvitelre. Te mit kérsz reggelire?",
                    cta: "Te mit kérsz reggelire?",
                    hashtags: [],
                    ellenorizendo: [],
                  },
                ],
              }),
            },
          },
        ],
      });
    },
  );
  assert.equal(attempts, 2);
  assert.ok(result.variants[0].content.endsWith(result.variants[0].cta));
});

test("nearly copied Facebook and Instagram posts are repaired and complete copied text retains hashtags", async () => {
  let requests = 0;
  const { postCopyText } = await import("../src/lib/post-editor");
  const output = await generateFactualPost(
    {
      businessContext: context,
      brief: "Mutasd be a kenyeret elvitelre.",
      title: "Kenyér",
      platforms: ["facebook", "instagram"],
      ctaStyle: "A célhoz illő CTA",
    },
    async (request) => {
      requests++;
      if (requests === 2) assert.match(request.messages.at(-1)!.content, /túlságosan azonos/);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  {
                    platform: "facebook",
                    content: "Frissen sült kenyér elvitelre a pékségben. Te mit kérsz reggelire?",
                    cta: "Te mit kérsz reggelire?",
                    hashtags: ["#kenyér"],
                    ellenorizendo: [],
                  },
                  {
                    platform: "instagram",
                    content:
                      requests === 1
                        ? "Frissen sült kenyér elvitelre a pékségben. 🍞 Mentsd el, ha erre jársz!"
                        : "🍞 Kenyér a reggeli mellé.\n\nElvitelre is kérheted.\n\nMentsd el, ha erre jársz!",
                    cta: "Mentsd el, ha erre jársz!",
                    hashtags: ["#kenyér", "#pékség", "#reggeli", "#helyi"],
                    ellenorizendo: [],
                  },
                ],
              }),
            },
          },
        ],
      });
    },
  );
  assert.equal(requests, 2);
  assert.match(postCopyText(output.variants[1]), /#kenyér #pékség #reggeli #helyi$/);
  assert.equal(postCopyText(output.variants[1]).match(/Mentsd el/g)?.length, 1);
});

test("a schema failure retries with the rejected output and a specific repair instruction", async () => {
  let calls = 0;
  const input = {
    messages: [{ role: "user" as const, content: "weekly brief" }],
    schemaName: "test",
    schema: {},
  };
  const validate = z
    .object({ ok: z.boolean() })
    .refine((value) => value.ok, "Hiányzik a cím helykitöltője");
  const result = await requestAiJson(input, validate, async (request) => {
    calls++;
    if (calls === 2) {
      assert.ok(
        request.messages.some(
          (message) => message.role === "assistant" && message.content.includes('"ok":false'),
        ),
      );
      assert.ok(request.messages.at(-1)?.content.includes("Hiányzik a cím helykitöltője"));
    }
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ ok: calls === 2 }) } }],
    });
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
});

test("explicitly requested missing facts cannot be replaced by a soon-available promise", async () => {
  let calls = 0;
  const output = await generateFactualPost(
    {
      businessContext: context,
      brief: "Cím és nyitvatartás kell, de nem adtam meg.",
      title: "TESZT",
      platforms: ["facebook"],
      ctaStyle: "Látogass el!",
    },
    async () => {
      calls++;
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                variants: [
                  {
                    platform: "facebook",
                    content:
                      calls === 1
                        ? "A cím hamarosan elérhető. Látogass el!"
                        : "Cím: [cím]. Nyitvatartás: [nyitvatartás]. Látogass el!",
                    cta: "Látogass el!",
                    hashtags: [],
                    ellenorizendo: [],
                  },
                ],
              }),
            },
          },
        ],
      });
    },
  );
  assert.equal(calls, 2);
  assert.deepEqual(output.variants[0].ellenorizendo, ["[cím]", "[nyitvatartás]"]);
});

test("weekly requests carry previous topic summaries, actual brand facts and bounded token budget", async () => {
  const week = campaignWeeks("2026-10-09", 30)[1];
  const campaign = {
    name: "TESZT",
    objective: "ismertség",
    offer: "kenyér",
    description: "",
    startDate: "2026-10-09",
    endDate: "2026-11-07",
    timezone: "Europe/Bucharest",
    cta: "Látogass el!",
  };
  const prior = ["Kenyér bemutatása"];
  let requests = 0;
  const output = await generateWeeklyPlan(
    {
      businessContext: { ...context, address: "TESZT cím", openingHours: "8–16" },
      campaign,
      channels: ["facebook"],
      week,
      plannedTopics: prior,
      channelCounts: { facebook: 3 },
      localEvents: [],
    },
    async (request) => {
      requests++;
      const sent = JSON.parse(request.messages[1].content);
      assert.deepEqual(sent.eddig_tervezett_temak, prior);
      assert.equal(sent.markaprofil.address, "TESZT cím");
      assert.equal(sent.markaprofil.openingHours, "8–16");
      assert.deepEqual(sent.helyi_unnepek_es_esemenyek, []);
      assert.equal(request.maxTokens, 4000);
      if (requests === 2)
        assert.match(request.messages.at(-1)!.content, /Ismételt téma: Kenyér bemutatása/);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                het: 2,
                szakasz: "bizalom",
                posztok: ["kérdés", "kulissza", "tipp"].map((tipus, index) => ({
                  datum: `2026-10-${16 + index}`,
                  idopont: "10:00",
                  csatorna: "facebook",
                  tipus,
                  forma: "egyképes",
                  tema: requests === 1 && index === 0 ? prior[0] : `Másik téma ${index}`,
                  cel: "bizalom",
                  vazlat: "Kenyér elvitelre. Látogass el!",
                  vizualis_otlet: "Fotó a kenyérről.",
                  ellenorizendo: [],
                })),
                temak_osszefoglalo: ["Közösségi kérdés", "Műhely munka", "Tárolási tipp"],
              }),
            },
          },
        ],
      });
    },
  );
  assert.equal(output.posztok.length, 3);
  assert.equal(requests, 2);
});
