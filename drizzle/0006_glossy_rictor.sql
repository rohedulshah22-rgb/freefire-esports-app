ALTER TABLE "users" ADD COLUMN "playerUid" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatarUrl" varchar(512);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_playerUid_unique" UNIQUE("playerUid");