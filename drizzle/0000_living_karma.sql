-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."app_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."balance_kind" AS ENUM('deposit', 'winning', 'bonus');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'active', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('joined', 'confirmed', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."payout_method" AS ENUM('upi', 'google_play');--> statement-breakpoint
CREATE TYPE "public"."transaction_kind" AS ENUM('deposit', 'withdrawal', 'match_entry', 'kill_reward', 'prize_win', 'refund', 'referral_bonus', 'admin_adjustment');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('pending', 'approved', 'rejected', 'completed');--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "app_role" DEFAULT 'user' NOT NULL,
	"deviceId" varchar(128),
	"isAndroidMobile" boolean DEFAULT true NOT NULL,
	"isBanned" boolean DEFAULT false NOT NULL,
	"banReason" text,
	"referralCode" varchar(32),
	"referredBy" bigint,
	"referralBonusAwarded" boolean DEFAULT false NOT NULL,
	"adminUsername" varchar(64),
	"adminPasswordHash" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_key" UNIQUE("openId"),
	CONSTRAINT "users_deviceId_key" UNIQUE("deviceId"),
	CONSTRAINT "users_referralCode_key" UNIQUE("referralCode"),
	CONSTRAINT "users_adminUsername_key" UNIQUE("adminUsername"),
	CONSTRAINT "users_id_not_null" CHECK (NOT NULL id),
	CONSTRAINT "users_openId_not_null" CHECK (NOT NULL "openId"),
	CONSTRAINT "users_role_not_null" CHECK (NOT NULL role),
	CONSTRAINT "users_isAndroidMobile_not_null" CHECK (NOT NULL "isAndroidMobile"),
	CONSTRAINT "users_isBanned_not_null" CHECK (NOT NULL "isBanned"),
	CONSTRAINT "users_referralBonusAwarded_not_null" CHECK (NOT NULL "referralBonusAwarded"),
	CONSTRAINT "users_createdAt_not_null" CHECK (NOT NULL "createdAt"),
	CONSTRAINT "users_updatedAt_not_null" CHECK (NOT NULL "updatedAt"),
	CONSTRAINT "users_lastSignedIn_not_null" CHECK (NOT NULL "lastSignedIn")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"depositBalance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"winningBalance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"bonusBalance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_userId_key" UNIQUE("userId"),
	CONSTRAINT "wallets_depositBalance_check" CHECK ("depositBalance" >= (0)::numeric),
	CONSTRAINT "wallets_winningBalance_check" CHECK ("winningBalance" >= (0)::numeric),
	CONSTRAINT "wallets_bonusBalance_check" CHECK ("bonusBalance" >= (0)::numeric),
	CONSTRAINT "wallets_id_not_null" CHECK (NOT NULL id),
	CONSTRAINT "wallets_userId_not_null" CHECK (NOT NULL "userId"),
	CONSTRAINT "wallets_depositBalance_not_null" CHECK (NOT NULL "depositBalance"),
	CONSTRAINT "wallets_winningBalance_not_null" CHECK (NOT NULL "winningBalance"),
	CONSTRAINT "wallets_bonusBalance_not_null" CHECK (NOT NULL "bonusBalance"),
	CONSTRAINT "wallets_createdAt_not_null" CHECK (NOT NULL "createdAt"),
	CONSTRAINT "wallets_updatedAt_not_null" CHECK (NOT NULL "updatedAt")
);
--> statement-breakpoint
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"type" "transaction_kind" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"balanceType" "balance_kind" NOT NULL,
	"matchId" bigint,
	"withdrawalId" bigint,
	"referralId" bigint,
	"utrNumber" varchar(12),
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_amount_check" CHECK (amount <> (0)::numeric),
	CONSTRAINT "transactions_utrNumber_check" CHECK (("utrNumber" IS NULL) OR (("utrNumber")::text ~ '^[0-9]{12}$'::text)),
	CONSTRAINT "transactions_id_not_null" CHECK (NOT NULL id),
	CONSTRAINT "transactions_userId_not_null" CHECK (NOT NULL "userId"),
	CONSTRAINT "transactions_type_not_null" CHECK (NOT NULL type),
	CONSTRAINT "transactions_amount_not_null" CHECK (NOT NULL amount),
	CONSTRAINT "transactions_balanceType_not_null" CHECK (NOT NULL "balanceType"),
	CONSTRAINT "transactions_status_not_null" CHECK (NOT NULL status),
	CONSTRAINT "transactions_createdAt_not_null" CHECK (NOT NULL "createdAt"),
	CONSTRAINT "transactions_updatedAt_not_null" CHECK (NOT NULL "updatedAt")
);
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matchCategories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matchCategories_name_key" UNIQUE("name"),
	CONSTRAINT "matchCategories_id_not_null" CHECK (NOT NULL id),
	CONSTRAINT "matchCategories_name_not_null" CHECK (NOT NULL name),
	CONSTRAINT "matchCategories_createdAt_not_null" CHECK (NOT NULL "createdAt")
);
--> statement-breakpoint
ALTER TABLE "matchCategories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matchModes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"categoryId" bigint NOT NULL,
	"name" varchar(64) NOT NULL,
	"teamSize" integer NOT NULL,
	"maxPlayers" integer NOT NULL,
	"entryFee" numeric(10, 2) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matchModes_categoryId_name_key" UNIQUE("name","categoryId"),
	CONSTRAINT "matchModes_teamSize_check" CHECK ("teamSize" > 0),
	CONSTRAINT "matchModes_maxPlayers_check" CHECK ("maxPlayers" > 0),
	CONSTRAINT "matchModes_entryFee_check" CHECK ("entryFee" >= (0)::numeric),
	CONSTRAINT "matchModes_id_not_null" CHECK (NOT NULL id),
	CONSTRAINT "matchModes_categoryId_not_null" CHECK (NOT NULL "categoryId"),
	CONSTRAINT "matchModes_name_not_null" CHECK (NOT NULL name),
	CONSTRAINT "matchModes_teamSize_not_null" CHECK (NOT NULL "teamSize"),
	CONSTRAINT "matchModes_maxPlayers_not_null" CHECK (NOT NULL "maxPlayers"),
	CONSTRAINT "matchModes_entryFee_not_null" CHECK (NOT NULL "entryFee"),
	CONSTRAINT "matchModes_createdAt_not_null" CHECK (NOT NULL "createdAt")
);
--> statement-breakpoint
ALTER TABLE "matchModes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"categoryId" bigint NOT NULL,
	"modeId" bigint NOT NULL,
	"matchTitle" varchar(128) NOT NULL,
	"mapName" varchar(128) NOT NULL,
	"scheduledStartTime" timestamp with time zone NOT NULL,
	"scheduledEndTime" timestamp with time zone,
	"roomId" varchar(64),
	"roomPassword" varchar(64),
	"credentialsVisibleAt" timestamp with time zone,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"entryFee" numeric(10, 2) NOT NULL,
	"totalSlots" integer NOT NULL,
	"totalPrizePool" numeric(12, 2) NOT NULL,
	"perKillReward" numeric(10, 2) NOT NULL,
	"adminProfitDeducted" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currentPlayers" integer DEFAULT 0 NOT NULL,
	"minPlayersRequired" integer NOT NULL,
	"cancellationReason" text,
	"cancelledAt" timestamp with time zone,
	"refundProcessed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_entryFee_check" CHECK ("entryFee" >= (0)::numeric),
	CONSTRAINT "matches_totalSlots_check" CHECK ("totalSlots" > 0),
	CONSTRAINT "matches_totalPrizePool_check" CHECK ("totalPrizePool" >= (0)::numeric),
	CONSTRAINT "matches_createdAt_not_null" CHECK (NOT NULL "createdAt"),
	CONSTRAINT "matches_updatedAt_not_null" CHECK (NOT NULL "updatedAt"),
	CONSTRAINT "matches_perKillReward_check" CHECK ("perKillReward" >= (0)::numeric),
	CONSTRAINT "matches_adminProfitDeducted_check" CHECK ("adminProfitDeducted" >= (0)::numeric),
	CONSTRAINT "matches_check" CHECK (("currentPlayers" >= 0) AND ("currentPlayers" <= "totalSlots")),
	CONSTRAINT "matches_check1" CHECK (("minPlayersRequired" > 0) AND ("minPlayersRequired" <= "totalSlots")),
	CONSTRAINT "matches_check2" CHECK (("scheduledEndTime" IS NULL) OR ("scheduledEndTime" > "scheduledStartTime")),
	CONSTRAINT "matches_check3" CHECK (("credentialsVisibleAt" IS NULL) OR ("credentialsVisibleAt" <= "scheduledStartTime")),
	CONSTRAINT "matches_id_not_null" CHECK (NOT NULL id),
	CONSTRAINT "matches_categoryId_not_null" CHECK (NOT NULL "categoryId"),
	CONSTRAINT "matches_modeId_not_null" CHECK (NOT NULL "modeId"),
	CONSTRAINT "matches_matchTitle_not_null" CHECK (NOT NULL "matchTitle"),
	CONSTRAINT "matches_mapName_not_null" CHECK (NOT NULL "mapName"),
	CONSTRAINT "matches_scheduledStartTime_not_null" CHECK (NOT NULL "scheduledStartTime"),
	CONSTRAINT "matches_status_not_null" CHECK (NOT NULL status),
	CONSTRAINT "matches_entryFee_not_null" CHECK (NOT NULL "entryFee"),
	CONSTRAINT "matches_totalSlots_not_null" CHECK (NOT NULL "totalSlots"),
	CONSTRAINT "matches_totalPrizePool_not_null" CHECK (NOT NULL "totalPrizePool"),
	CONSTRAINT "matches_perKillReward_not_null" CHECK (NOT NULL "perKillReward"),
	CONSTRAINT "matches_adminProfitDeducted_not_null" CHECK (NOT NULL "adminProfitDeducted"),
	CONSTRAINT "matches_currentPlayers_not_null" CHECK (NOT NULL "currentPlayers"),
	CONSTRAINT "matches_minPlayersRequired_not_null" CHECK (NOT NULL "minPlayersRequired"),
	CONSTRAINT "matches_refundProcessed_not_null" CHECK (NOT NULL "refundProcessed")
);
--> statement-breakpoint
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "matchParticipants" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"matchId" bigint NOT NULL,
	"userId" bigint NOT NULL,
	"freeFireIGN" varchar(32),
	"freeFireUID" varchar(32),
	"status" "participant_status" DEFAULT 'joined' NOT NULL,
	"killCount" integer,
	"rank" integer,
	"prizeAwarded" numeric(12, 2),
	"entryFeeDeducted" numeric(10, 2) NOT NULL,
	"refundAmount" numeric(10, 2),
	"refundedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matchParticipants_matchId_userId_key" UNIQUE("userId","matchId"),
	CONSTRAINT "matchParticipants_killCount_check" CHECK (("killCount" IS NULL) OR ("killCount" >= 0)),
	CONSTRAINT "matchParticipants_rank_check" CHECK ((rank IS NULL) OR (rank > 0)),
	CONSTRAINT "matchParticipants_prizeAwarded_check" CHECK (("prizeAwarded" IS NULL) OR ("prizeAwarded" >= (0)::numeric)),
	CONSTRAINT "matchParticipants_entryFeeDeducted_check" CHECK ("entryFeeDeducted" >= (0)::numeric),
	CONSTRAINT "matchParticipants_refundAmount_check" CHECK (("refundAmount" IS NULL) OR ("refundAmount" >= (0)::numeric)),
	CONSTRAINT "matchParticipants_check" CHECK (("refundedAt" IS NULL) = ("refundAmount" IS NULL)),
	CONSTRAINT "matchParticipants_id_not_null" CHECK (NOT NULL id),
	CONSTRAINT "matchParticipants_matchId_not_null" CHECK (NOT NULL "matchId"),
	CONSTRAINT "matchParticipants_userId_not_null" CHECK (NOT NULL "userId"),
	CONSTRAINT "matchParticipants_status_not_null" CHECK (NOT NULL status),
	CONSTRAINT "matchParticipants_entryFeeDeducted_not_null" CHECK (NOT NULL "entryFeeDeducted"),
	CONSTRAINT "matchParticipants_createdAt_not_null" CHECK (NOT NULL "createdAt"),
	CONSTRAINT "matchParticipants_updatedAt_not_null" CHECK (NOT NULL "updatedAt")
);
--> statement-breakpoint
ALTER TABLE "matchParticipants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"utrNumber" varchar(12) NOT NULL,
	"status" "deposit_status" DEFAULT 'pending' NOT NULL,
	"rejectionReason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposits_utrNumber_key" UNIQUE("utrNumber"),
	CONSTRAINT "deposits_amount_check" CHECK (amount > (0)::numeric),
	CONSTRAINT "deposits_utrNumber_check" CHECK (("utrNumber")::text ~ '^[0-9]{12}$'::text),
	CONSTRAINT "deposits_id_not_null" CHECK (NOT NULL id),
	CONSTRAINT "deposits_userId_not_null" CHECK (NOT NULL "userId"),
	CONSTRAINT "deposits_amount_not_null" CHECK (NOT NULL amount),
	CONSTRAINT "deposits_utrNumber_not_null" CHECK (NOT NULL "utrNumber"),
	CONSTRAINT "deposits_status_not_null" CHECK (NOT NULL status),
	CONSTRAINT "deposits_createdAt_not_null" CHECK (NOT NULL "createdAt"),
	CONSTRAINT "deposits_updatedAt_not_null" CHECK (NOT NULL "updatedAt")
);
--> statement-breakpoint
ALTER TABLE "deposits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payoutMethod" "payout_method" NOT NULL,
	"payoutDetails" varchar(255) NOT NULL,
	"status" "withdrawal_status" DEFAULT 'pending' NOT NULL,
	"rejectionReason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "withdrawals_amount_check" CHECK (amount >= (20)::numeric),
	CONSTRAINT "withdrawals_id_not_null" CHECK (NOT NULL id),
	CONSTRAINT "withdrawals_userId_not_null" CHECK (NOT NULL "userId"),
	CONSTRAINT "withdrawals_amount_not_null" CHECK (NOT NULL amount),
	CONSTRAINT "withdrawals_payoutMethod_not_null" CHECK (NOT NULL "payoutMethod"),
	CONSTRAINT "withdrawals_payoutDetails_not_null" CHECK (NOT NULL "payoutDetails"),
	CONSTRAINT "withdrawals_status_not_null" CHECK (NOT NULL status),
	CONSTRAINT "withdrawals_createdAt_not_null" CHECK (NOT NULL "createdAt"),
	CONSTRAINT "withdrawals_updatedAt_not_null" CHECK (NOT NULL "updatedAt")
);
--> statement-breakpoint
ALTER TABLE "withdrawals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"referrerId" bigint NOT NULL,
	"referredUserId" bigint NOT NULL,
	"referralCode" varchar(32) NOT NULL,
	"bonusAwarded" boolean DEFAULT false NOT NULL,
	"bonusAmount" numeric(10, 2) DEFAULT '5' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_referredUserId_key" UNIQUE("referredUserId"),
	CONSTRAINT "referrals_bonusAmount_check" CHECK ("bonusAmount" >= (0)::numeric),
	CONSTRAINT "referrals_check" CHECK ("referrerId" <> "referredUserId"),
	CONSTRAINT "referrals_id_not_null" CHECK (NOT NULL id),
	CONSTRAINT "referrals_referrerId_not_null" CHECK (NOT NULL "referrerId"),
	CONSTRAINT "referrals_referredUserId_not_null" CHECK (NOT NULL "referredUserId"),
	CONSTRAINT "referrals_referralCode_not_null" CHECK (NOT NULL "referralCode"),
	CONSTRAINT "referrals_bonusAwarded_not_null" CHECK (NOT NULL "bonusAwarded"),
	CONSTRAINT "referrals_bonusAmount_not_null" CHECK (NOT NULL "bonusAmount"),
	CONSTRAINT "referrals_createdAt_not_null" CHECK (NOT NULL "createdAt")
);
--> statement-breakpoint
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "adminAuditLog" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"action" varchar(128) NOT NULL,
	"details" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "adminAuditLog_id_not_null" CHECK (NOT NULL id),
	CONSTRAINT "adminAuditLog_action_not_null" CHECK (NOT NULL action),
	CONSTRAINT "adminAuditLog_createdAt_not_null" CHECK (NOT NULL "createdAt")
);
--> statement-breakpoint
ALTER TABLE "adminAuditLog" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "public"."withdrawals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "public"."referrals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchModes" ADD CONSTRAINT "matchModes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."matchCategories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."matchCategories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_modeId_fkey" FOREIGN KEY ("modeId") REFERENCES "public"."matchModes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchParticipants" ADD CONSTRAINT "matchParticipants_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchParticipants" ADD CONSTRAINT "matchParticipants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_wallets_user_id" ON "wallets" USING btree ("userId" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_transactions_match_id" ON "transactions" USING btree ("matchId" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_transactions_user_created" ON "transactions" USING btree ("userId" int8_ops,"createdAt" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_matches_category_mode_start" ON "matches" USING btree ("categoryId" int8_ops,"modeId" timestamptz_ops,"scheduledStartTime" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_matches_status_start" ON "matches" USING btree ("status" enum_ops,"scheduledStartTime" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_participants_match_id" ON "matchParticipants" USING btree ("matchId" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_participants_user_id" ON "matchParticipants" USING btree ("userId" int8_ops);--> statement-breakpoint
CREATE INDEX "idx_deposits_status_created" ON "deposits" USING btree ("status" timestamptz_ops,"createdAt" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_withdrawals_status_created" ON "withdrawals" USING btree ("status" timestamptz_ops,"createdAt" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_referrals_referrer_id" ON "referrals" USING btree ("referrerId" int8_ops);--> statement-breakpoint
CREATE POLICY "users_update_self_or_admin" ON "users" AS PERMISSIVE FOR UPDATE TO public USING (((id = app_current_user_id()) OR app_is_admin())) WITH CHECK (((id = app_current_user_id()) OR app_is_admin()));--> statement-breakpoint
CREATE POLICY "users_select_self_or_admin" ON "users" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "wallets_select_self_or_admin" ON "wallets" AS PERMISSIVE FOR SELECT TO public USING ((("userId" = app_current_user_id()) OR app_is_admin()));--> statement-breakpoint
CREATE POLICY "transactions_select_self_or_admin" ON "transactions" AS PERMISSIVE FOR SELECT TO public USING ((("userId" = app_current_user_id()) OR app_is_admin()));--> statement-breakpoint
CREATE POLICY "categories_public_read" ON "matchCategories" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "modes_public_read" ON "matchModes" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "matches_public_read" ON "matches" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "participants_insert_self" ON "matchParticipants" AS PERMISSIVE FOR INSERT TO public WITH CHECK (("userId" = app_current_user_id()));--> statement-breakpoint
CREATE POLICY "participants_select_self_or_admin" ON "matchParticipants" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "deposits_insert_self" ON "deposits" AS PERMISSIVE FOR INSERT TO public WITH CHECK (("userId" = app_current_user_id()));--> statement-breakpoint
CREATE POLICY "deposits_select_self_or_admin" ON "deposits" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "withdrawals_insert_self" ON "withdrawals" AS PERMISSIVE FOR INSERT TO public WITH CHECK (("userId" = app_current_user_id()));--> statement-breakpoint
CREATE POLICY "withdrawals_select_self_or_admin" ON "withdrawals" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "referrals_select_related_or_admin" ON "referrals" AS PERMISSIVE FOR SELECT TO public USING ((("referrerId" = app_current_user_id()) OR ("referredUserId" = app_current_user_id()) OR app_is_admin()));--> statement-breakpoint
CREATE POLICY "admin_audit_admin_read" ON "adminAuditLog" AS PERMISSIVE FOR SELECT TO public USING (app_is_admin());
*/