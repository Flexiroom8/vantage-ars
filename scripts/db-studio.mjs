#!/usr/bin/env node
/**
 * Minimal SQL console against the active database.
 *
 *   echo "select 1" | npm run db:studio
 *   npm run db:studio -- "select count(*) from leads"
 *
 * Reads SQL from argv (joined) or stdin, executes it with the
 * same backend selection as the app (DATABASE_URL → Postgres,
 * otherwise embedded PGLite), and prints rows as JSON.
 */
import { getSql } from "../src/lib/db.ts";

const fromArgv = process.argv.slice(2).join(" ").trim();
let sqlText = fromArgv;
if (!sqlText && !process.stdin.isTTY) {
  sqlText = (await new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  })).trim();
}

if (!sqlText) {
  console.error("Usage: db-studio.mjs <sql>   (or pipe SQL on stdin)");
  process.exit(64);
}

try {
  const sql = await getSql();
  const rows = await sql.query(sqlText, []);
  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error("Query failed:", error?.message ?? error);
  process.exitCode = 1;
}
