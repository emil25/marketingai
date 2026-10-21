import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  FACTUAL_CONTENT_RULES,
  assertContentReady,
  contentClaimFindings,
  contentPlaceholders,
  contentReviewItems,
  contentRuleFindings,
  contentRuleViolations,
  contentSoftClaimWarnings,
  needsOfferDetails,
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
import { parseAiJson, requestAiJson, validationFailure } from "../src/lib/server/ai-json.server";
import { campaignWeeks, generateWeeklyPlan } from "../src/lib/server/weekly-plan.server";
import { generateFactualPost } from "../src/lib/server/post-content.server";
import type { BusinessContext } from "../src/lib/business-types";

test("reasonable bakery descriptors pass with a review notice; stated or approved details are exempt", () => {
  const text = "A kakaós csiga frissen sül, édesen omlós. Írj nekünk!";
  const context = { businessType: "bakery_cafe", approvedClaims: [] };
  assert.deepEqual(contentRuleViolations(text, "facebook", "Kakaós csiga", [], "magyar", context), []);
  assert.deepEqual(contentSoftClaimWarnings(text, "Kakaós csiga", context), [
    "Ellenőrizd, hogy ez a leírás igaz-e a vállalkozásodra: „frissen sül”.",
    "Ellenőrizd, hogy ez a leírás igaz-e a vállalkozásodra: „omlós”.",
  ]);
  assert.deepEqual(
    contentSoftClaimWarnings(text, "Frissen sütünk omlós kakaós csigát", context),
    [],
  );
  assert.deepEqual(
    contentSoftClaimWarnings(text, "Kakaós csiga", {
      ...context,
      approvedClaims: ["Frissen sütünk", "Omlós termékeket készítünk"],
    }),
    [],
  );
});

test("unconfirmed product details need review, while popularity claims block", () => {
  const output = "A ropogós tészta és a gazdag töltelék sokak kedvence.";
  const findings = contentClaimFindings(
    output,
    JSON.stringify({ products: "kakaós csiga", brief: "Mutasd be a kakaós csigát reggelire." }),
    { businessType: "bakery_cafe" },
  );
  assert.ok(findings.some((finding) => finding.severity === "hard" && finding.category === "HARD_CLAIM_SOCIAL_PROOF" && finding.message.includes("sokak kedvence")));
  assert.ok(findings.some((finding) => finding.severity === "soft" && finding.message.includes("ropogós")));
  assert.ok(findings.some((finding) => finding.severity === "soft" && finding.message.includes("gazdag töltelék")));
  assert.match(FACTUAL_CONTENT_RULES, /Ne találgass termékjellemzőkről/);
  assert.match(FACTUAL_CONTENT_RULES, /Ne írj népszerűségi állítást/);

  assert.deepEqual(
    contentClaimFindings(output, JSON.stringify({ products: "kakaós csiga", brief: output }), { businessType: "bakery_cafe" }),
    [],
  );

  for (const claim of ["A kakaós csiga közkedvelt.", "Mindenki szereti a kakaós csigát.", "Mindenki imádja a kakaós csigát.", "A kakaós csiga híres.", "A környék kedvence."]) {
    assert.ok(contentClaimFindings(claim, JSON.stringify({ products: "kakaós csiga" }), { businessType: "bakery_cafe" }).some((finding) => finding.severity === "hard" && finding.category === "HARD_CLAIM_SOCIAL_PROOF"), claim);
  }
  const ownerProvided = "Ez a vendégeink kedvence.";
  assert.deepEqual(
    contentClaimFindings(ownerProvided, JSON.stringify({ products: "kakaós csiga", brief: ownerProvided }), { businessType: "bakery_cafe" }),
    [],
  );
});

test("hard unsupported claims are categorized while owner-provided facts are exempt", () => {
  const context = { businessType: "bakery_cafe", approvedClaims: [] };
  const findings = contentRuleFindings(
    "Kakaós csiga 15 lej, pénteken 9:00-kor, 20% kedvezménnyel. Írj nekünk!",
    "facebook",
    JSON.stringify({ products: "Kakaós csiga", offers: "" }),
    [],
    "magyar",
    context,
  );
  assert.deepEqual(
    [...new Set(findings.filter((finding) => finding.severity === "hard").map((item) => item.category))].sort(),
    ["HARD_CLAIM_DATE", "HARD_CLAIM_DISCOUNT", "HARD_CLAIM_PRICE", "HARD_CLAIM_TIME"],
  );
  assert.deepEqual(
    contentRuleFindings(
      "Kakaós csiga 15 lej, pénteken 9:00-kor, 20% kedvezménnyel. Írj nekünk!",
      "facebook",
      JSON.stringify({ products: "Kakaós csiga", offers: "15 lej, pénteken 9:00-kor, 20% kedvezmény" }),
      [],
      "magyar",
      context,
    ).filter((item) => item.severity === "hard"),
    [],
  );
  const dangerous = [
    ["A legjobb pékség vagyunk. Írj nekünk!", "HARD_CLAIM_SUPERLATIVE"],
    ["Díjnyertes termékünk. Írj nekünk!", "HARD_CLAIM_AWARD"],
    ["Kapcsolat: +40 744 123 456. Hívj!", "HARD_CLAIM_PHONE"],
    ["Petőfi utca 12. Látogass el!", "HARD_CLAIM_ADDRESS"],
    ["Nyitvatartás: hétfőtől péntekig 9:00–17:00. Látogass el!", "HARD_CLAIM_OPENING_HOURS"],
    ["A kiszállás díjmentes. Hívj!", "HARD_CLAIM_FEE"],
    ["Garanciát vállalunk mindenre. Hívj!", "HARD_CLAIM_GUARANTEE"],
    ["Ez a kezelés meggyógyítja a bőröd. Foglalj!", "HARD_CLAIM_HEALTH_PROMISE"],
    ["Minden hibát megoldunk. Hívj!", "HARD_CLAIM_TECHNICAL_PROMISE"],
    ["A szempilla kezelésünk kisimítja a ráncokat. Foglalj!", "HARD_CLAIM_HEALTH_PROMISE"],
    ["Friss pizza ma. Látogass el!", "HARD_CLAIM_UNSUPPORTED_PRODUCT"],
  ] as const;
  for (const [text, category] of dangerous) {
    const result = contentRuleFindings(
      text,
      "facebook",
      "",
      [],
      "magyar",
      { businessType: category === "HARD_CLAIM_UNSUPPORTED_PRODUCT" ? "bakery_cafe" : "beauty_salon" },
    );
    assert.ok(result.some((finding) => finding.severity === "hard" && finding.category === category), text);
  }
});

test("brand name or domain alone cannot invent a business announcement or music topic", () => {
  const facts = JSON.stringify({
    brandName: "zene.ro",
    businessType: "Helyi vállalkozás",
    products: "",
    services: "",
    offers: "",
    brief: "Írj egy rövid bemutatkozó posztot.",
  });
  const invented = contentRuleFindings(
    "A zene.ro csapata új lehetőségekkel érkezik hozzád. Milyen zenei témák érdekelnek téged a legjobban?",
    "facebook",
    facts,
    [],
    "magyar",
    { businessType: "local_business" },
  ).filter((finding) => finding.severity === "hard");
  assert.ok(invented.some((finding) => finding.category === "HARD_CLAIM_UNSUPPORTED_ANNOUNCEMENT"));
  assert.ok(invented.some((finding) => finding.category === "HARD_CLAIM_UNSUPPORTED_TOPIC"));

  const supported = contentClaimFindings(
    "Új szolgáltatások érkeznek. Milyen zenei témák érdekelnek?",
    JSON.stringify({ services: "zene, zenei tartalmak készítése, új szolgáltatások érkeznek" }),
    { businessType: "local_business" },
  ).filter((finding) => finding.severity === "hard");
  assert.deepEqual(supported, []);
});

test("unsupported offers, novelty and empty promises are hard failures, but owner facts allow them", () => {
  const unsupported = [
    ["A zene.ro hamarosan új szolgáltatással érkezik.", "HARD_CLAIM_UNSUPPORTED_ANNOUNCEMENT"],
    ["Teljesen új élmény vár rád.", "HARD_CLAIM_EMPTY_PROMISE"],
    ["A Példa Pékségben friss kenyérrel várunk.", "HARD_CLAIM_UNSUPPORTED_PRODUCT"],
    ["Most indul a kerékpárkölcsönzés.", "HARD_CLAIM_UNSUPPORTED_PRODUCT"],
  ] as const;
  for (const [text, category] of unsupported) {
    const findings = contentRuleFindings(
      text,
      "topic_idea",
      JSON.stringify({ brandName: "zene.ro", products: "", services: "", industry: "" }),
      [],
      "magyar",
      { businessType: "other" },
    );
    assert.ok(findings.some((finding) => finding.severity === "hard" && finding.category === category), text);
  }
  const supported = contentClaimFindings(
    "Hamarosan bemutatjuk az új szolgáltatást: kerékpárkölcsönzés.",
    JSON.stringify({ services: "Hamarosan bemutatjuk az új szolgáltatást: kerékpárkölcsönzés" }),
    { businessType: "other" },
  );
  assert.deepEqual(supported.filter((finding) => finding.severity === "hard"), []);
});

test("thin and Other profiles ask for concrete offer details without inferring from their name", () => {
  assert.equal(
    needsOfferDetails({ businessType: "other", industry: "", products: "", services: "" }, "Írj bemutatkozó posztot."),
    true,
  );
  assert.equal(
    needsOfferDetails({ businessType: "other", industry: "zenész", products: "", services: "" }, "Írj rövid posztot."),
    true,
  );
  assert.equal(
    needsOfferDetails({ businessType: "other", industry: "", products: "", services: "" }, "Szolgáltatás: kerékpárkölcsönzés"),
    false,
  );
  assert.equal(
    needsOfferDetails({ businessType: "bakery_cafe", products: "kovászos kenyér", services: "" }, "Mutatkozz be."),
    false,
  );
});

test("factual post generation retries and repairs unsupported claims inferred from a domain", async () => {
  let calls = 0;
  const result = await generateFactualPost(
    {
      businessContext: {
        ...context,
        businessType: "local_business",
        brandName: "zene.ro",
        products: "",
        services: "",
      },
      brief: "Írj rövid bemutatkozó posztot.",
      title: "Bemutatkozás",
      platforms: ["facebook"],
      ctaStyle: "Kérdés",
    },
    async (request) => {
      calls++;
      if (calls === 2)
        assert.match(request.messages.at(-1)!.content, /márkanév önmagában nem igazolja/);
      const content = calls === 1
        ? "A zene.ro csapata új lehetőségekkel érkezik hozzád. Milyen zenei témák érdekelnek téged?"
        : "A [szolgáltatás] bemutatkozója. Milyen témáról olvasnál szívesen?";
      return Response.json({
        choices: [{ message: { content: JSON.stringify({ variants: [{
          platform: "facebook",
          content,
          cta: content.split(". ").at(-1)!,
          hashtags: [],
          ellenorizendo: [],
        }] }) } }],
      });
    },
  );
  assert.equal(calls, 2);
  assert.match(result.variants[0].content, /\[szolgáltatás\]/);
  assert.doesNotMatch(result.variants[0].content, /új lehetőségekkel|zenei témák/u);
});

test("sparse post prompts pass Other activity and show a separate owner follow-up", async () => {
  let captured: Array<{ role: string; content: string }> = [];
  const result = await generateFactualPost(
    {
      businessContext: {
        ...context,
        businessType: "other",
        businessTypeLabel: "Egyéb",
        brandName: "Példa Műhely",
        industry: "kerékpárszerviz és kölcsönzés",
        products: "",
        services: "",
        brandDescription: "Helyi vállalkozás.",
      },
      brief: "Írj rövid bemutatkozó posztot.",
      title: "Bemutatkozás",
      platforms: ["facebook"],
      ctaStyle: "Kérdés",
    },
    async (request) => {
      captured = request.messages;
      const content = "Példa Műhely. Milyen témáról olvasnál szívesen?";
      return Response.json({
        choices: [{ message: { content: JSON.stringify({ variants: [{
          platform: "facebook",
          content,
          cta: content.split(". ").at(-1)!,
          hashtags: [],
          ellenorizendo: [],
        }] }) } }],
      });
    },
  );
  assert.equal(result.variants.length, 1);
  assert.match(captured[0].content, /kerékpárszerviz és kölcsönzés/);
  assert.match(captured[0].content, /kevés konkrét adat/i);
  const input = JSON.parse(captured[1].content);
  assert.equal(input.followUpQuestionForOwner, "Mit kínálsz? Egy mondatban.");
  assert.equal(input.brief, "Írj rövid bemutatkozó posztot.");
});

test("owner-provided product names remain valid in common Hungarian inflections", () => {
  const findings = contentRuleFindings(
    "Kovászos kenyeret vagy kakaós csigát választanál? Kovászos kenyérrel is kérheted. Írj nekünk!",
    "facebook",
    JSON.stringify({ products: "kovászos kenyér, kakaós csiga" }),
    [],
    "magyar",
    { businessType: "bakery_cafe" },
  );
  assert.deepEqual(
    findings.filter((finding) => finding.category === "HARD_CLAIM_UNSUPPORTED_PRODUCT"),
    [],
  );
  assert.deepEqual(
    contentRuleFindings(
      "Kenyérválasztási szempontok",
      "topic_idea",
      JSON.stringify({ products: "kovászos kenyér" }),
    ).filter((finding) => finding.category === "HARD_CLAIM_UNSUPPORTED_PRODUCT"),
    [],
  );
});

test("activity bait is rejected unless the user supplied the text as a fact to preserve", () => {
  for (const text of [
    "Kommentelj IGEN-t, ha egyetértesz!",
    "Oszd meg, ha tetszik!",
    "Címkézd meg egy barátodat!",
    "Jelöld meg a barátodat!",
  ]) {
    assert.ok(
      contentRuleFindings(text, "facebook", "", [], "magyar").some(
        (finding) => finding.severity === "hard" && finding.category === "CONTENT_STYLE_RULE",
      ),
      text,
    );
  }
});

test("beauty and accommodation descriptors are reviewable, not rejected", () => {
  assert.deepEqual(
    contentRuleViolations("Kellemes, nyugodt hangulat. Foglalj időpontot!", "facebook", "", [], "magyar", { businessType: "beauty_salon" }),
    [],
  );
  assert.equal(
    contentSoftClaimWarnings("Kellemes, nyugodt hangulat. Foglalj időpontot!", "", { businessType: "beauty_salon" }).length,
    2,
  );
  assert.equal(
    contentSoftClaimWarnings("Csendes, kényelmes pihenés. Foglalj most!", "", { businessType: "accommodation" }).length,
    2,
  );
});

test("regulated business types keep hard claim checks despite custom approved-claim entries", () => {
  for (const businessType of ["beauty_salon", "dental_practice", "lawyer", "doctor", "orvos", "fogászat"]) {
    const findings = contentRuleFindings(
      "A kezelés garantáltan kisimítja a ráncokat. Foglalj időpontot!",
      "facebook",
      "",
      [],
      "magyar",
      { businessType, approvedClaims: ["A kezelés garantáltan kisimítja a ráncokat"] },
    );
    assert.ok(findings.some((finding) => finding.category === "HARD_CLAIM_HEALTH_PROMISE"), businessType);
  }

  const statedPrice = contentRuleFindings(
    "A vizsgálat 100 lej. Foglalj időpontot!",
    "facebook",
    JSON.stringify({ offers: "A vizsgálat 100 lej" }),
    [],
    "magyar",
    { businessType: "dental_practice", approvedClaims: ["A vizsgálat 100 lej"] },
  );
  assert.ok(!statedPrice.some((finding) => finding.category === "HARD_CLAIM_PRICE"));
});

test("a weekly plan may mention a weekday that belongs to its supplied date window", () => {
  const text = "Szombaton is vár a hétvégi pihenés. Foglalj most!";
  assert.ok(
    contentRuleViolations(text, "facebook", "szállás, hétvégi pihenés", [], "magyar", {
      businessType: "accommodation",
      allowedWeekdays: ["szombat"],
    }).every((message) => !message.includes("dátum vagy konkrét nap")),
  );
  assert.ok(
    contentRuleViolations(text, "facebook", "szállás, hétvégi pihenés", [], "magyar", {
      businessType: "accommodation",
    }).some((message) => message.includes("dátum vagy konkrét nap")),
  );
});

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
  assert.equal(validationFailure(new SyntaxError("invalid")).category, "SCHEMA_INVALID_JSON");
  const missing = z.object({ title: z.string() }).safeParse({});
  assert.equal(validationFailure(missing.success ? null : missing.error).category, "SCHEMA_MISSING_FIELD");
  const hardIssue = z
    .object({ price: z.string() })
    .superRefine((_value, ctx) => ctx.addIssue({
      code: "custom", message: "Az árat töröld vagy kérdezd meg.", params: { category: "HARD_CLAIM_PRICE" },
    }))
    .safeParse({ price: "15 lej" }).error;
  assert.equal(validationFailure(hardIssue ?? null).category, "HARD_CLAIM_PRICE");
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
    /egy javítás után/,
  );
  assert.equal(attempts, 2);
  attempts = 0;
  await assert.rejects(
    requestAiJson(input, z.unknown(), async () => {
      attempts++;
      return new Response("provider private details", { status: 402 });
    }),
    /Ez nem a te hibád/,
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
      brief: "Mutasd be a frissen sült kenyeret elvitelre.",
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

test("mocked bakery, beauty and accommodation copy keeps soft review notes and passes approved claims", async () => {
  const cases = [
    {
      businessType: "bakery_cafe",
      products: "kovászos kenyér",
      services: "elvitel",
      content: "Frissen sült kovászos kenyér. Látogass el hozzánk!",
      descriptor: "frissen sül",
    },
    {
      businessType: "beauty_salon",
      products: "",
      services: "kozmetikai kezelés",
      content: "Kellemes, nyugodt hangulat. Foglalj időpontot!",
      descriptor: "kellemes",
    },
    {
      businessType: "accommodation",
      products: "szállás",
      services: "hétvégi pihenés",
      content: "Csendes, kényelmes pihenés. Foglalj most!",
      descriptor: "csendes",
    },
  ] as const;
  for (const item of cases) {
    const businessContext = {
      ...context,
      businessType: item.businessType as BusinessContext["businessType"],
      products: item.products,
      services: item.services,
      approvedClaims: ["Helyi alapanyagokat használunk"],
    };
    const generated = await generateFactualPost(
      {
        businessContext,
        brief: "Mutasd be röviden a kínálatot.",
        title: "Bemutatkozó",
        platforms: ["facebook"],
        ctaStyle: "Látogass el!",
      },
      async (request) => {
        assert.match(request.messages[0].content, /Helyi alapanyagokat használunk/);
        return Response.json({
          choices: [{ message: { content: JSON.stringify({ variants: [{
            platform: "facebook",
            content: item.content,
            cta: item.content.split(". ").at(-1)!,
            hashtags: [],
            ellenorizendo: [],
          }] }) } }],
        });
      },
    );
    assert.ok(generated.variants[0].ellenorizendo.some((warning) => warning.toLocaleLowerCase("hu").includes(item.descriptor)));
  }
});

test("hard factual claims trigger one targeted edit retry instead of discarding all generated copy", async () => {
  let calls = 0;
  const generated = await generateFactualPost(
    {
      businessContext: { ...context, businessType: "bakery_cafe", products: "kenyér" },
      brief: "Mutasd be a kenyeret.",
      title: "Kenyér",
      platforms: ["facebook"],
      ctaStyle: "Látogass el!",
    },
    async (request) => {
      calls++;
      if (calls === 2) {
        assert.match(request.messages.at(-1)!.content, /ár vagy pénzösszeg/);
        assert.match(request.messages.at(-1)!.content, /Töröld ezt az állítást/);
      }
      const content = calls === 1 ? "Kenyér 15 lej. Látogass el!" : "Kenyér elvitelre. Látogass el!";
      return Response.json({
        choices: [{ message: { content: JSON.stringify({ variants: [{
          platform: "facebook", content, cta: "Látogass el!", hashtags: [], ellenorizendo: [],
        }] }) } }],
      });
    },
  );
  assert.equal(calls, 2);
  assert.match(generated.variants[0].content, /Kenyér elvitelre/);
});

test("unsupported popularity is repaired once, but a popularity fact supplied by the owner passes", async () => {
  let calls = 0;
  const input = {
    businessContext: { ...context, businessType: "bakery_cafe", products: "kakaós csiga" },
    brief: "Mutasd be a kakaós csigát reggelire.",
    title: "Kakaós csiga",
    platforms: ["facebook"],
    ctaStyle: "Látogass el!",
  };
  const repaired = await generateFactualPost(input, async (request) => {
    calls++;
    if (calls === 2) assert.match(request.messages.at(-1)!.content, /sokak kedvence|népszerűségi/iu);
    const content = calls === 1
      ? "A kakaós csiga sokak kedvence. Látogass el!"
      : "A kakaós csiga reggelire. Látogass el!";
    return Response.json({ choices: [{ message: { content: JSON.stringify({ variants: [{
      platform: "facebook", content, cta: "Látogass el!", hashtags: [], ellenorizendo: [],
    }] }) } }] });
  });
  assert.equal(calls, 2);
  assert.match(repaired.variants[0].content, /A kakaós csiga reggelire/);
  assert.doesNotMatch(repaired.variants[0].content, /sokak kedvence/u);

  let ownerCalls = 0;
  const ownerBrief = "Mutasd be a kakaós csigát, és mondd el: ez a vendégeink kedvence.";
  const ownerOutput = await generateFactualPost({ ...input, brief: ownerBrief }, async () => {
    ownerCalls++;
    const content = "Ez a vendégeink kedvence. Látogass el!";
    return Response.json({ choices: [{ message: { content: JSON.stringify({ variants: [{
      platform: "facebook", content, cta: "Látogass el!", hashtags: [], ellenorizendo: [],
    }] }) } }] });
  });
  assert.equal(ownerCalls, 1);
  assert.match(ownerOutput.variants[0].content, /vendégeink kedvence/u);
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

test("weekly accommodation plan accepts soft descriptors and returns them as owner review items", async () => {
  const week = campaignWeeks("2026-10-12", 7)[0];
  const result = await generateWeeklyPlan(
    {
      businessContext: {
        ...context,
        businessType: "accommodation",
        products: "szállás",
        services: "hétvégi pihenés",
        approvedClaims: ["Családokat is fogadunk"],
      },
      campaign: {
        name: "Heti pihenés",
        objective: "érdeklődés",
        offer: "",
        description: "Ismertesd meg a szálláshelyet.",
        startDate: week.startDate,
        endDate: week.endDate,
        timezone: "Europe/Bucharest",
        cta: "Foglalj most!",
      },
      channels: ["facebook"],
      week,
      plannedTopics: [],
      channelCounts: { facebook: 0 },
      localEvents: [],
      weekly: true,
    },
    async (request) => {
      const sent = JSON.parse(request.messages[1].content);
      assert.deepEqual(sent.markaprofil.approvedClaims, ["Családokat is fogadunk"]);
      return Response.json({
        choices: [{ message: { content: JSON.stringify({
          het: 1,
          szakasz: "ismertség",
          posztok: ["kérdés", "kulissza", "tipp", "szezonális"].map((tipus, index) => ({
            datum: `2026-10-${12 + index * 2}`,
            idopont: "10:00",
            csatorna: "facebook",
            tipus,
            forma: "egyképes",
            tema: ["Pihenés", "Szállás", "Környék", "Hétvége"][index],
            cel: "bizalom",
          vazlat: index === 0
              ? "Csendes, kényelmes pihenés. Foglalj most!"
              : "A szálláshelyről szóló poszt. Foglalj most!",
            vizualis_otlet: "Fotó a szállásról.",
            ellenorizendo: [],
          })),
          temak_osszefoglalo: ["Pihenés", "Szállás", "Környék", "Hétvége"],
        }) } }],
      });
    },
  );
  assert.ok(result.posztok[0].ellenorizendo.some((warning) => warning.toLocaleLowerCase("hu").includes("csendes")));
  assert.ok(result.posztok[0].ellenorizendo.some((warning) => warning.toLocaleLowerCase("hu").includes("kényelmes")));
});
