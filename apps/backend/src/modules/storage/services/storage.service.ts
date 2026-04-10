import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { StoragePlugin } from '../interfaces/storage-plugin.interface';
import { StorageConfigModel } from '../models/config.model';
import { STORAGE_MODULE_NAME } from '../storage.constants';
import { StorageMeasurementSchema, StoragePoint, StorageQueryOptions } from '../storage.types';

@Injectable()
export class StorageService {
	private readonly logger = createExtensionLogger(STORAGE_MODULE_NAME, 'StorageService');

	private primary: StoragePlugin | null = null;
	private fallback: StoragePlugin | null = null;

	/**
	 * All schemas registered so far.
	 * Flushed to each new plugin when it registers.
	 */
	private readonly schemas: StorageMeasurementSchema[] = [];

	constructor(private readonly configService: ConfigService) {}

	// ─── Plugin Registration ─────────────────────────────────────────

	/**
	 * Register an initialized storage plugin.
	 * Called by managed services after they start their plugin.
	 *
	 * The plugin is assigned to primary or fallback role based on the
	 * current StorageConfigModel settings.
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
		for (const schema of this.schemas) {
			plugin.registerSchema(schema);
		}
	}

	/**
	 * Unregister a storage plugin.
	 * Called by managed services when they stop their plugin.
	 */
	unregisterPlugin(name: string): void {
		const config = this.getConfig();

		if (name === config.primaryStorage && this.primary?.name === name) {
			this.primary = null;

			this.logger.log(`Primary storage unregistered: ${name}`);
		}

		if (name === config.fallbackStorage && this.fallback?.name === name) {
			this.fallback = null;

			this.logger.log(`Fallback storage unregistered: ${name}`);
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
		// Always buffer for late-arriving plugins
		this.schemas.push(schema);

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

	async query<T>(query: string, options?: StorageQueryOptions): Promise<T[]> {
		// Try primary first, fall back on transient failure
		if (this.primary?.isAvailable()) {
			try {
				return await this.primary.query<T>(query, options);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Primary query failed, trying fallback: ${err.message}`);
			}
		}

		if (this.fallback?.isAvailable()) {
			return this.fallback.query<T>(query, options);
		}

		return [];
	}

	async queryRaw<T>(query: string, options?: StorageQueryOptions): Promise<T> {
		if (this.primary?.isAvailable()) {
			try {
				return await this.primary.queryRaw<T>(query, options);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Primary raw query failed, trying fallback: ${err.message}`);
			}
		}

		if (this.fallback?.isAvailable()) {
			return this.fallback.queryRaw<T>(query, options);
		}

		return { results: [] } as T;
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
