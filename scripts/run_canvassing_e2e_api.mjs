import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const port = process.env.CANVASS_PORT ?? "4280";
const directory = await mkdtemp(join(tmpdir(), "living-region-canvassing-e2e-"));
const child = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "packages/canvassing/src/server.ts"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CANVASS_HOST: "127.0.0.1",
      CANVASS_PORT: port,
      CANVASS_DB: join(directory, "canvassing.sqlite"),
      CANVASS_EVENT_LOG: join(directory, "events.jsonl"),
      CANVASS_CALIBRATION_EXPORT: join(directory, "address-number-calibration.json"),
      CANVASS_SPLIT_CALIBRATION_EXPORT: join(directory, "structure-split-calibration.json"),
    },
    stdio: "inherit",
  },
);

let stopping = false;
const stop = async (signal = "SIGTERM") => {
  if (stopping) return;
  stopping = true;
  child.kill(signal);
  await rm(directory, { recursive: true, force: true });
};
process.on("SIGINT", () => void stop("SIGINT"));
process.on("SIGTERM", () => void stop());
process.on("exit", () => {
  if (!stopping) child.kill("SIGTERM");
});

for (let attempt = 0; attempt < 120; attempt++) {
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/canvassing/health`,
    );
    if (response.ok) break;
  } catch {}
  if (child.exitCode != null) process.exit(child.exitCode || 1);
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (attempt === 119) throw new Error("Disposable canvassing API did not start");
}

await new Promise((resolve) => child.once("exit", resolve));
await rm(directory, { recursive: true, force: true });
