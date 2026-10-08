import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeBusinessWebsite,
  serializeBusinessHours,
  validateLogoBytes,
  validateLogoFile,
} from "../src/lib/onboarding-details";

test("business websites accept a missing scheme but reject unsafe protocols and credentials", () => {
  assert.equal(normalizeBusinessWebsite("muhely.ro"), "https://muhely.ro/");
  assert.equal(
    normalizeBusinessWebsite(" https://muhely.ro/ajanlat "),
    "https://muhely.ro/ajanlat",
  );
  assert.equal(normalizeBusinessWebsite(""), "");
  for (const url of [
    "javascript:alert(1)",
    "data:text/plain,x",
    "https://user:pass@muhely.ro",
    "nem egy webcím",
  ])
    assert.throws(() => normalizeBusinessWebsite(url));
});
test("opening hours preserve explicitly closed days, unknown days and overnight times", () => {
  assert.equal(
    serializeBusinessHours([
      { day: "Hétfő", status: "open", from: "07:00", to: "16:30" },
      { day: "Kedd", status: "unknown", from: "", to: "" },
      { day: "Vasárnap", status: "closed", from: "", to: "" },
    ]),
    "Hétfő: 07:00–16:30; Vasárnap: zárva",
  );
  assert.equal(
    serializeBusinessHours([{ day: "Péntek", status: "open", from: "20:00", to: "02:00" }]),
    "Péntek: 20:00–02:00 (zárás másnap)",
  );
  assert.throws(
    () => serializeBusinessHours([{ day: "Hétfő", status: "open", from: "", to: "16:00" }]),
    /Hétfő/,
  );
  assert.throws(() =>
    serializeBusinessHours([{ day: "Hétfő", status: "open", from: "25:00", to: "16:00" }]),
  );
});
test("logo uploads reject oversized files, SVG and MIME spoofing", () => {
  assert.throws(() => validateLogoFile({ type: "image/png", size: 3 * 1024 * 1024 }), /2 MB/);
  assert.throws(() => validateLogoFile({ type: "image/svg+xml", size: 100 }));
  assert.throws(() =>
    validateLogoBytes(new TextEncoder().encode("<script>bad</script>"), "image/png"),
  );
  assert.doesNotThrow(() =>
    validateLogoBytes(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"),
  );
});
