import pg from "pg";

// Connectivity check for the Neon wiring. Reads DATABASE_URL from the
// environment; prints the server version and (with "count") how many of the
// repo's migrations are recorded as applied.
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const v = await client.query("SELECT version()");
  console.log("connected:", v.rows[0].version.split(",")[0]);
  if (process.argv[2] === "count") {
    const m = await client.query("SELECT count(*)::int AS n FROM _migrations");
    console.log("migrations applied:", m.rows[0].n);
  }
  console.log("connectivity OK");
} finally {
  await client.end();
}
