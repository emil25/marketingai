import assert from "node:assert/strict";
import { test } from "node:test";
import { currentIdeaBank } from "../src/lib/idea-bank";
import { appendQuestionClosing, replaceOpeningLine } from "../src/lib/post-quick-actions";
import { weeklyServiceTipRule } from "../src/lib/server/weekly-plan.server";

const bank = {
  businessType: "bakery_cafe",
  audience: "helyi családok",
  ideas: Array.from({ length: 20 }, (_, index) => `Téma ${index}`),
  generatedAt: "2026-10-12T10:00:00.000Z",
};

test("idea bank is reused only for the matching business type and audience", () => {
  assert.equal(currentIdeaBank(bank, "bakery_cafe", "helyi családok"), bank);
  assert.equal(currentIdeaBank(bank, "hair_salon", "helyi családok"), null);
  assert.equal(currentIdeaBank(bank, "bakery_cafe", "más közönség"), null);
});

test("quick edits replace only the opening and append a closing question", () => {
  const original = "Eredeti nyitás.\nA szöveg többi része.\nÍrj nekünk!";
  assert.equal(
    replaceOpeningLine(original, "Új nyitás?"),
    "Új nyitás?\nA szöveg többi része.\nÍrj nekünk!",
  );
  assert.equal(appendQuestionClosing(original, "Te mit választanál?"), `${original}\n\nTe mit választanál?`);
});

test("service weekly tips are included while regulated fields forbid promises", () => {
  assert.match(weeklyServiceTipRule("hair_salon"), /Hasznos tipp \/ ellenőrzőlista/);
  assert.match(weeklyServiceTipRule("dental_practice"), /ígéret nélküli tájékoztatást/);
  assert.doesNotMatch(weeklyServiceTipRule("restaurant"), /Hasznos tipp \/ ellenőrzőlista/);
});
