import { defineConfig } from "nitro/config";

export default defineConfig({
  plugins: ["./server/plugins/production-guard.ts"],
});
