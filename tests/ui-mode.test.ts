import test from "node:test";
import assert from "node:assert/strict";
import { UiPreferencesSchema, uiPreferences } from "../src/lib/ui-mode";
test("legacy accounts default to simple without modifying any data", () => {
  const user = Object.freeze({});
  assert.deepEqual(uiPreferences(user), { ui_mode: "simple", suggestionDismissed: false });
  assert.deepEqual(user, {});
});
test("only supported modes and dismissal flags may be saved; caller cannot choose another user", () => {
  for (const input of [
    { ui_mode: "admin" },
    { ui_mode: null },
    { ui_mode: true },
    { userId: "other", ui_mode: "detailed" },
    {},
    { suggestionDismissed: "true" },
  ])
    assert.equal(UiPreferencesSchema.safeParse(input).success, false);
  assert.equal(
    UiPreferencesSchema.safeParse({ ui_mode: "detailed", suggestionDismissed: true }).success,
    true,
  );
  assert.deepEqual(uiPreferences({ uiMode: "detailed", uiModeSuggestionDismissed: true }), {
    ui_mode: "detailed",
    suggestionDismissed: true,
  });
});
