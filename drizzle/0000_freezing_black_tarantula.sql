CREATE TABLE `birthdayLogs` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`customerId` text NOT NULL,
	`year` integer NOT NULL,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`providerId` text DEFAULT '' NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `birthday_once` ON `birthdayLogs` (`scope`,`customerId`,`year`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`document` text DEFAULT '' NOT NULL,
	`birthday` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`consent` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_scope` ON `customers` (`scope`);--> statement-breakpoint
CREATE TABLE `ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`payment` text NOT NULL,
	`saleId` text,
	`date` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ledger_amount" CHECK("ledger"."amount">0)
);
--> statement-breakpoint
CREATE INDEX `ledger_scope` ON `ledger` (`scope`);--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`name` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`power` text DEFAULT '' NOT NULL,
	`rangeKm` integer DEFAULT 0 NOT NULL,
	`battery` text DEFAULT '' NOT NULL,
	`color` text DEFAULT 'Preta' NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`minStock` integer DEFAULT 2 NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	CONSTRAINT "model_stock" CHECK("models"."stock" >= 0),
	CONSTRAINT "model_money" CHECK("models"."cost" >= 0 AND "models"."price" >= 0)
);
--> statement-breakpoint
CREATE INDEX `model_scope` ON `models` (`scope`);--> statement-breakpoint
CREATE TABLE `movements` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`modelId` text NOT NULL,
	`delta` integer NOT NULL,
	`kind` text NOT NULL,
	`unitCost` integer DEFAULT 0 NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`modelId`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "movement_delta" CHECK("movements"."delta" != 0)
);
--> statement-breakpoint
CREATE INDEX `movement_scope` ON `movements` (`scope`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`number` text NOT NULL,
	`customerId` text NOT NULL,
	`modelId` text NOT NULL,
	`quantity` integer NOT NULL,
	`unitPrice` integer NOT NULL,
	`cost` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`payment` text NOT NULL,
	`dueDate` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`chassis` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`createdAt` text NOT NULL,
	FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`modelId`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sale_qty" CHECK("sales"."quantity">0),
	CONSTRAINT "sale_values" CHECK("sales"."total">=0 AND "sales"."paid">=0 AND "sales"."paid"<="sales"."total")
);
--> statement-breakpoint
CREATE INDEX `sale_scope` ON `sales` (`scope`);--> statement-breakpoint
CREATE TABLE `settings` (
	`scope` text PRIMARY KEY NOT NULL,
	`storeName` text DEFAULT 'GP Performance' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`document` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`monthlyGoal` integer DEFAULT 10000000 NOT NULL,
	`birthdayEnabled` integer DEFAULT 0 NOT NULL,
	`birthdayTemplate` text DEFAULT 'Olá, {nome}! 🎉 A equipe {loja} deseja um feliz aniversário! Que seu novo ciclo venha cheio de energia e bons caminhos. Conte com a gente! ⚡🏍️' NOT NULL
);
