CREATE TABLE `adminAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`action` varchar(128) NOT NULL,
	`entityType` varchar(64),
	`entityId` int,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `adminAuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bannedAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reason` enum('hack_detected','emulator_detected','ios_detected','desktop_detected','tablet_detected','double_account','fraud','manual_ban') NOT NULL,
	`bannedBy` int,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bannedAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `bannedAccounts_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `deposits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`utrNumber` varchar(12) NOT NULL,
	`status` enum('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deposits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matchCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `matchCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `matchCategories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `matchModes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`teamSize` int NOT NULL,
	`maxPlayers` int NOT NULL,
	`entryFee` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `matchModes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matchParticipants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('joined','confirmed','cancelled','completed') NOT NULL DEFAULT 'joined',
	`killCount` int,
	`rank` int,
	`prizeAwarded` decimal(12,2),
	`entryFeeDeducted` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `matchParticipants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modeId` int NOT NULL,
	`scheduledStartTime` datetime NOT NULL,
	`scheduledEndTime` datetime,
	`roomId` varchar(64),
	`roomPassword` varchar(64),
	`credentialsVisibleAt` datetime,
	`status` enum('scheduled','active','completed','cancelled') NOT NULL DEFAULT 'scheduled',
	`entryFee` decimal(10,2) NOT NULL,
	`totalPrizePool` decimal(12,2) DEFAULT '0',
	`adminProfitDeducted` decimal(12,2) DEFAULT '0',
	`currentPlayers` int NOT NULL DEFAULT 0,
	`minPlayersRequired` int NOT NULL,
	`cancellationReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerId` int NOT NULL,
	`referredUserId` int NOT NULL,
	`referralCode` varchar(32) NOT NULL,
	`referrerBonusAwarded` boolean NOT NULL DEFAULT false,
	`referredUserBonusAwarded` boolean NOT NULL DEFAULT false,
	`firstDepositCompletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','withdrawal','match_entry','kill_reward','prize_win','refund','referral_bonus') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`balanceType` enum('deposit','winning','bonus') NOT NULL,
	`matchId` int,
	`withdrawalId` int,
	`referralId` int,
	`utrNumber` varchar(12),
	`status` enum('pending','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`depositBalance` decimal(12,2) NOT NULL DEFAULT '0',
	`winningBalance` decimal(12,2) NOT NULL DEFAULT '0',
	`bonusBalance` decimal(12,2) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallets_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `withdrawals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`payoutMethod` enum('upi','google_play') NOT NULL,
	`payoutDetails` varchar(255) NOT NULL,
	`status` enum('pending','approved','rejected','completed','failed') NOT NULL DEFAULT 'pending',
	`rejectionReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `withdrawals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `deviceId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `isAndroidMobile` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isBanned` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `banReason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `referralCode` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `referredBy` int;--> statement-breakpoint
ALTER TABLE `users` ADD `referralBonusAwarded` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `adminUsername` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `adminPasswordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_deviceId_unique` UNIQUE(`deviceId`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_referralCode_unique` UNIQUE(`referralCode`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_adminUsername_unique` UNIQUE(`adminUsername`);