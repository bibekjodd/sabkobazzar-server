CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text(30) NOT NULL,
	`email` text(50) NOT NULL,
	`role` text DEFAULT 'user',
	`image` text(300),
	`phone` integer
);
CREATE UNIQUE INDEX `uk_email` ON `users` (`email`);