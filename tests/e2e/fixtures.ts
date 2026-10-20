import { test as base } from "@playwright/test";
import { preparePreviewProtection } from "./protection";
export const test = base.extend<{ previewProtection: void }>({
  previewProtection: [
    async ({ context, baseURL }, use) => {
      const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      if (process.env.BASE_URL && secret && baseURL) {
        await preparePreviewProtection(context, baseURL, secret);
      }
      await use();
    },
    { auto: true },
  ],
});
