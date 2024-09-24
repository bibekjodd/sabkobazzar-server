CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text(200) NOT NULL,
	`image` text(200),
	`category` text DEFAULT 'others' NOT NULL,
	`desccription` text(500),
	`owner_id` text NOT NULL,
	`price` integer NOT NULL,
	`added_at` text NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE INDEX `products_idx_owner_id` ON `products` (`owner_id`);