ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "freeFireName" varchar(64),
  ADD COLUMN IF NOT EXISTS "freeFireUid" varchar(32);
