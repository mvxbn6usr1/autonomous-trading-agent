CREATE TABLE `marketScans` (
	`id` varchar(64) NOT NULL,
	`strategyId` varchar(64) NOT NULL,
	`scanType` enum('momentum','value','growth','technical','earnings') NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`score` int NOT NULL,
	`signals` text,
	`metrics` text,
	`scannedAt` timestamp DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `marketScans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolioSnapshots` (
	`id` varchar(64) NOT NULL,
	`portfolioId` varchar(64) NOT NULL,
	`totalValue` int NOT NULL,
	`cashValue` int NOT NULL,
	`positionsValue` int NOT NULL,
	`unrealizedPnL` int NOT NULL,
	`realizedPnL` int NOT NULL,
	`holdings` text,
	`snapshotAt` timestamp DEFAULT (now()),
	CONSTRAINT `portfolioSnapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolios` (
	`id` varchar(64) NOT NULL,
	`strategyId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`targetAllocation` text,
	`rebalanceFrequency` enum('daily','weekly','monthly') DEFAULT 'weekly',
	`maxStocks` int NOT NULL DEFAULT 10,
	`minCashPercent` int NOT NULL DEFAULT 10,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `portfolios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` varchar(64) NOT NULL,
	`strategyId` varchar(64) NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`addedAt` timestamp DEFAULT (now()),
	`addedReason` text,
	`targetEntryPrice` int,
	`targetAllocation` int,
	`priority` enum('low','medium','high') DEFAULT 'medium',
	`status` enum('watching','triggered','entered','rejected') DEFAULT 'watching',
	`lastAnalyzedAt` timestamp,
	`analysisCount` int DEFAULT 0,
	CONSTRAINT `watchlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `marketScans` (`strategyId`);--> statement-breakpoint
CREATE INDEX `symbol_idx` ON `marketScans` (`symbol`);--> statement-breakpoint
CREATE INDEX `score_idx` ON `marketScans` (`score`);--> statement-breakpoint
CREATE INDEX `scannedAt_idx` ON `marketScans` (`scannedAt`);--> statement-breakpoint
CREATE INDEX `portfolioId_idx` ON `portfolioSnapshots` (`portfolioId`);--> statement-breakpoint
CREATE INDEX `snapshotAt_idx` ON `portfolioSnapshots` (`snapshotAt`);--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `portfolios` (`strategyId`);--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `watchlists` (`strategyId`);--> statement-breakpoint
CREATE INDEX `symbol_idx` ON `watchlists` (`symbol`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `watchlists` (`status`);