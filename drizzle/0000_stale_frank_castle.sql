CREATE TABLE `assets` (
	`ticker` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sector` text,
	`location` text,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticker` text NOT NULL,
	`type` text DEFAULT 'COMPRA' NOT NULL,
	`price` real NOT NULL,
	`quantity` real NOT NULL,
	`date` text NOT NULL,
	`commission` real NOT NULL,
	FOREIGN KEY (`ticker`) REFERENCES `assets`(`ticker`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);