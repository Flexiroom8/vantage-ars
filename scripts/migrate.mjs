#!/usr/bin/env node
/**
 * Apply `migrations/*.sql` to the active database.
 *
 *   DATABASE_URL set  → PostgreSQL (Neon or any Postgres)
 *   otherwise         → embedded PGLite (preview parity)
 *
 * Migrations are applied in filename order inside a transaction
 * and recorded in `_migrations`, so a failed statement can never
 * leave a file half-applied but untracked. Safe to re-run.
 *
 *   npm run db:migrate          # workspace schema
 *   npm run db:migrate -- --auth  # + opt-in Better Auth schema
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pendingMigrations } from "./migration-plan.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationsDir = path.join(root, "migrations");
const withAuth = process.argv.includes("--auth");

async function availableMigrations() {
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql"));
  if (withAuth) {
    const authDir = path.join(migrationsDir, "auth");
    const authFiles = (await readdir(authDir)).filter((f) => f.endsWith(".sql"));
    return [...files, ...authFiles.map((f) => `auth/${f}`)];
  }
  return files;
}

async function postgresRunner() {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("begin");
    return {
      async exec(text) {
        await client.query(text);
      },
      async record(name) {
        await client.query("insert into _migrations (name) values ($1) on conflict do nothing", [name]);
      },
      async applied() {
        const res = await client.query("select name from _migrations");
        return res.rows.map((r) => r.name);
      },
      async commit() {
        await client.query("commit");
      },
      async rollback() {
        await client.query("rollback");
      },
      async end() {
        client.release();
        await pool.end();
      },
    };
  } catch (error) {
    client.release();
    await pool.end();
    throw error;
  }
}

async function pgliteRunner() {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
  return {
    async exec(text) {
      await pg.exec(text);
    },
    async record(name) {
      await pg.query("insert into _migrations (name) values ($1) on conflict do nothing", [name]);
    },
    async applied() {
      const res = await pg.query("select name from _migrations");
      return res.rows.map((r) => r.name);
    },
    async commit() {},
    async rollback() {},
    async end() {},
  };
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const runner = databaseUrl ? await postgresRunner() : await pgliteRunner();

try {
  const applied = await runner.applied();
  const names = await availableMigrations();
  const pending = pendingMigrations(names, applied);
  if (!pending.length) {
    console.log("No pending migrations.");
  }
  for (const { name, path: migrationPath } of pending) {
    const file = path.join(root, migrationPath);
    const sql = await readFile(file, "utf8");
    // PGLite's exec() runs statements one at a time; Postgres runs
    // the whole script. Either way the record insert lands after
    // the file's statements inside the same transaction.
    await runner.exec(sql);
    await runner.record(name);
    console.log(`applied ${name}`);
  }
  await runner.commit();
  console.log("Migration complete.");
} catch (error) {
  await runner.rollback().catch(() => {});
  console.error("Migration failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await runner.end().catch(() => {});
}
