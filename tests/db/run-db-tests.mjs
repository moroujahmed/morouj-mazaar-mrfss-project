#!/usr/bin/env node
/**
 * Run the SQL database/RLS acceptance suite.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55433/mrfss_final \
 *     node tests/db/run-db-tests.mjs
 *
 * PSQL_BIN can point at a specific psql executable.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:55433/mrfss_final";

const candidates = [
  process.env.PSQL_BIN,
  "psql",
  "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe",
  "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe",
  "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe",
  "/usr/bin/psql",
].filter(Boolean);

const psql = candidates.find((candidate) => {
  if (candidate === "psql") return true;
  return existsSync(candidate);
});

if (!psql) {
  console.error(
    "psql was not found. Set PSQL_BIN or install PostgreSQL client tools.",
  );
  process.exit(1);
}

const suites = [
  join("tests", "db", "rls.sql"),
  join("tests", "db", "orders.sql"),
  join("tests", "db", "kitchen.sql"),
  join("tests", "db", "rider.sql"),
  join("tests", "db", "admin.sql"),
];

for (const suite of suites) {
  const result = spawnSync(
    psql,
    [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", suite],
    { stdio: "inherit", env: process.env },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Database and RLS tests passed.");
