# Neon PostgreSQL Migration and Release Guide

## Purpose

The application uses **Neon PostgreSQL** exclusively through the `NEON_DATABASE_URL` environment variable. The old `DATABASE_URL` value is not read by the application database layer and must not be used for tournament, wallet, or admin data.

## Initial database provisioning

Before deploying a fresh environment, set `NEON_DATABASE_URL` as a secure project secret. The value must be a PostgreSQL connection string with TLS enabled. Then apply the idempotent production schema migration:

```bash
node scripts/migrate-neon.mjs
```

The script executes `neon_migration.sql`, which creates the enums, tables, indexes, database functions, triggers, row-level security policies, and required BR/CS/Lone Wolf structures. It can be re-run safely because the migration statements are idempotent.

## Application rollout order

1. Set `NEON_DATABASE_URL` in the deployment environment.
2. Run `node scripts/migrate-neon.mjs` against the target Neon database.
3. Deploy the application build.
4. Start the server once. Startup initializes the supported categories and modes:
   - BR: Solo, Duo, Squad.
   - CS: 1v1, 2v2, 4v4.
   - Lone Wolf: 1v1, 2v2, 4v4.
5. Verify the read-only connection and write-contract checks with `pnpm test`.

## Validation commands

```bash
pnpm test
pnpm exec tsc --noEmit
```

`server/neon.connection.test.ts` confirms a live read-only connection and the BR mode records. `server/neon.write-contract.test.ts` validates match, wallet, participant, deposit, withdrawal, and transaction writes inside a database transaction that is always rolled back; it leaves no records in Neon.

## Drizzle migration safety

`drizzle.config.ts` is configured for the PostgreSQL dialect and `NEON_DATABASE_URL`. The `drizzle/0000_living_karma.sql` file is an introspected, commented **baseline** of the already-applied Neon schema. Previous MySQL migration files are retained under `drizzle/mysql-legacy/` for historical reference only.

Do **not** apply generated Drizzle SQL automatically to the production database. The live schema includes explicit RLS policies, checks, indexes, and named constraints that must be retained. For each future schema change, update `drizzle/schema.ts`, generate a diff for review, inspect it for destructive operations or policy/constraint removals, and incorporate the approved change into a reviewed PostgreSQL migration before applying it to Neon.
