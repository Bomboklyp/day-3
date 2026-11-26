import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyHttp } from "../tests/http-smoke";
import { verifyBrowser } from "./test-ui";
import { verifyInteractions } from "./test-interactions";
import type { ApiItem, ApiRequest } from "../shared/types/api";

const base = "http://127.0.0.1:3103";
await mkdir(".verification/day3", { recursive: true });
const dataFile = resolve(`.verification/day3/api-test-${Date.now()}.json`);
let server: ChildProcess | undefined;
let logs = "";
async function start() {
  server = spawn(process.execPath, [".output/server/index.mjs"], {
    cwd: process.cwd(),
    windowsHide: true,
    env: {
      ...process.env,
      PORT: "3103",
      HOST: "127.0.0.1",
      WORKFLOW_DATA_FILE: dataFile,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk: Buffer) => {
    logs += chunk.toString();
  });
  server.stderr?.on("data", (chunk: Buffer) => {
    logs += chunk.toString();
  });
  server.on("error", (error) => {
    logs += error.message;
  });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`QA server stopped: ${logs}`);
    try {
      if ((await fetch(base + "/api/users")).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`QA server did not start: ${logs}`);
}
async function stop() {
  if (server && server.exitCode === null) {
    const closed = once(server, "exit");
    server.kill();
    await closed;
  }
}
try {
  await start();
  const http = await verifyHttp(base);
  const ui = process.argv.includes("--actions-only")
    ? { createdId: undefined, screenshots: [], errors: [] }
    : await verifyBrowser(base, process.argv.includes("--visual-only"));
  const interactions = process.argv.includes("--visual-only")
    ? undefined
    : await verifyInteractions(base);
  if (ui.createdId) {
    await stop();
    await start();
    const saved = (await (
      await fetch(`${base}/api/requests/${ui.createdId}`)
    ).json()) as ApiItem<ApiRequest>;
    assert.equal(saved.data.assignee_id, "user-3");
    assert.ok(
      saved.data.comments?.some(
        (comment) => comment.text === "Комментарий через API",
      ),
    );
    console.log("OK server restart: request, comment and assignment persisted");
  }
  const report = {
    day: 3,
    testedAt: new Date().toISOString(),
    base,
    isolatedDatabase: true,
    http,
    ...ui,
    interactions,
  };
  await writeFile(
    ".verification/day3/report.json",
    JSON.stringify(report, null, 2),
  );
  await writeFile(
    "design/figma/verification-day3.json",
    JSON.stringify(report, null, 2),
  );
  console.log("PASS Day 3: .verification/day3/report.json");
} finally {
  await stop();
  await writeFile(".verification/day3/server.log", logs);
}
