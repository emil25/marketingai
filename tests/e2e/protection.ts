import type { BrowserContext } from "@playwright/test";

export async function preparePreviewProtection(
  context: BrowserContext,
  baseURL: string,
  secret: string,
) {
  try {
    // Bootstrap the scoped bypass cookie once. Never forward the credential on redirects,
    // external images or fonts; the browser then uses its normal cookie jar.
    const response = await context.request.get(new URL(baseURL).origin, {
      headers: {
        "x-vercel-protection-bypass": secret,
        "x-vercel-set-bypass-cookie": "true",
      },
      maxRedirects: 0,
      timeout: 30000,
      failOnStatusCode: false,
    });
    if (response.status() >= 400) throw new Error("Preview access rejected");
    await response.dispose();
  } catch {
    // APIRequest errors can include request headers. Never propagate their call log.
    throw new Error(
      "Az előnézet védelmét nem sikerült feloldani. Ellenőrizd a tesztfuttató hozzáférését.",
    );
  }
}
