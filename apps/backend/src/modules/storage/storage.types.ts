/**
 * Storage-own type abstractions.
 *
 * Consumer modules import these types instead of the `influx` package directly.
 * Only the influx-v1 plugin needs to know about InfluxDB internals.
 */

// ─── Field Types ─────────────────────────────────────────────────────

/**
 * Supported field-value types for measurement schemas.
 * Maps 1:1 to InfluxDB field types but is storage-agnostic.
 */
export enum StorageFieldType {
	FLOAT = 'FLOAT',
	INTEGER = 'INTEGER',
	STRING = 'STRING',
	BOOLEAN = 'BOOLEAN',
}

// ─── Measurement Schema ──────────────────────────────────────────────

/**
 * Describes the shape of a measurement (table).
 * Used to register field types and tag keys before the storage initializes.
 */
export interface StorageMeasurementSchema {
	/** Measurement (table) name. */
	measurement: string;
	/** Map of field names to their types. */
	fields: Record<string, StorageFieldType>;
	/** List of tag (index) key names. */
	tags: string[];
}

// ─── Data Point ──────────────────────────────────────────────────────

/**
 * A single time-series data point to write.
 */
export interface StoragePoint {
	/** Target measurement name. */
	measurement: string;
	/** Tag key-value pairs (indexed, low-cardinality). */
	tags?: Record<string, string>;
	/** Field key-value pairs (values). */
	fields?: Record<string, string | number | boolean>;
	/** Point timestamp. Defaults to now() if omitted. */
	timestamp?: Date;
}

// ─── Query Options ───────────────────────────────────────────────────

/**
 * Options passed to query methods.
 */
export interface StorageQueryOptions {
	/** Database to query (plugin-specific, usually the default). */
	database?: string;
	/** Retention policy to query from. */
	retentionPolicy?: string;
	/** Request-level precision (nanoseconds, milliseconds, etc.). */
	precision?: 'n' | 'u' | 'ms' | 's' | 'm' | 'h';
}
