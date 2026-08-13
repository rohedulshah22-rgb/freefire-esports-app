-- Razorpay-ready payment persistence foundation. Run after neon_migration.sql.
BEGIN;

DO $$
BEGIN
  CREATE TYPE payment_attempt_status AS ENUM ('created', 'authorized', 'captured', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "paymentAttempts" (
  "id" BIGSERIAL PRIMARY KEY,
  "userId" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" NUMERIC(12,2) NOT NULL CHECK ("amount" > 0),
  "provider" VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  "providerOrderId" VARCHAR(128) UNIQUE,
  "providerPaymentId" VARCHAR(128) UNIQUE,
  "providerEventId" VARCHAR(128) UNIQUE,
  "idempotencyKey" VARCHAR(128) NOT NULL UNIQUE,
  "status" payment_attempt_status NOT NULL DEFAULT 'created',
  "failureReason" TEXT,
  "capturedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "paymentAttemptId" BIGINT REFERENCES "paymentAttempts"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_payment_attempts_user_created" ON "paymentAttempts" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_payment_attempts_provider_order" ON "paymentAttempts" ("provider", "providerOrderId");
CREATE INDEX IF NOT EXISTS "idx_transactions_payment_attempt_id" ON "transactions" ("paymentAttemptId");

DROP TRIGGER IF EXISTS payment_attempts_set_updated_at ON "paymentAttempts";
CREATE TRIGGER payment_attempts_set_updated_at BEFORE UPDATE ON "paymentAttempts"
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE "paymentAttempts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_attempts_select_self_or_admin ON "paymentAttempts";
CREATE POLICY payment_attempts_select_self_or_admin ON "paymentAttempts" FOR SELECT
USING ("userId" = app_current_user_id() OR app_is_admin());

COMMIT;
