CREATE TABLE `developer_access_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`developerId` int NOT NULL,
	`scopeId` int,
	`reason` text NOT NULL,
	`status` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
	`reviewerNote` text,
	`reviewedByUserId` int,
	`reviewedMs` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_access_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_access_scopes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`developerId` int NOT NULL,
	`level` enum('baseline','extended','elevated') NOT NULL DEFAULT 'baseline',
	`allowedActions` text,
	`allowedRoutes` text,
	`startMs` bigint NOT NULL,
	`expiresMs` bigint,
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `developer_access_scopes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_agreements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`developerId` int NOT NULL,
	`agreementType` varchar(64) NOT NULL,
	`version` varchar(32) NOT NULL,
	`status` enum('draft','pending','signed') NOT NULL DEFAULT 'pending',
	`signedMs` bigint,
	`signedIp` varchar(64),
	`signedUserAgent` text,
	`documentKey` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_agreements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`developerId` int,
	`event` varchar(96) NOT NULL,
	`detail` text,
	`ip` varchar(64),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`developerId` int NOT NULL,
	`sender` enum('admin','developer') NOT NULL,
	`senderName` varchar(200),
	`subject` varchar(200),
	`body` text NOT NULL,
	`readAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`developerId` int NOT NULL,
	`kind` varchar(32) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text,
	`href` varchar(512),
	`readAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`applicationId` int,
	`fullName` varchar(200) NOT NULL,
	`country` varchar(64),
	`linkedin` varchar(320),
	`github` varchar(320),
	`portfolio` varchar(320),
	`specialties` varchar(320),
	`yearsExperience` int,
	`availability` enum('available','limited','unavailable') NOT NULL DEFAULT 'available',
	`status` enum('active','suspended','terminated') NOT NULL DEFAULT 'active',
	`mfaRequired` int NOT NULL DEFAULT 1,
	`approvedMs` bigint,
	`approvedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `developer_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `developer_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `developer_project_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`developerId` int NOT NULL,
	`assignmentRole` enum('lead','contributor','reviewer') NOT NULL DEFAULT 'contributor',
	`status` enum('active','paused','ended') NOT NULL DEFAULT 'active',
	`progress` int NOT NULL DEFAULT 0,
	`startMs` bigint,
	`endMs` bigint,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `developer_project_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_project_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`sizeBytes` int,
	`mimeType` varchar(96),
	`category` varchar(64) NOT NULL DEFAULT 'specification',
	`uploadedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_project_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(200) NOT NULL,
	`brief` text,
	`track` varchar(64) NOT NULL DEFAULT 'full-stack',
	`status` enum('planning','active','on_hold','completed') NOT NULL DEFAULT 'active',
	`startMs` bigint,
	`targetMs` bigint,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `developer_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `developer_projects_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `developer_security_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`developerId` int,
	`kind` varchar(64) NOT NULL,
	`severity` enum('info','warn','high','critical') NOT NULL DEFAULT 'warn',
	`message` varchar(200) NOT NULL,
	`detail` text,
	`ip` varchar(64),
	`userAgent` text,
	`acknowledgedAt` bigint,
	`acknowledgedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`developerId` int NOT NULL,
	`kind` enum('submission','commit') NOT NULL DEFAULT 'submission',
	`title` varchar(200) NOT NULL,
	`body` text,
	`fileKey` varchar(512),
	`repository` varchar(320),
	`sha` varchar(64),
	`branch` varchar(200),
	`status` enum('pending','in_review','accepted','changes_requested','rejected') NOT NULL DEFAULT 'pending',
	`reviewerNote` text,
	`reviewedByUserId` int,
	`reviewedMs` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`developerId` int NOT NULL,
	`publicRef` varchar(32) NOT NULL,
	`subject` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'general',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_support_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `developer_support_tickets_publicRef_unique` UNIQUE(`publicRef`)
);
--> statement-breakpoint
CREATE TABLE `developer_task_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`developerId` int NOT NULL,
	`status` enum('active','released') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `developer_task_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `developer_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text,
	`status` enum('planned','in_progress','blocked','in_review','done') NOT NULL DEFAULT 'planned',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`dueMs` bigint,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `developer_tasks_id` PRIMARY KEY(`id`)
);
