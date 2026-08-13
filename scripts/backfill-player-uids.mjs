import { Client } from "pg";

const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) throw new Error("NEON_DATABASE_URL is required");

const client = new Client({ connectionString, ssl: { rejectUnauthorized: true } });
await client.connect();
try {
  const result = await client.query(
    `UPDATE "users"
     SET "playerUid" = (8000000000 + "id")::text
     WHERE "playerUid" IS NULL
     RETURNING "id", "playerUid"`,
  );
  console.log(`Backfilled ${result.rowCount ?? 0} player UID(s).`);
} finally {
  await client.end();
}
