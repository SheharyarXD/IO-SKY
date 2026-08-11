CREATE TABLE `contact_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicRef` varchar(32) NOT NULL,
	`fullName` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(64),
	`company` varchar(200),
	`industry` varchar(64),
	`size` varchar(64),
	`subject` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`status` enum('new','responded','closed','spam') NOT NULL DEFAULT 'new',
	`emailSent` int NOT NULL DEFAULT 0,
	`ownerNotified` int NOT NULL DEFAULT 0,
	`ip` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `contact_submissions_publicRef_unique` UNIQUE(`publicRef`)
);
--> statement-breakpoint
CREATE TABLE `dev_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicRef` varchar(32) NOT NULL,
	`fullName` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(64),
	`company` varchar(200),
	`roleTitle` varchar(120),
	`yearsExperience` int,
	`links` text,
	`message` text,
	`ackNda` int NOT NULL DEFAULT 0,
	`ackConfidentiality` int NOT NULL DEFAULT 0,
	`ackNonSolicitation` int NOT NULL DEFAULT 0,
	`status` enum('pending','in_review','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewerNote` text,
	`ownerNotified` int NOT NULL DEFAULT 0,
	`ip` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dev_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `dev_applications_publicRef_unique` UNIQUE(`publicRef`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(32) NOT NULL,
	`sourceId` int,
	`fullName` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`company` varchar(200),
	`phone` varchar(64),
	`interest` varchar(64),
	`note` text,
	`status` enum('new','qualified','engaged','won','lost') NOT NULL DEFAULT 'new',
	`utmSource` varchar(120),
	`utmCampaign` varchar(120),
	`ip` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `login_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`identifier` varchar(320),
	`provider` varchar(32) NOT NULL,
	`outcome` varchar(32) NOT NULL,
	`reason` varchar(200),
	`ip` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `login_audit_id` PRIMARY KEY(`id`)
);
