CREATE TABLE `booking_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`event` varchar(64) NOT NULL,
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicRef` varchar(32) NOT NULL,
	`serviceId` varchar(32) NOT NULL,
	`slotStartMs` bigint NOT NULL,
	`durationMin` int NOT NULL,
	`timezone` varchar(64) NOT NULL,
	`fullName` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`company` varchar(200),
	`roleTitle` varchar(120),
	`phone` varchar(64),
	`preparation` text,
	`note` text,
	`utmSource` varchar(120),
	`utmCampaign` varchar(120),
	`status` enum('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'confirmed',
	`emailSent` int NOT NULL DEFAULT 0,
	`ownerNotified` int NOT NULL DEFAULT 0,
	`ip` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bookings_publicRef_unique` UNIQUE(`publicRef`)
);
