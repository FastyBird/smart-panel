import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { StoragePlugin } from '../interfaces/storage-plugin.interface';
import { StorageConfigModel } from '../models/config.model';
import { STORAGE_MODULE_NAME } from '../storage.constants';
import { StorageMeasurementSchema, StoragePoint, StorageQueryOptions } from '../storage.types';

import { StorageWriteBuffer } from './storage-write-buffer';

declare const storageBackendBindingBrand: unique symbol;

export interface StorageBackendBinding {
	readonly [storageBackendBindingBrand]: true;
}

export interface BoundStorageQueryResult<T> {
	readonly rows: T[];
	readonly binding: StorageBackendBinding;
}

interface StorageBackendBindingState {
	readonly plugin: StoragePlugin;
	readonly role: 'primary' | 'fallback';
	readonly mirror?: StorageBackendBindingState;
}

interface BufferedStoragePoint {
	readonly point: StoragePoint;
	readonly primary: StoragePlugin | null;
	readonly fallback: StoragePlugin | null;
}

@Injectable()
export class StorageService implements OnApplicationShutdown {
	private readonly logger = createExtensionLogger(STORAGE_MODULE_NAME, 'StorageService');

	private primary: StoragePlugin | null = null;
	private fallback: StoragePlugin | null = null;
	private readonly pendingAdmissions = new Set<Promise<void>>();
	private readonly backendBindings = new WeakMap<StorageBackendBinding, StorageBackendBindingState>();
	private readonly writes = new StorageWriteBuffer<BufferedStoragePoint>(
		(batch) => this.writeBufferedBatch(batch),
		(error) =>
			this.logger.error(`Buffered storage write failed: ${error instanceof Error ? error.message : 'Unknown error'}`),
	);

	/**
	 * All schemas registered so far, keyed by measurement name.
	 * Deduplicated so plugin restarts don't accumulate duplicates.
	 * Flushed to each new plugin when it registers.
	 */
	private readonly schemas = new Map<string, StorageMeasurementSchema>();

	constructor(private readonly configService: ConfigService) {}

	// ─── Plugin Registration ─────────────────────────────────────────

	/**
	 * Register an initialized storage plugin.
	 * Called by managed services after they start their plugin.
	 *
	 * The plugin is assigned to primary or fallback role based on the
	 * current StorageConfigModel settings. All buffered schemas are
	 * flushed to the plugin upon registration.
	 *
	 * **Ordering note:** Some storage backends (e.g., InfluxDB v1) snapshot
	 * schemas at construction time during initialize(). For those, call
	 * registerPlugin() BEFORE initialize() so schemas are available.
	 * Other backends (e.g., InfluxDB v2) use lazy lookup, so
	 * registerPlugin() can be called AFTER initialize().
	 */
	registerPlugin(name: string, plugin: StoragePlugin): void {
		const config = this.getConfig();

		if (name === config.primaryStorage) {
			this.primary = plugin;

			this.logger.log(`Primary storage registered: ${name}`);
		}

		if (name === config.fallbackStorage) {
			this.fallback = plugin;

			this.logger.log(`Fallback storage registered: ${name}`);
		}

		// Flush buffered schemas to the newly registered plugin
		for (const schema of this.schemas.values()) {
			plugin.registerSchema(schema);
		}
	}

	/**
	 * Unregister a storage plugin by name.
	 * Called by managed services when they stop their plugin.
	 *
	 * Matches by plugin instance name rather than config role to avoid
	 * stale references when config changes race with service stop.
	 */
	async unregisterPlugin(name: string): Promise<void> {
		if (this.primary?.name === name) {
			this.primary = null;

			this.logger.log(`Primary storage unregistered: ${name}`);
		}

		if (this.fallback?.name === name) {
			this.fallback = null;

			this.logger.log(`Fallback storage unregistered: ${name}`);
		}
		// Removing the roles synchronously prevents new producers from selecting this plugin.
		// Existing producers already own their destinations, including those waiting for capacity.
		// Join their admission first: flush alone only covers points already inside the buffer.
		await Promise.allSettled([...this.pendingAdmissions]);
		await this.flushQueuedWrites();
	}

	onApplicationShutdown(): Promise<void> {
		// Managed producers emit final reports during onModuleDestroy. Keep admission
		// open until the manager stops them and unregisterPlugin drains their backends.
		return this.writes.close();
	}

	/**
	 * Capture destinations before waiting for capacity so plugin stop can drain every producer.
	 * Completion means bounded admission, not durable persistence. Admission rejects without an available destination.
	 */
	async enqueueWritePoint(point: StoragePoint): Promise<void> {
		const primary = this.primary?.isAvailable() ? this.primary : null;
		const fallback = this.fallback?.isAvailable() ? this.fallback : null;
		if (!primary && !fallback) throw new Error('No available storage backend for buffered history');

		const snapshot = {
			...point,
			tags: point.tags ? { ...point.tags } : undefined,
			fields: { ...point.fields },
			timestamp: point.timestamp ? new Date(point.timestamp) : undefined,
		};
		const admission = this.writes.enqueue(() => ({ point: snapshot, primary, fallback }));
		this.pendingAdmissions.add(admission);
		try {
			await admission;
		} finally {
			this.pendingAdmissions.delete(admission);
		}
	}

	/** Join writes admitted before this call. Lifecycle/strict callers must hold their admission barrier. */
	flushQueuedWrites(): Promise<void> {
		return this.writes.flush();
	}

	private async writeBufferedBatch(batch: BufferedStoragePoint[]): Promise<void> {
		// Batch only adjacent points with the same captured destinations; never reroute old history
		// into a newly registered backend. Array order also preserves same-timestamp last-write wins.
		for (let start = 0; start < batch.length; ) {
			const { primary, fallback } = batch[start];
			let end = start + 1;
			while (end < batch.length && batch[end].primary === primary && batch[end].fallback === fallback) end++;
			const points = batch.slice(start, end).map(({ point }) => point);
			for (const plugin of [fallback, primary]) {
				if (!plugin) continue;
				try {
					await plugin.writePoints(points);
				} catch (error) {
					this.logger.error(
						`Buffered write to ${plugin.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
					);
				}
			}
			if (!primary && !fallback) this.logger.warn('Buffered history has no available storage backend');
			start = end;
		}
	}

	// ─── Status ───────────────────────────────────────────────────────

	/**
	 * Returns true when any storage (primary or fallback) is ready.
	 * Consumers should use this to check if reads/writes will work.
	 */
	isConnected(): boolean {
		return (this.primary?.isAvailable() ?? false) || (this.fallback?.isAvailable() ?? false);
	}

	/**
	 * Returns true only when the primary storage (e.g. InfluxDB) is connected.
	 */
	isPrimaryAvailable(): boolean {
		return this.primary?.isAvailable() ?? false;
	}

	/**
	 * Returns true when operating in fallback mode.
	 */
	isUsingFallback(): boolean {
		return !this.isPrimaryAvailable() && (this.fallback?.isAvailable() ?? false);
	}

	// ─── Schema Registration ──────────────────────────────────────────

	registerSchema(schema: StorageMeasurementSchema): void {
		// Buffer by measurement name — last registration wins, no duplicates
		this.schemas.set(schema.measurement, schema);

		// Also register on any existing plugins
		this.primary?.registerSchema(schema);
		this.fallback?.registerSchema(schema);
	}

	// ─── Core Read/Write ──────────────────────────────────────────────

	async writePoints(points: StoragePoint[]): Promise<void> {
		// Write to both storages — best effort for each.
		// Data lands in at least one if either is reachable.
		if (this.fallback?.isAvailable()) {
			try {
				await this.fallback.writePoints(points);
			} catch (error) {
				const err = error as Error;

				this.logger.warn(`Fallback write failed: ${err.message}`);
			}
		}

		if (this.primary?.isAvailable()) {
			try {
				await this.primary.writePoints(points);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Primary write failed: ${err.message}`);
			}
		}
	}

	/**
	 * Write to every available backend while requiring the active read backend to persist.
	 * Callers that retry state reconciliation use this path so a failed best-effort
	 * write cannot be mistaken for a persisted measurement.
	 */
	async writePointsStrict(points: StoragePoint[], binding?: StorageBackendBinding): Promise<void> {
		if (binding) {
			const state = this.backendBindings.get(binding);

			if (!state || this[state.role] !== state.plugin || !state.plugin.isAvailable()) {
				throw new Error('Bound storage backend is no longer available');
			}

			await state.plugin.writePoints(points);

			const mirror = state.mirror;
			if (mirror && this[mirror.role] === mirror.plugin && mirror.plugin.isAvailable()) {
				try {
					await mirror.plugin.writePoints(points);
				} catch (error) {
					const err = error as Error;

					this.logger.warn(`Bound strict write mirror failed after required persistence: ${err.message}`);
				}
			}

			return;
		}

		const primaryAvailable = this.primary?.isAvailable() ?? false;
		const fallbackAvailable = this.fallback?.isAvailable() ?? false;

		if (primaryAvailable) {
			try {
				await this.primary?.writePoints(points);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Primary strict write failed: ${err.message}`);
				throw error;
			}

			if (fallbackAvailable) {
				try {
					await this.fallback?.writePoints(points);
				} catch (error) {
					const err = error as Error;

					this.logger.warn(`Fallback strict write failed after primary persistence: ${err.message}`);
				}
			}

			return;
		}
		if (fallbackAvailable) {
			await this.fallback?.writePoints(points);

			return;
		}

		throw new Error('No storage backend is available');
	}

	async query<T>(query: string, options?: StorageQueryOptions): Promise<T[]> {
		this.throwIfQueryAborted(options?.signal);

		// Try primary first, fall back on transient failure
		if (this.primary?.isAvailable()) {
			try {
				return await this.primary.query<T>(query, options);
			} catch (error) {
				this.throwIfQueryAborted(options?.signal);
				const err = error as Error;

				this.logger.error(`Primary query failed, trying fallback: ${err.message}`);
			}
		}

		if (this.fallback?.isAvailable()) {
			this.throwIfQueryAborted(options?.signal);
			return this.fallback.query<T>(query, options);
		}

		return [];
	}

	/**
	 * Query storage while preserving the normal primary-to-fallback behavior,
	 * but propagate the final failure instead of returning an empty result.
	 */
	async queryStrict<T>(query: string, options?: StorageQueryOptions): Promise<T[]> {
		this.throwIfQueryAborted(options?.signal);
		let primaryError: unknown;

		if (this.primary?.isAvailable()) {
			try {
				return await (this.primary.queryStrict?.<T>(query, options) ?? this.primary.query<T>(query, options));
			} catch (error) {
				this.throwIfQueryAborted(options?.signal);
				primaryError = error;
				const err = error as Error;

				this.logger.error(`Primary strict query failed, trying fallback: ${err.message}`);
			}
		}

		if (this.fallback?.isAvailable()) {
			this.throwIfQueryAborted(options?.signal);
			return this.fallback.queryStrict?.<T>(query, options) ?? this.fallback.query<T>(query, options);
		}

		if (primaryError) {
			throw primaryError;
		}

		throw new Error('No storage backend is available');
	}

	/**
	 * Query the backend that strict reconciliation writes currently require.
	 * Unlike queryStrict(), an available primary is authoritative: its read
	 * failure is propagated instead of comparing stale fallback data and then
	 * writing the result to primary.
	 */
	async queryActiveStrict<T>(query: string, options?: StorageQueryOptions): Promise<T[]> {
		return (await this.queryActiveStrictBound<T>(query, options)).rows;
	}

	/**
	 * Query the active backend and return an opaque binding that lets a later
	 * strict write target the exact same plugin. Reconciliation must not compare
	 * fallback state and then write to a primary that recovered in between.
	 */
	async queryActiveStrictBound<T>(query: string, options?: StorageQueryOptions): Promise<BoundStorageQueryResult<T>> {
		this.throwIfQueryAborted(options?.signal);
		let state: StorageBackendBindingState;

		if (this.primary?.isAvailable()) {
			state = {
				plugin: this.primary,
				role: 'primary',
				...(this.fallback?.isAvailable() && this.fallback !== this.primary
					? { mirror: { plugin: this.fallback, role: 'fallback' as const } }
					: {}),
			};
		} else if (this.fallback?.isAvailable()) {
			state = { plugin: this.fallback, role: 'fallback' };
		} else {
			throw new Error('No storage backend is available');
		}

		const rows = await (state.plugin.queryStrict?.<T>(query, options) ?? state.plugin.query<T>(query, options));

		if (this[state.role] !== state.plugin) {
			throw new Error('Active storage backend changed during query');
		}

		const binding = {} as StorageBackendBinding;
		this.backendBindings.set(binding, state);

		return { rows, binding };
	}

	async queryRaw<T>(query: string, options?: StorageQueryOptions): Promise<T> {
		this.throwIfQueryAborted(options?.signal);

		if (this.primary?.isAvailable()) {
			try {
				return await this.primary.queryRaw<T>(query, options);
			} catch (error) {
				this.throwIfQueryAborted(options?.signal);
				const err = error as Error;

				this.logger.error(`Primary raw query failed, trying fallback: ${err.message}`);
			}
		}

		if (this.fallback?.isAvailable()) {
			this.throwIfQueryAborted(options?.signal);
			return this.fallback.queryRaw<T>(query, options);
		}

		return { results: [] } as T;
	}

	private throwIfQueryAborted(signal?: AbortSignal): void {
		if (!signal?.aborted) {
			return;
		}

		throw signal.reason instanceof Error ? signal.reason : new Error('Storage query aborted');
	}

	// ─── Measurement Management ───────────────────────────────────────

	async dropMeasurement(measurement: string): Promise<void> {
		// Drop from both
		if (this.fallback?.isAvailable()) {
			try {
				await this.fallback.dropMeasurement(measurement);
			} catch {
				// Best-effort
			}
		}

		if (this.primary?.isAvailable()) {
			await this.primary.dropMeasurement(measurement);
		}
	}

	async getMeasurements(): Promise<string[]> {
		if (this.primary?.isAvailable()) {
			return this.primary.getMeasurements();
		}

		if (this.fallback?.isAvailable()) {
			return this.fallback.getMeasurements();
		}

		return [];
	}

	// ─── InfluxDB-Specific Delegated Methods ──────────────────────────
	// These delegate to the primary plugin if it supports them, otherwise no-op.

	async createContinuousQuery(name: string, body: string, db?: string, resample?: string): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.createContinuousQuery) {
			return this.primary.createContinuousQuery(name, body, db, resample);
		}
	}

	async showContinuousQueries(...args: unknown[]): Promise<Array<{ name: string; query: string }>> {
		if (this.primary?.isAvailable() && this.primary.showContinuousQueries) {
			return this.primary.showContinuousQueries(...args) as Promise<Array<{ name: string; query: string }>>;
		}

		return [];
	}

	async dropContinuousQuery(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.dropContinuousQuery) {
			return this.primary.dropContinuousQuery(...args);
		}
	}

	async createDatabase(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.createDatabase) {
			return this.primary.createDatabase(...args);
		}
	}

	async dropDatabase(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.dropDatabase) {
			return this.primary.dropDatabase(...args);
		}
	}

	async getDatabaseNames(): Promise<string[]> {
		if (this.primary?.isAvailable() && this.primary.getDatabaseNames) {
			return this.primary.getDatabaseNames();
		}

		return [];
	}

	async createRetentionPolicy(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.createRetentionPolicy) {
			return this.primary.createRetentionPolicy(...args);
		}
	}

	async alterRetentionPolicy(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.alterRetentionPolicy) {
			return this.primary.alterRetentionPolicy(...args);
		}
	}

	async showRetentionPolicies(...args: unknown[]): Promise<
		Array<{
			default: boolean;
			duration: string;
			name: string;
			replicaN: number;
			shardGroupDuration: string;
		}>
	> {
		if (this.primary?.isAvailable() && this.primary.showRetentionPolicies) {
			return this.primary.showRetentionPolicies(...args) as Promise<
				Array<{
					default: boolean;
					duration: string;
					name: string;
					replicaN: number;
					shardGroupDuration: string;
				}>
			>;
		}

		return [];
	}

	async dropRetentionPolicy(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.dropRetentionPolicy) {
			return this.primary.dropRetentionPolicy(...args);
		}
	}

	async dropSeries(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.dropSeries) {
			return this.primary.dropSeries(...args);
		}
	}

	async ping(): Promise<unknown[]> {
		if (this.primary?.isAvailable() && this.primary.ping) {
			return this.primary.ping();
		}

		return [];
	}

	async createUser(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.createUser) {
			return this.primary.createUser(...args);
		}
	}

	async dropUser(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.dropUser) {
			return this.primary.dropUser(...args);
		}
	}

	async getUsers(): Promise<Array<{ user: string; admin: boolean }>> {
		if (this.primary?.isAvailable() && this.primary.getUsers) {
			return this.primary.getUsers();
		}

		return [];
	}

	async setPassword(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.setPassword) {
			return this.primary.setPassword(...args);
		}
	}

	async grantPrivilege(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.grantPrivilege) {
			return this.primary.grantPrivilege(...args);
		}
	}

	async revokePrivilege(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.revokePrivilege) {
			return this.primary.revokePrivilege(...args);
		}
	}

	async grantAdminPrivilege(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.grantAdminPrivilege) {
			return this.primary.grantAdminPrivilege(...args);
		}
	}

	async revokeAdminPrivilege(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.revokeAdminPrivilege) {
			return this.primary.revokeAdminPrivilege(...args);
		}
	}

	async writeMeasurement(...args: unknown[]): Promise<void> {
		if (this.primary?.isAvailable() && this.primary.writeMeasurement) {
			return this.primary.writeMeasurement(...args);
		}
	}

	async getSeries(): Promise<string[]> {
		if (this.primary?.isAvailable() && this.primary.getSeries) {
			return this.primary.getSeries();
		}

		return [];
	}

	// ─── Private Helpers ──────────────────────────────────────────────

	private getConfig(): StorageConfigModel {
		try {
			return this.configService.getModuleConfig<StorageConfigModel>(STORAGE_MODULE_NAME);
		} catch (error) {
			this.logger.warn(
				'Failed to load storage configuration, using defaults',
				error instanceof Error ? error : String(error),
			);

			const defaultConfig = new StorageConfigModel();
			defaultConfig.type = STORAGE_MODULE_NAME;

			return defaultConfig;
		}
	}
}
