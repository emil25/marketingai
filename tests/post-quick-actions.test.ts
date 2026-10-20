import assert from "node:assert/strict";
import { test } from "node:test";
import type { BusinessContext } from "../src/lib/business-types";
import { contentRuleFindings } from "../src/lib/content-quality";
import {
  generateIdeaBank,
  generateOpeningOptions,
  generateQuestionClosings,
  generateSimilarPosts,
  improveCopy,
  QUICK_ACTION_RULES,
} from "../src/lib/server/post-quick-actions.server";
import { replaceOpeningLine } from "../src/lib/post-quick-actions";

const businessContext: BusinessContext = {
  brandId: "brand-test",
  businessType: "bakery_cafe",
  businessTypeLabel: "Pékség / kávézó / cukrászda",
  brandName: "Műhely Pékség",
  industry: "pékség",
  website: "",
  region: "Csíkszereda",
  language: "magyar",
  products: "kovászos kenyér, kakaós csiga",
  services: "elvitel",
  offers: "",
  audience: "helyiek",
  tone: "közvetlen",
  ctaStyle: "Látogass el hozzánk!",
  preferredPhrases: "",
  avoidedPhrases: "",
  learnedBrandVoice: "",
  address: "",
  openingHours: "",
  guardrails: "Csak megadott tények",
  brandDescription: "",
};

const sourceText = "Kovászos kenyér és kakaós csiga.\nLátogass el hozzánk!";
const request = (result: unknown) => async (input: { maxTokens?: number; messages: Array<{ role: string; content: string }> }) => {
  assert.ok(input.maxTokens && input.maxTokens <= 3000);
  assert.match(input.messages[0].content, /Csak a megadott tényekből dolgozz/);
  assert.match(input.messages[0].content, /Tilos aktivitásvadász felszólítást/);
  assert.match(input.messages[0].content, /Műhely Pékség/);
  return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
};

function options(openings: string[]) {
  return {
    options: ["kérdés", "konkrét kép", "hasznos tipp", "szezon", "érzés"].map(
      (megkozelites, index) => ({ megkozelites, text: openings[index] }),
    ),
  };
}

test("opening and closing options use short bounded requests and preserve the source", async () => {
  const openings = [
    "Te melyik pékárut választod reggel?",
    "Egy szelet kenyér és egy kakaós csiga.",
    "Egy rövid gondolat a megadott kínálatról.",
    "Milyen ízeket választasz mostanában?",
    "Neked melyik íz esik jól?",
  ];
  const result = await generateOpeningOptions(
    { businessContext, platform: "facebook", sourceText },
    request(options(openings)),
  );
  assert.equal(result.options.length, 5);
  assert.equal(
    replaceOpeningLine(sourceText, result.options[0].text),
    `${openings[0]}\n${sourceText.slice(sourceText.indexOf("\n") + 1)}`,
  );

  const closings = await generateQuestionClosings(
    { businessContext, platform: "facebook", sourceText },
    request({ questions: ["Te melyiket választanád?", "Mikor ennél ilyet?", "Melyik ízt kedveled?", "Mit próbálnál ki?" ] }),
  );
  assert.equal(closings.questions.length, 4);
  assert.ok(closings.questions.every((question) => question.endsWith("?")));
});

test("natural inflections in opening options remain grounded in the saved post", () => {
  const candidates = [
    "Te melyiket választod: kovászos kenyeret vagy kakaós csigát?",
    "Kovászos kenyérrel vagy kakaós csigával kezdenéd?",
    "Egy egyszerű választás a megadott kínálatból.",
    "Melyik illik jobban ahhoz, amit most ennél?",
    "Neked melyik jut eszedbe először?",
  ];
  for (const opening of candidates) {
    const content = replaceOpeningLine(sourceText, opening);
    const hard = contentRuleFindings(
      content,
      "facebook",
      JSON.stringify({ ...businessContext, suppliedText: sourceText }),
      [],
      "magyar",
      { businessType: "bakery_cafe" },
    ).filter((finding) => finding.severity === "hard");
    assert.deepEqual(hard, [], `${opening}: ${hard.map((finding) => finding.message).join("; ")}`);
  }
});

test("invented claims and activity bait are rejected and the model receives one repair instruction", async () => {
  let call = 0;
  const result = await generateOpeningOptions(
    { businessContext, platform: "facebook", sourceText },
    async (input) => {
      call++;
      if (call === 2) {
        assert.match(input.messages.at(-1)?.content ?? "", /ár vagy pénzösszeg/);
        assert.match(input.messages.at(-1)?.content ?? "", /aktivitásvadász/);
        assert.match(input.messages[0].content, /vendégvéleményt, számot, eredményt/);
      }
      return Response.json({
        choices: [{ message: { content: JSON.stringify(options(
          call === 1
            ? ["20 lej a kenyér. Kommentelj IGEN-t!", "Egy falat kenyér.", "Válassz egy ötletet.", "Milyen ízeket szeretsz?", "Mit ennél ma?"]
            : ["Te melyik ízt választod?", "Egy szelet kenyér az asztalon.", "Egy rövid tipp a választáshoz.", "Milyen íz illik a napodhoz?", "Neked melyik esne jól?"]
        )) } }],
      });
    },
  );
  assert.equal(call, 2);
  assert.equal(result.options.length, 5);
  assert.ok(QUICK_ACTION_RULES.includes("Ne adj hozzá új állítást"));
});

test("editing a supplied post preserves the facts and gives no more than three reasons", async () => {
  const result = await improveCopy(
    { businessContext, platform: "facebook", sourceText },
    request({
      content: "Te melyiket választod? Kovászos kenyér és kakaós csiga. Látogass el hozzánk!",
      cta: "Látogass el hozzánk!",
      hashtags: [],
      reasons: [
        { change: "Erősebb nyitás", reason: "Közvetlen kérdés indítja a szöveget." },
        { change: "Rövidebb mondatok", reason: "Külön gondolatokra bontja." },
      ],
    }),
  );
  assert.equal(result.reasons.length, 2);
  assert.equal(result.content.includes("Kovászos kenyér"), true);
  assert.equal(
    contentRuleFindings(result.content, "facebook", JSON.stringify({ ...businessContext, suppliedText: sourceText }), [], "magyar", { businessType: "bakery_cafe" }).filter((finding) => finding.severity === "hard").length,
    0,
  );
});

test("similar posts are three unique, checked angles and the idea bank has twenty distinct safe ideas", async () => {
  const posts = await generateSimilarPosts(
    { businessContext, platform: "facebook", sourceText },
    request({
      posts: ["kérdés", "hasznos tipp", "kulissza"].map((megkozelites, index) => ({
        megkozelites,
        title: `Új nézőpont ${index + 1}`,
        content: `${["Te melyiket választanád?", "Egy rövid tipp a megadott kínálatról.", "Így készül a poszt ötlete."][index]} Kovászos kenyér és kakaós csiga. Látogass el hozzánk!`,
        cta: "Látogass el hozzánk!",
        hashtags: [],
        ellenorizendo: [],
      })),
    }),
  );
  assert.equal(posts.posts.length, 3);

  const ideas = await generateIdeaBank(
    businessContext,
    request({ ideas: Array.from({ length: 20 }, (_, index) => `Témaötlet a pékségnek ${index + 1}`) }),
  );
  assert.equal(ideas.ideas.length, 20);
  assert.equal(new Set(ideas.ideas).size, 20);
});
