import { spawn } from "node:child_process";
import path from "node:path";

const viteScript = path.resolve("node_modules/vite/bin/vite.js");
const child = spawn(process.execPath, [viteScript, "build"], {
  env: { ...process.env, NITRO_PRESET: "node-server" },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Node production build indítása sikertelen: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) process.exitCode = 1;
  else process.exitCode = code ?? 1;
});
