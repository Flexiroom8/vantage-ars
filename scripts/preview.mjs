#!/usr/bin/env node
/**
 * Manage the long-running preview server.
 *
 *   node scripts/preview.mjs restart   # start (or bounce) the server
 *   node scripts/preview.mjs stop      # stop it
 *
 * The server process is `node src/node.js`. A pidfile in
 * `.preview-server.pid` tracks the process so restart/stop are
 * reliable across shells.
 */
import { spawn } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const pidFile = path.join(root, ".preview-server.pid");

async function readPid() {
  try {
    const raw = (await readFile(pidFile, "utf8")).trim();
    const pid = Number(raw);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM"; // exists but owned by another user
  }
}

async function stop() {
  const pid = await readPid();
  if (!pid || !alive(pid)) {
    await unlink(pidFile).catch(() => {});
    console.log("Preview server is not running.");
    return;
  }
  process.kill(pid, "SIGTERM");
  for (let i = 0; i < 30; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (!alive(pid)) break;
  }
  if (alive(pid)) process.kill(pid, "SIGKILL");
  await unlink(pidFile).catch(() => {});
  console.log("Preview server stopped.");
}

async function start() {
  const existing = await readPid();
  if (existing && alive(existing)) {
    console.log(`Preview server already running (pid ${existing}).`);
    return;
  }
  const child = spawn(process.execPath, [path.join(root, "src", "node.js")], {
    cwd: root,
    env: { ...process.env, PORT: process.env.PORT || "3000" },
    stdio: "inherit",
    detached: true,
  });
  child.unref();
  await writeFile(pidFile, String(child.pid), "utf8");
  console.log(`Preview server started (pid ${child.pid}) on port ${process.env.PORT || "3000"}.`);
}

const command = process.argv[2] || "restart";
if (command === "stop") {
  await stop();
} else if (command === "restart") {
  await stop();
  await start();
} else if (command === "start") {
  await start();
} else {
  console.error("Usage: node scripts/preview.mjs [start|restart|stop]");
  process.exit(64);
}
