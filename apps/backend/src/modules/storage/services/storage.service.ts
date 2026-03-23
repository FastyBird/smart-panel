import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../config/services/config.service';
import { StoragePlugin } from '../interfaces/storage-plugin.interface';
import { StorageConfigModel } from '../models/config.model';
import { InfluxV1ConfigModel } from '../plugins/influx-v1/influx-v1.config.model';
import { InfluxV1Plugin } from '../plugins/influx-v1/influx-v1.plugin';
import { MemoryStoragePlugin } from '../plugins/memory/memory.plugin';
import { STORAGE_MODULE_NAME, STORAGE_PLUGIN_INFLUX_V1, STORAGE_PLUGIN_MEMORY } from '../storage.constants';
import { StorageMeasurementSchema, StoragePoint, StorageQueryOptions } from '../storage.types';

@Injectable()
export class StorageService implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = createExtensionLogger(STORAGE_MODULE_NAME, 'StorageService');

	private primary: StoragePlugin | null = null;
	private fallback: StoragePlugin | null = null;

	/**
	 * Schemas buffered before plugins are created.
	 * Flushed to plugins during onApplicationBootstrap().
	 */
	private readonly pendingSchemas: StorageMeasurementSchema[] = [];
	private pluginsCreated = false;

	constructor(private readonly configService: ConfigService) {}

	async onApplicationBootstrap(): Promise<void> {
		const config = this.getConfig();

		// Create plugins
		this.primary = this.createPlugin(config.primaryStorage);
		this.fallback = this.createPlugin(config.fallbackStorage);
		this.pluginsCreated = true;

		// Flush buffered schemas to plugins
		for (const schema of this.pendingSchemas) {
			this.primary?.registerSchema(schema);
			this.fallback?.registerSchema(schema);
		}

		this.pendingSchemas.length = 0;

		// Initialize fallback first (always available)
		if (this.fallback) {
			try {
				await this.fallback.initialize();
				this.logger.log(`Fallback storage initialized: ${this.fallback.name}`);
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to initialize fallback storage: ${err.message}`, { stack: err.stack });
				this.fallback = null;
			}
		}

		// Initialize primary
		if (this.primary) {
			try {
				await this.primary.initialize();

				if (this.primary.isAvailable()) {
					this.logger.log(`Primary storage initialized: ${this.primary.name}`);
				} else {
					this.logger.warn(
						`Primary storage (${this.primary.name}) not available — using fallback (${this.fallback?.name ?? 'none'})`,
					);
				}
			} catch (error) {
				const err = error as Error;

				this.logger.error(`Failed to initialize primary storage: ${err.message}`, { stack: err.stack });
				this.logger.warn(`Using fallback storage: ${this.fallback?.name ?? 'none'}`);
			}
		}
	}

	async onModuleDestroy(): Promise<void> {
		if (this.primary) {
			await this.primary.destroy();
		}

		if (this.fallback) {
			await this.fallback.destroy();
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
		if (this.pluginsCreated) {
			// Plugins already exist — register directly
			this.primary?.registerSchema(schema);
			this.fallback?.registerSchema(schema);
		} else {
			// Buffer until plugins are created
			this.pendingSchemas.push(schema);
		}
	}

	// ─── Core Read/Write ──────────────────────────────────────────────

	async writePoints(points: StoragePoint[]): Promise<void> {
		// Always write to fallback (for fallback reads)
		if (this.fallback?.isAvailable()) {
			try {
				await this.fallback.writePoints(points);
			} catch (error) {
				const err = error as Error;

				this.logger.warn(`Fallback write failed: ${err.message}`);
			}
		}

		// Also write to primary if available
		if (this.primary?.isAvailable()) {
			await this.primary.writePoints(points);
		}
	}

	async query<T>(query: string, options?: StorageQueryOptions): Promise<T[]> {
		// Try primary first
		if (this.primary?.isAvailable()) {
			return this.primary.query<T>(query, options);
		}

		// Fall back
		if (this.fallback?.isAvailable()) {
			return this.fallback.query<T>(query, options);
		}

		return [];
	}

	async queryRaw<T>(query: string, options?: StorageQueryOptions): Promise<T> {
		if (this.primary?.isAvailable()) {
			return this.primary.queryRaw<T>(query, options);
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

	private createPlugin(pluginName: string): StoragePlugin | null {
		switch (pluginName) {
			case STORAGE_PLUGIN_INFLUX_V1: {
				const pluginConfig = this.getInfluxConfig();

				return new InfluxV1Plugin({
					host: pluginConfig.host,
					database: pluginConfig.database,
					username: pluginConfig.username,
					password: pluginConfig.password,
				});
			}

			case STORAGE_PLUGIN_MEMORY:
				return new MemoryStoragePlugin();

			default:
				this.logger.warn(`Unknown storage plugin: ${pluginName}`);

				return null;
		}
	}

	private getInfluxConfig(): InfluxV1ConfigModel {
		try {
			return this.configService.getPluginConfig<InfluxV1ConfigModel>(STORAGE_PLUGIN_INFLUX_V1);
		} catch (error) {
			this.logger.warn(
				'Failed to load InfluxDB plugin configuration, using defaults',
				error instanceof Error ? error : String(error),
			);

			return new InfluxV1ConfigModel();
		}
	}
}
