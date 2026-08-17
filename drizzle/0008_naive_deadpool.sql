CREATE TYPE "public"."proof_review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."transaction_kind" ADD VALUE 'daily_checkin' BEFORE 'admin_adjustment';--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"message" varchar(240) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"startsAt" timestamp with time zone,
	"endsAt" timestamp with time zone,
	"createdBy" bigint,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dailyCheckIns" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"userId" bigint NOT NULL,
	"claimDate" varchar(10) NOT NULL,
	"rewardAmount" numeric(10, 2) NOT NULL,
	"claimedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dailyCheckIns_user_date_unique" UNIQUE("userId","claimDate")
);
--> statement-breakpoint
CREATE TABLE "matchResultProofs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"matchId" bigint NOT NULL,
	"participantId" bigint NOT NULL,
	"userId" bigint NOT NULL,
	"imageUrl" varchar(512) NOT NULL,
	"playerNote" varchar(500),
	"status" "proof_review_status" DEFAULT 'pending' NOT NULL,
	"reviewedBy" bigint,
	"reviewNote" varchar(500),
	"submittedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewedAt" timestamp with time zone,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matchResultProofs_participantId_unique" UNIQUE("participantId")
);
--> statement-breakpoint
CREATE TABLE "matchTeamMembers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"participantId" bigint NOT NULL,
	"memberName" varchar(32) NOT NULL,
	"memberUid" varchar(32) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matchTeamMembers_participant_member_unique" UNIQUE("participantId","memberUid")
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdBy_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dailyCheckIns" ADD CONSTRAINT "dailyCheckIns_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchResultProofs" ADD CONSTRAINT "matchResultProofs_matchId_matches_id_fk" FOREIGN KEY ("matchId") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchResultProofs" ADD CONSTRAINT "matchResultProofs_participantId_matchParticipants_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."matchParticipants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchResultProofs" ADD CONSTRAINT "matchResultProofs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchResultProofs" ADD CONSTRAINT "matchResultProofs_reviewedBy_users_id_fk" FOREIGN KEY ("reviewedBy") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchTeamMembers" ADD CONSTRAINT "matchTeamMembers_participantId_matchParticipants_id_fk" FOREIGN KEY ("participantId") REFERENCES "public"."matchParticipants"("id") ON DELETE cascade ON UPDATE no action;