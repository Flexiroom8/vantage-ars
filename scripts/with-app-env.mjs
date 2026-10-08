#!/usr/bin/env node
/**
 * Run a command with the app's dev environment.
 *
 * Usage: node scripts/with-app-env.mjs <command> [args...]
 *
 * Sets the defaults the Vite dev server expects (dev NODE_ENV,
 * the app's dev port contract) without overriding values the
 * operator already exported. Then execs the command with the
 * same stdio, so Ctrl-C and logs behave normally.
 */
import { spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/with-app-env.mjs <command> [args...]");
  process.exit(64);
}

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || "8080",
};

const child = spawn(command, args, {
  env,
  stdio: "inherit",
  shell: false,
});

// Forward termination signals so the wrapper never outlives the command.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
