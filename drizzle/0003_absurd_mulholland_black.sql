CREATE TYPE "public"."payment_attempt_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "paymentAttempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"provider" varchar(32) DEFAULT 'razorpay' NOT NULL,
	"providerOrderId" varchar(128),
	"providerPaymentId" varchar(128),
	"providerEventId" varchar(128),
	"idempotencyKey" varchar(128) NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'created' NOT NULL,
	"failureReason" text,
	"capturedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paymentAttempts_providerOrderId_unique" UNIQUE("providerOrderId"),
	CONSTRAINT "paymentAttempts_providerPaymentId_unique" UNIQUE("providerPaymentId"),
	CONSTRAINT "paymentAttempts_providerEventId_unique" UNIQUE("providerEventId"),
	CONSTRAINT "paymentAttempts_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "paymentAttemptId" bigint;--> statement-breakpoint
ALTER TABLE "paymentAttempts" ADD CONSTRAINT "paymentAttempts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paymentAttemptId_paymentAttempts_id_fk" FOREIGN KEY ("paymentAttemptId") REFERENCES "public"."paymentAttempts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_payment_attempts_user_created" ON "paymentAttempts" USING btree ("userId","createdAt" DESC);--> statement-breakpoint
CREATE INDEX "idx_payment_attempts_provider_order" ON "paymentAttempts" USING btree ("provider","providerOrderId");--> statement-breakpoint
CREATE INDEX "idx_transactions_payment_attempt_id" ON "transactions" USING btree ("paymentAttemptId");--> statement-breakpoint
CREATE TRIGGER payment_attempts_set_updated_at BEFORE UPDATE ON "paymentAttempts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
ALTER TABLE "paymentAttempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY payment_attempts_select_self_or_admin ON "paymentAttempts" FOR SELECT USING ("userId" = app_current_user_id() OR app_is_admin());
