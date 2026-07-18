CREATE TABLE `agreement_acceptances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`organizationId` int,
	`versionId` int NOT NULL,
	`documentKind` varchar(64) NOT NULL,
	`acceptedAt` timestamp NOT NULL DEFAULT (now()),
	`ip` varchar(64),
	`userAgent` text,
	`method` varchar(64) NOT NULL,
	CONSTRAINT `agreement_acceptances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agreement_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`version` varchar(32) NOT NULL,
	`language` varchar(8) NOT NULL DEFAULT 'en',
	`bodyMd` text NOT NULL,
	`bodyHash` varchar(128) NOT NULL,
	`effectiveFrom` timestamp NOT NULL DEFAULT (now()),
	`status` enum('draft','published','superseded') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	CONSTRAINT `agreement_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cookie_consents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectKey` varchar(96) NOT NULL,
	`userId` int,
	`policyVersionId` int,
	`categoriesJson` text NOT NULL,
	`decision` varchar(32) NOT NULL,
	`acceptedAt` timestamp NOT NULL DEFAULT (now()),
	`ip` varchar(64),
	`userAgent` text,
	CONSTRAINT `cookie_consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `legal_acknowledgements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`documentKind` varchar(64) NOT NULL,
	`versionId` int,
	`context` varchar(96) NOT NULL,
	`acknowledgedAt` timestamp NOT NULL DEFAULT (now()),
	`ip` varchar(64),
	CONSTRAINT `legal_acknowledgements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `legal_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` varchar(64) NOT NULL,
	`slug` varchar(96) NOT NULL,
	`title` varchar(200) NOT NULL,
	`jurisdiction` varchar(32),
	`defaultLanguage` varchar(8) NOT NULL DEFAULT 'en',
	`status` enum('active','draft','retired') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `legal_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `legal_documents_kind_unique` UNIQUE(`kind`),
	CONSTRAINT `legal_documents_slug_unique` UNIQUE(`slug`)
);
