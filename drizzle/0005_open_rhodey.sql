CREATE TABLE "referralSettings" (
	"id" integer PRIMARY KEY NOT NULL,
	"isEnabled" boolean DEFAULT true NOT NULL,
	"referrerBonusAmount" numeric(10, 2) DEFAULT '5' NOT NULL,
	"refereeBonusAmount" numeric(10, 2) DEFAULT '5' NOT NULL,
	"updatedBy" bigint,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN "status" varchar(16) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN "fraudReason" text;--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN "referrerBonusAmount" numeric(10, 2) DEFAULT '5' NOT NULL;--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN "refereeBonusAmount" numeric(10, 2) DEFAULT '5' NOT NULL;--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN "qualifiedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "referrals" ADD COLUMN "rewardedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referralDeviceHash" varchar(128);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referralIpHash" varchar(128);--> statement-breakpoint
ALTER TABLE "referralSettings" ADD CONSTRAINT "referralSettings_updatedBy_users_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;