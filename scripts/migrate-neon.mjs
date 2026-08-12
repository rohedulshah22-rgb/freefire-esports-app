import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error("NEON_DATABASE_URL is not configured");
}

const sqlPath = resolve(process.cwd(), "neon_migration.sql");
const sql = await readFile(sqlPath, "utf8");
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: true },
});

try {
  await client.connect();
  await client.query(sql);
  console.log("Neon PostgreSQL migration completed successfully.");
} finally {
  await client.end().catch(() => undefined);
}
