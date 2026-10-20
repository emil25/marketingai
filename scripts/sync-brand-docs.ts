import { readFile, writeFile } from "node:fs/promises";
import { brandForLocale, DEFAULT_MARKET_LOCALE } from "../src/config/brand";

const brand = brandForLocale(DEFAULT_MARKET_LOCALE);
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const updated = readme
  .replace(/^# .*$/m, `# ${brand.productName} V2`)
  .replaceAll("MarketingPilot", brand.productName);
if (updated !== readme) await writeFile(new URL("../README.md", import.meta.url), updated, "utf8");
