import { definePlugin } from "nitro";
import { assertProductionConfiguration } from "../../src/lib/server/production-config.server";

// Nitro runs this before serving requests (Node boot / serverless cold start).
export default definePlugin(() => assertProductionConfiguration());
