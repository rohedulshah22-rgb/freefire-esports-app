-- Pro-Esports Free Fire Platform — Neon PostgreSQL migration
-- Execute with the server-side NEON_DATABASE_URL only. This migration is idempotent.

BEGIN;

CREATE TYPE app_role AS ENUM ('user', 'admin');
CREATE TYPE transaction_kind AS ENUM (
  'deposit', 'withdrawal', 'match_entry', 'kill_reward', 'prize_win',
  'refund', 'referral_bonus', 'admin_adjustment'
);
CREATE TYPE balance_kind AS ENUM ('deposit', 'winning', 'bonus');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE match_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled', 'expired');
CREATE TYPE participant_status AS ENUM ('joined', 'confirmed', 'cancelled', 'completed');
CREATE TYPE deposit_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE payout_method AS ENUM ('upi', 'google_play');

CREATE TABLE "users" (
  "id" BIGSERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  "name" TEXT,
  "email" VARCHAR(320),
  "loginMethod" VARCHAR(64),
  "role" app_role NOT NULL DEFAULT 'user',
  "deviceId" VARCHAR(128) UNIQUE,
  "isAndroidMobile" BOOLEAN NOT NULL DEFAULT TRUE,
  "isBanned" BOOLEAN NOT NULL DEFAULT FALSE,
  "banReason" TEXT,
  "referralCode" VARCHAR(32) UNIQUE,
  "referredBy" BIGINT REFERENCES "users"("id") ON DELETE SET NULL,
  "referralBonusAwarded" BOOLEAN NOT NULL DEFAULT FALSE,
  "adminUsername" VARCHAR(64) UNIQUE,
  "adminPasswordHash" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastSignedIn" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "wallets" (
  "id" BIGSERIAL PRIMARY KEY,
  "userId" BIGINT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "depositBalance" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("depositBalance" >= 0),
  "winningBalance" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("winningBalance" >= 0),
  "bonusBalance" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("bonusBalance" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "matchCategories" (
  "id" BIGSERIAL PRIMARY KEY,
  "name" VARCHAR(64) NOT NULL UNIQUE,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "matchModes" (
  "id" BIGSERIAL PRIMARY KEY,
  "categoryId" BIGINT NOT NULL REFERENCES "matchCategories"("id") ON DELETE CASCADE,
  "name" VARCHAR(64) NOT NULL,
  "teamSize" INTEGER NOT NULL CHECK ("teamSize" > 0),
  "maxPlayers" INTEGER NOT NULL CHECK ("maxPlayers" > 0),
  "entryFee" NUMERIC(10,2) NOT NULL CHECK ("entryFee" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("categoryId", "name")
);

CREATE TABLE "matches" (
  "id" BIGSERIAL PRIMARY KEY,
  "categoryId" BIGINT NOT NULL REFERENCES "matchCategories"("id") ON DELETE RESTRICT,
  "modeId" BIGINT NOT NULL REFERENCES "matchModes"("id") ON DELETE RESTRICT,
  "matchTitle" VARCHAR(128) NOT NULL,
  "mapName" VARCHAR(128) NOT NULL,
  "scheduledStartTime" TIMESTAMPTZ NOT NULL,
  "scheduledEndTime" TIMESTAMPTZ,
  "roomId" VARCHAR(64),
  "roomPassword" VARCHAR(64),
  "credentialsVisibleAt" TIMESTAMPTZ,
  "status" match_status NOT NULL DEFAULT 'scheduled',
  "entryFee" NUMERIC(10,2) NOT NULL CHECK ("entryFee" >= 0),
  "totalSlots" INTEGER NOT NULL CHECK ("totalSlots" > 0),
  "totalPrizePool" NUMERIC(12,2) NOT NULL CHECK ("totalPrizePool" >= 0),
  "perKillReward" NUMERIC(10,2) NOT NULL CHECK ("perKillReward" >= 0),
  "adminProfitDeducted" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("adminProfitDeducted" >= 0),
  "currentPlayers" INTEGER NOT NULL DEFAULT 0 CHECK ("currentPlayers" >= 0 AND "currentPlayers" <= "totalSlots"),
  "minPlayersRequired" INTEGER NOT NULL CHECK ("minPlayersRequired" > 0 AND "minPlayersRequired" <= "totalSlots"),
  "cancellationReason" TEXT,
  "cancelledAt" TIMESTAMPTZ,
  "refundProcessed" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ("scheduledEndTime" IS NULL OR "scheduledEndTime" > "scheduledStartTime"),
  CHECK ("credentialsVisibleAt" IS NULL OR "credentialsVisibleAt" <= "scheduledStartTime")
);

CREATE TABLE "deposits" (
  "id" BIGSERIAL PRIMARY KEY,
  "userId" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" NUMERIC(12,2) NOT NULL CHECK ("amount" > 0),
  "utrNumber" VARCHAR(12) NOT NULL CHECK ("utrNumber" ~ '^[0-9]{12}$'),
  "status" deposit_status NOT NULL DEFAULT 'pending',
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("utrNumber")
);

CREATE TABLE "withdrawals" (
  "id" BIGSERIAL PRIMARY KEY,
  "userId" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" NUMERIC(12,2) NOT NULL CHECK ("amount" >= 20),
  "payoutMethod" payout_method NOT NULL,
  "payoutDetails" VARCHAR(255) NOT NULL,
  "status" withdrawal_status NOT NULL DEFAULT 'pending',
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "referrals" (
  "id" BIGSERIAL PRIMARY KEY,
  "referrerId" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referredUserId" BIGINT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "referralCode" VARCHAR(32) NOT NULL,
  "bonusAwarded" BOOLEAN NOT NULL DEFAULT FALSE,
  "bonusAmount" NUMERIC(10,2) NOT NULL DEFAULT 5 CHECK ("bonusAmount" >= 0),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ("referrerId" <> "referredUserId")
);

CREATE TABLE "matchParticipants" (
  "id" BIGSERIAL PRIMARY KEY,
  "matchId" BIGINT NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
  "userId" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "freeFireIGN" VARCHAR(32),
  "freeFireUID" VARCHAR(32),
  "status" participant_status NOT NULL DEFAULT 'joined',
  "killCount" INTEGER CHECK ("killCount" IS NULL OR "killCount" >= 0),
  "rank" INTEGER CHECK ("rank" IS NULL OR "rank" > 0),
  "prizeAwarded" NUMERIC(12,2) CHECK ("prizeAwarded" IS NULL OR "prizeAwarded" >= 0),
  "entryFeeDeducted" NUMERIC(10,2) NOT NULL CHECK ("entryFeeDeducted" >= 0),
  "refundAmount" NUMERIC(10,2) CHECK ("refundAmount" IS NULL OR "refundAmount" >= 0),
  "refundedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("matchId", "userId"),
  CHECK (("refundedAt" IS NULL) = ("refundAmount" IS NULL))
);

CREATE TABLE "transactions" (
  "id" BIGSERIAL PRIMARY KEY,
  "userId" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" transaction_kind NOT NULL,
  "amount" NUMERIC(12,2) NOT NULL CHECK ("amount" <> 0),
  "balanceType" balance_kind NOT NULL,
  "matchId" BIGINT REFERENCES "matches"("id") ON DELETE SET NULL,
  "withdrawalId" BIGINT REFERENCES "withdrawals"("id") ON DELETE SET NULL,
  "referralId" BIGINT REFERENCES "referrals"("id") ON DELETE SET NULL,
  "utrNumber" VARCHAR(12) CHECK ("utrNumber" IS NULL OR "utrNumber" ~ '^[0-9]{12}$'),
  "status" transaction_status NOT NULL DEFAULT 'pending',
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "adminAuditLog" (
  "id" BIGSERIAL PRIMARY KEY,
  "action" VARCHAR(128) NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_users_email" ON "users" ("email");
CREATE INDEX "idx_wallets_user_id" ON "wallets" ("userId");
CREATE INDEX "idx_transactions_user_created" ON "transactions" ("userId", "createdAt" DESC);
CREATE INDEX "idx_transactions_match_id" ON "transactions" ("matchId");
CREATE INDEX "idx_matches_status_start" ON "matches" ("status", "scheduledStartTime");
CREATE INDEX "idx_matches_category_mode_start" ON "matches" ("categoryId", "modeId", "scheduledStartTime");
CREATE INDEX "idx_participants_match_id" ON "matchParticipants" ("matchId");
CREATE INDEX "idx_participants_user_id" ON "matchParticipants" ("userId");
CREATE INDEX "idx_deposits_status_created" ON "deposits" ("status", "createdAt");
CREATE INDEX "idx_withdrawals_status_created" ON "withdrawals" ("status", "createdAt");
CREATE INDEX "idx_referrals_referrer_id" ON "referrals" ("referrerId");

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_match_mode_category()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "matchModes"
    WHERE "id" = NEW."modeId" AND "categoryId" = NEW."categoryId"
  ) THEN
    RAISE EXCEPTION 'Mode % does not belong to category %', NEW."modeId", NEW."categoryId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER wallets_set_updated_at BEFORE UPDATE ON "wallets"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER transactions_set_updated_at BEFORE UPDATE ON "transactions"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER matches_set_updated_at BEFORE UPDATE ON "matches"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER match_participants_set_updated_at BEFORE UPDATE ON "matchParticipants"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER deposits_set_updated_at BEFORE UPDATE ON "deposits"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER withdrawals_set_updated_at BEFORE UPDATE ON "withdrawals"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER matches_validate_mode BEFORE INSERT OR UPDATE OF "categoryId", "modeId" ON "matches"
FOR EACH ROW EXECUTE FUNCTION validate_match_mode_category();

INSERT INTO "matchCategories" ("name", "description") VALUES
  ('BR', 'Battle Royale'),
  ('CS', 'Clash Squad'),
  ('Lone Wolf', 'Lone Wolf')
ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "matchModes" ("categoryId", "name", "teamSize", "maxPlayers", "entryFee")
SELECT "id", 'Solo', 1, 100, 100 FROM "matchCategories" WHERE "name" = 'BR'
UNION ALL SELECT "id", 'Duo', 2, 100, 150 FROM "matchCategories" WHERE "name" = 'BR'
UNION ALL SELECT "id", 'Squad', 4, 100, 200 FROM "matchCategories" WHERE "name" = 'BR'
UNION ALL SELECT "id", '1v1', 1, 2, 80 FROM "matchCategories" WHERE "name" = 'CS'
UNION ALL SELECT "id", '2v2', 2, 4, 120 FROM "matchCategories" WHERE "name" = 'CS'
UNION ALL SELECT "id", '4v4', 4, 8, 180 FROM "matchCategories" WHERE "name" = 'CS'
UNION ALL SELECT "id", '1v1', 1, 2, 50 FROM "matchCategories" WHERE "name" = 'Lone Wolf'
UNION ALL SELECT "id", '2v2', 2, 4, 75 FROM "matchCategories" WHERE "name" = 'Lone Wolf'
UNION ALL SELECT "id", '4v4', 4, 8, 100 FROM "matchCategories" WHERE "name" = 'Lone Wolf'
ON CONFLICT ("categoryId", "name") DO UPDATE SET
  "teamSize" = EXCLUDED."teamSize",
  "maxPlayers" = EXCLUDED."maxPlayers",
  "entryFee" = EXCLUDED."entryFee";

-- RLS context is intended for future direct-client access. The current application
-- uses only server-side tRPC calls, and PUBLIC receives no table privileges.
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS BIGINT STABLE LANGUAGE sql AS $$
  SELECT NULLIF(current_setting('app.user_id', TRUE), '')::BIGINT;
$$;

CREATE OR REPLACE FUNCTION app_is_admin()
RETURNS BOOLEAN STABLE LANGUAGE sql AS $$
  SELECT COALESCE(current_setting('app.role', TRUE), '') = 'admin';
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "matchCategories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "matchModes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "matchParticipants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deposits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "withdrawals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "adminAuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_self_or_admin ON "users" FOR SELECT
USING ("id" = app_current_user_id() OR app_is_admin());
CREATE POLICY users_update_self_or_admin ON "users" FOR UPDATE
USING ("id" = app_current_user_id() OR app_is_admin())
WITH CHECK ("id" = app_current_user_id() OR app_is_admin());
CREATE POLICY wallets_select_self_or_admin ON "wallets" FOR SELECT
USING ("userId" = app_current_user_id() OR app_is_admin());
CREATE POLICY transactions_select_self_or_admin ON "transactions" FOR SELECT
USING ("userId" = app_current_user_id() OR app_is_admin());
CREATE POLICY categories_public_read ON "matchCategories" FOR SELECT USING (TRUE);
CREATE POLICY modes_public_read ON "matchModes" FOR SELECT USING (TRUE);
CREATE POLICY matches_public_read ON "matches" FOR SELECT USING (TRUE);
CREATE POLICY participants_select_self_or_admin ON "matchParticipants" FOR SELECT
USING ("userId" = app_current_user_id() OR app_is_admin());
CREATE POLICY participants_insert_self ON "matchParticipants" FOR INSERT
WITH CHECK ("userId" = app_current_user_id());
CREATE POLICY deposits_select_self_or_admin ON "deposits" FOR SELECT
USING ("userId" = app_current_user_id() OR app_is_admin());
CREATE POLICY deposits_insert_self ON "deposits" FOR INSERT
WITH CHECK ("userId" = app_current_user_id());
CREATE POLICY withdrawals_select_self_or_admin ON "withdrawals" FOR SELECT
USING ("userId" = app_current_user_id() OR app_is_admin());
CREATE POLICY withdrawals_insert_self ON "withdrawals" FOR INSERT
WITH CHECK ("userId" = app_current_user_id());
CREATE POLICY referrals_select_related_or_admin ON "referrals" FOR SELECT
USING ("referrerId" = app_current_user_id() OR "referredUserId" = app_current_user_id() OR app_is_admin());
CREATE POLICY admin_audit_admin_read ON "adminAuditLog" FOR SELECT USING (app_is_admin());

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "freeFireName" varchar(64),
  ADD COLUMN IF NOT EXISTS "freeFireUid" varchar(32);

COMMIT;
