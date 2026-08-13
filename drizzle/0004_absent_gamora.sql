CREATE TABLE "leaderboardSettings" (
	"id" integer PRIMARY KEY NOT NULL,
	"weeklyCycleStartedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"top1Reward" numeric(12, 2) DEFAULT '0' NOT NULL,
	"top2Reward" numeric(12, 2) DEFAULT '0' NOT NULL,
	"top3Reward" numeric(12, 2) DEFAULT '0' NOT NULL,
	"proLegendLabel" varchar(64) DEFAULT 'Pro Legend' NOT NULL,
	"updatedBy" bigint,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leaderboardSettings" ADD CONSTRAINT "leaderboardSettings_updatedBy_users_id_fk" FOREIGN KEY ("updatedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;