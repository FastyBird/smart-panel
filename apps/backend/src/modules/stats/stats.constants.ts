export const STATS_MODULE_PREFIX = 'stats-module';

export const STATS_MODULE_NAME = 'stats-module';

export const STATS_MODULE_API_TAG_NAME = 'Stats module';

export const STATS_MODULE_API_TAG_DESCRIPTION =
	'Provides endpoints for retrieving aggregated runtime statistics from all backend modules. This includes system metrics (CPU, memory, disk, uptime), API performance data, WebSocket connection counts, dashboard entity statistics, and device activity summaries. Useful for monitoring backend performance and overall system health.';

export enum EventType {
	STATS_INFO = 'StatsModule.Stats.Info',
}
