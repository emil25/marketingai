import assert from "node:assert/strict";
import { test } from "node:test";
import { LANDING_DEMOS, LANDING_EXAMPLE } from "../src/lib/landing-example";

test("landing samples offer distinct Hungarian and Romanian copy for both social channels", () => {
  for (const demo of LANDING_DEMOS) {
    for (const language of ["hu", "ro"] as const) {
      const facebook = demo.copy.facebook[language];
      const instagram = demo.copy.instagram[language];
      assert.ok(facebook.trim(), `${demo.id} Facebook ${language} copy is present`);
      assert.ok(instagram.trim(), `${demo.id} Instagram ${language} copy is present`);
      assert.notEqual(facebook, instagram, `${demo.id} should adapt the copy to the channel`);
      assert.ok((facebook.match(/#[\p{L}\p{N}_]+/gu) ?? []).length <= 2);
      assert.ok((instagram.match(/#[\p{L}\p{N}_]+/gu) ?? []).length >= 4);
    }
  }
});

test("demo contacts stay as placeholders and the signup example uses the displayed Facebook sample", () => {
  const auto = LANDING_DEMOS.find((demo) => demo.id === "auto-service");
  assert.ok(auto);
  assert.match(auto.copy.facebook.hu, /\[telefonszám\]/);
  assert.match(auto.copy.instagram.hu, /\[telefonszám\]/);
  assert.match(auto.copy.facebook.ro, /\[număr de telefon\]/);
  assert.equal(LANDING_EXAMPLE.text, LANDING_DEMOS[0].copy.facebook.hu);
});
