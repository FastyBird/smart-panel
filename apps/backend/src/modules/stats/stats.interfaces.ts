export interface StatsProvider<T = unknown> {
	/** Optional supported scopes/params (e.g. ranges) */
	getStats(params?: Record<string, unknown>): Promise<T>;
}
