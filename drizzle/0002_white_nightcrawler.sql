DROP TABLE `bannedAccounts`;--> statement-breakpoint
ALTER TABLE `deposits` MODIFY COLUMN `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `matches` MODIFY COLUMN `totalPrizePool` decimal(12,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `withdrawals` MODIFY COLUMN `status` enum('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `matchParticipants` ADD `refundAmount` decimal(10,2);--> statement-breakpoint
ALTER TABLE `matchParticipants` ADD `refundedAt` datetime;--> statement-breakpoint
ALTER TABLE `matches` ADD `categoryId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `matchTitle` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `mapName` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `totalSlots` int NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `perKillReward` decimal(10,2) NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `cancelledAt` datetime;--> statement-breakpoint
ALTER TABLE `matches` ADD `refundProcessed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `referrals` ADD `bonusAwarded` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `referrals` ADD `bonusAmount` decimal(10,2) DEFAULT '5' NOT NULL;--> statement-breakpoint
ALTER TABLE `adminAuditLog` DROP COLUMN `adminId`;--> statement-breakpoint
ALTER TABLE `adminAuditLog` DROP COLUMN `entityType`;--> statement-breakpoint
ALTER TABLE `adminAuditLog` DROP COLUMN `entityId`;--> statement-breakpoint
ALTER TABLE `referrals` DROP COLUMN `referrerBonusAwarded`;--> statement-breakpoint
ALTER TABLE `referrals` DROP COLUMN `referredUserBonusAwarded`;--> statement-breakpoint
ALTER TABLE `referrals` DROP COLUMN `firstDepositCompletedAt`;