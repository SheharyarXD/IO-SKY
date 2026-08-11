CREATE TABLE `mfa_challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`state` varchar(96) NOT NULL,
	`purpose` enum('login','enroll','step_up') NOT NULL DEFAULT 'login',
	`expectedKind` enum('totp','sms','any') NOT NULL DEFAULT 'any',
	`factorId` int,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`ip` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mfa_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `mfa_challenges_state_unique` UNIQUE(`state`)
);
--> statement-breakpoint
CREATE TABLE `mfa_factors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('totp','sms') NOT NULL,
	`label` varchar(120),
	`secret` text NOT NULL,
	`phoneHint` varchar(32),
	`verifiedAt` timestamp,
	`primary` int NOT NULL DEFAULT 0,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`lockedUntilMs` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` timestamp,
	CONSTRAINT `mfa_factors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mfa_recovery_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mfa_recovery_codes_id` PRIMARY KEY(`id`)
);
