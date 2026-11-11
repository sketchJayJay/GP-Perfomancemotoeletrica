CREATE TABLE `jobRuns` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` text NOT NULL,
	`status` text NOT NULL,
	`accepted` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL
);
