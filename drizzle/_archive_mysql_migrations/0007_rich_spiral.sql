CREATE TABLE `admin_availability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultationType` varchar(32) NOT NULL,
	`weekday` int NOT NULL,
	`startMinute` int NOT NULL,
	`endMinute` int NOT NULL,
	`timezone` varchar(64) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_availability_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `availability_windows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultationType` varchar(32),
	`kind` enum('open','close') NOT NULL,
	`startMs` bigint NOT NULL,
	`endMs` bigint NOT NULL,
	`reason` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `availability_windows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`question` varchar(200) NOT NULL,
	`answer` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`event` varchar(64) NOT NULL,
	`actorOpenId` varchar(128),
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`kind` enum('confirmation','reminder_24h','reminder_1h','reschedule','cancellation') NOT NULL,
	`scheduledForMs` bigint NOT NULL,
	`sentAt` timestamp,
	`errorDetail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consultationType` varchar(32) NOT NULL,
	`slotStartMs` bigint NOT NULL,
	`slotEndMs` bigint NOT NULL,
	`status` enum('held','booked','cancelled') NOT NULL DEFAULT 'held',
	`bookingId` int,
	`holdToken` varchar(64),
	`holdExpiresAtMs` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `booking_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`startMs` bigint NOT NULL,
	`endMs` bigint NOT NULL,
	`label` varchar(200) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calendar_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `timezone_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`timezone` varchar(64) NOT NULL,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `timezone_preferences_id` PRIMARY KEY(`id`)
);
