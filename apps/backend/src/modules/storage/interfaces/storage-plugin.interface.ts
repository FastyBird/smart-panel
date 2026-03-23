import { StorageMeasurementSchema, StoragePoint, StorageQueryOptions } from '../storage.types';

/**
 * Contract that all storage plugins must implement.
 *
 * Provides a unified interface for time-series data storage,
 * abstracting away the underlying storage engine (InfluxDB, in-memory, etc.).
 */
export interface StoragePlugin {
	/**
	 * Unique plugin identifier (e.g., 'influx-v1-plugin', 'memory-storage-plugin').
	 */
	readonly name: string;

	/**
	 * Initialize the plugin (connect to database, set up structures, etc.).
	 */
	initialize(): Promise<void>;

	/**
	 * Gracefully shut down the plugin (close connections, clean up timers, etc.).
	 */
	destroy(): Promise<void>;

	/**
	 * Whether the plugin is ready to accept reads and writes.
	 */
	isAvailable(): boolean;

	// ─── Core Read/Write ──────────────────────────────────────────────

	/**
	 * Write one or more data points.
	 */
	writePoints(points: StoragePoint[]): Promise<void>;

	/**
	 * Execute a query and return typed results.
	 */
	query<T>(query: string, options?: StorageQueryOptions): Promise<T[]>;

	/**
	 * Execute a query and return raw (un-parsed) results.
	 */
	queryRaw<T>(query: string, options?: StorageQueryOptions): Promise<T>;

	// ─── Schema ───────────────────────────────────────────────────────

	/**
	 * Register a measurement schema before the plugin initializes.
	 */
	registerSchema(schema: StorageMeasurementSchema): void;

	// ─── Measurement Management ───────────────────────────────────────

	/**
	 * Drop (delete) an entire measurement.
	 */
	dropMeasurement(measurement: string): Promise<void>;

	/**
	 * List all measurement names in the store.
	 */
	getMeasurements(): Promise<string[]>;

	// ─── Optional: InfluxDB-Specific Operations ──────────────────────
	// These are implemented by the influx-v1 plugin and are no-ops elsewhere.

	createDatabase?(...args: unknown[]): Promise<void>;
	dropDatabase?(...args: unknown[]): Promise<void>;
	getDatabaseNames?(): Promise<string[]>;

	createRetentionPolicy?(...args: unknown[]): Promise<void>;
	alterRetentionPolicy?(...args: unknown[]): Promise<void>;
	showRetentionPolicies?(...args: unknown[]): Promise<unknown[]>;
	dropRetentionPolicy?(...args: unknown[]): Promise<void>;

	createContinuousQuery?(name: string, body: string, db?: string, resample?: string): Promise<void>;
	showContinuousQueries?(...args: unknown[]): Promise<unknown[]>;
	dropContinuousQuery?(...args: unknown[]): Promise<void>;

	dropSeries?(...args: unknown[]): Promise<void>;
	getSeries?(): Promise<string[]>;
	ping?(): Promise<unknown[]>;

	createUser?(...args: unknown[]): Promise<void>;
	dropUser?(...args: unknown[]): Promise<void>;
	getUsers?(): Promise<Array<{ user: string; admin: boolean }>>;
	setPassword?(...args: unknown[]): Promise<void>;
	grantPrivilege?(...args: unknown[]): Promise<void>;
	revokePrivilege?(...args: unknown[]): Promise<void>;
	grantAdminPrivilege?(...args: unknown[]): Promise<void>;
	revokeAdminPrivilege?(...args: unknown[]): Promise<void>;

	writeMeasurement?(...args: unknown[]): Promise<void>;
}
