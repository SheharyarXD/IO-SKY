CREATE TABLE `client_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`category` varchar(96) NOT NULL DEFAULT 'general',
	`fileKey` varchar(512) NOT NULL,
	`sizeBytes` int,
	`mimeType` varchar(96),
	`uploadedByUserId` int,
	`uploadedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`number` varchar(32) NOT NULL,
	`description` varchar(200) NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'EUR',
	`status` enum('draft','open','paid','overdue','void') NOT NULL DEFAULT 'open',
	`issuedMs` bigint NOT NULL,
	`dueMs` bigint,
	`paidMs` bigint,
	`pdfKey` varchar(512),
	CONSTRAINT `client_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_invoices_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `client_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`threadKey` varchar(64) NOT NULL,
	`sender` enum('io-sky','client') NOT NULL,
	`senderName` varchar(200),
	`subject` varchar(200),
	`body` text NOT NULL,
	`readAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`kind` varchar(32) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text,
	`href` varchar(512),
	`readAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_project_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`dueMs` bigint,
	`status` enum('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
	`body` text,
	CONSTRAINT `client_project_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`phase` varchar(96) NOT NULL DEFAULT 'Discovery',
	`progress` int NOT NULL DEFAULT 0,
	`startMs` bigint,
	`targetMs` bigint,
	`status` enum('planning','active','on_hold','completed') NOT NULL DEFAULT 'active',
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_recommendations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`reportId` int,
	`title` varchar(200) NOT NULL,
	`category` varchar(96) NOT NULL,
	`impact` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('pending','in_progress','completed','dismissed') NOT NULL DEFAULT 'pending',
	`body` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_recommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`publicRef` varchar(32) NOT NULL,
	`title` varchar(200) NOT NULL,
	`scanType` varchar(32) NOT NULL DEFAULT 'ai-scan',
	`score` int NOT NULL,
	`delta` int NOT NULL DEFAULT 0,
	`summary` text,
	`pdfKey` varchar(512),
	`status` enum('draft','ready','delivered') NOT NULL DEFAULT 'ready',
	`pages` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_reports_publicRef_unique` UNIQUE(`publicRef`)
);
--> statement-breakpoint
CREATE TABLE `client_support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`openedByUserId` int,
	`publicRef` varchar(32) NOT NULL,
	`subject` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'general',
	`status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_support_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_support_tickets_publicRef_unique` UNIQUE(`publicRef`)
);
--> statement-breakpoint
CREATE TABLE `organization_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`membershipRole` enum('owner','member') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organization_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(200) NOT NULL,
	`legalName` varchar(200),
	`industry` varchar(64),
	`size` varchar(64),
	`country` varchar(64),
	`operationalScore` int NOT NULL DEFAULT 72,
	`accentHex` varchar(16),
	`statusLabel` varchar(64) NOT NULL DEFAULT 'Healthy',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','client','developer','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `organizationId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `mfaMethod` varchar(32) DEFAULT 'none' NOT NULL;