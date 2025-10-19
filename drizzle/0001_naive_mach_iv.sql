CREATE TABLE `agentDecisions` (
	`id` varchar(64) NOT NULL,
	`strategyId` varchar(64) NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`agentType` enum('fundamental','sentiment','technical','bull_researcher','bear_researcher','trader','risk_manager') NOT NULL,
	`recommendation` enum('strong_buy','buy','hold','sell','strong_sell') NOT NULL,
	`confidence` int NOT NULL,
	`reasoning` text NOT NULL,
	`metrics` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `agentDecisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`strategyId` varchar(64),
	`eventType` varchar(100) NOT NULL,
	`eventData` text NOT NULL,
	`riskChecks` text,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketData` (
	`id` varchar(64) NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`timestamp` timestamp NOT NULL,
	`open` int NOT NULL,
	`high` int NOT NULL,
	`low` int NOT NULL,
	`close` int NOT NULL,
	`volume` int NOT NULL,
	`interval` varchar(10) NOT NULL DEFAULT '1m',
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `marketData_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`strategyId` varchar(64) NOT NULL,
	`positionId` varchar(64),
	`symbol` varchar(20) NOT NULL,
	`side` enum('buy','sell') NOT NULL,
	`type` enum('market','limit') NOT NULL,
	`quantity` int NOT NULL,
	`price` int,
	`filledQuantity` int NOT NULL DEFAULT 0,
	`filledPrice` int,
	`status` enum('pending','filled','cancelled','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp DEFAULT (now()),
	`filledAt` timestamp,
	`cancelledAt` timestamp,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `performanceMetrics` (
	`id` varchar(64) NOT NULL,
	`strategyId` varchar(64) NOT NULL,
	`date` timestamp NOT NULL,
	`totalValue` int NOT NULL,
	`dailyReturn` int NOT NULL,
	`sharpeRatio` int,
	`maxDrawdown` int,
	`winRate` int,
	`totalTrades` int NOT NULL DEFAULT 0,
	`winningTrades` int NOT NULL DEFAULT 0,
	`losingTrades` int NOT NULL DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `performanceMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`strategyId` varchar(64) NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`side` enum('long','short') NOT NULL,
	`quantity` int NOT NULL,
	`entryPrice` int NOT NULL,
	`currentPrice` int NOT NULL,
	`stopLoss` int,
	`takeProfit` int,
	`unrealizedPnL` int NOT NULL DEFAULT 0,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`openedAt` timestamp DEFAULT (now()),
	`closedAt` timestamp,
	`closedPrice` int,
	`realizedPnL` int,
	CONSTRAINT `positions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `riskAlerts` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`strategyId` varchar(64) NOT NULL,
	`alertType` enum('daily_loss_limit','position_size_exceeded','drawdown_limit','circuit_breaker','volatility_spike') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`acknowledged` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp DEFAULT (now()),
	`acknowledgedAt` timestamp,
	CONSTRAINT `riskAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategies` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT false,
	`riskLevel` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`maxPositionSize` int NOT NULL DEFAULT 2,
	`dailyLossLimit` int NOT NULL DEFAULT 10,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `strategies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `agentDecisions` (`strategyId`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `agentDecisions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `auditLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `eventType_idx` ON `auditLogs` (`eventType`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `auditLogs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `symbol_timestamp_idx` ON `marketData` (`symbol`,`timestamp`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `orders` (`userId`);--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `orders` (`strategyId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `performanceMetrics` (`strategyId`);--> statement-breakpoint
CREATE INDEX `date_idx` ON `performanceMetrics` (`date`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `positions` (`userId`);--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `positions` (`strategyId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `positions` (`status`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `riskAlerts` (`userId`);--> statement-breakpoint
CREATE INDEX `strategyId_idx` ON `riskAlerts` (`strategyId`);--> statement-breakpoint
CREATE INDEX `acknowledged_idx` ON `riskAlerts` (`acknowledged`);--> statement-breakpoint
CREATE INDEX `userId_idx` ON `strategies` (`userId`);