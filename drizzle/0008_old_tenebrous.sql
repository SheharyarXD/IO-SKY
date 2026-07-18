CREATE TABLE `custom_discovery_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`fullName` varchar(200),
	`email` varchar(320),
	`company` varchar(200),
	`phone` varchar(64),
	`needsTypes` text,
	`currentSystems` text,
	`teamSize` varchar(32),
	`growthStage` varchar(32),
	`complianceTags` text,
	`integrations` text,
	`timeline` varchar(32),
	`urgency` varchar(32),
	`preferredNext` enum('ai-scan','strategy-call','proposal'),
	`status` enum('in_progress','submitted','abandoned') NOT NULL DEFAULT 'in_progress',
	`leadId` int,
	`ip` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`submittedAt` timestamp,
	CONSTRAINT `custom_discovery_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `custom_discovery_sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `ecosystem_click_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventKey` varchar(80) NOT NULL,
	`source` varchar(64) NOT NULL DEFAULT 'solutions',
	`ecosystem` varchar(32),
	`sessionToken` varchar(64),
	`userId` int,
	`ip` varchar(64),
	`userAgent` text,
	`payload` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ecosystem_click_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ecosystem_proposal_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ecosystem` enum('growth','elite','custom') NOT NULL,
	`fullName` varchar(200) NOT NULL,
	`email` varchar(320) NOT NULL,
	`company` varchar(200),
	`phone` varchar(64),
	`message` text,
	`goals` text,
	`source` varchar(64) NOT NULL DEFAULT 'solutions',
	`status` enum('new','qualified','in_review','sent','won','lost') NOT NULL DEFAULT 'new',
	`leadId` int,
	`ip` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ecosystem_proposal_requests_id` PRIMARY KEY(`id`)
);
