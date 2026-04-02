import { createExtensionLogger } from '../../../common/logger';
import { StoragePlugin } from '../../../modules/storage/interfaces/storage-plugin.interface';
import { StorageMeasurementSchema, StoragePoint, StorageQueryOptions } from '../../../modules/storage/storage.types';
import { MEMORY_PLUGIN_NAME } from '../memory-storage.constants';

import { InMemoryTimeSeriesStore } from './in-memory-timeseries.store';
import { InfluxQLParser } from './influxql-parser';

/**
 * In-memory storage plugin.
 *
 * Stores time-series data in process memory with automatic eviction.
 * Always available — used as the default fallback when no external
 * database is reachable.
 *
 * Data does NOT persist across process restarts.
 */
export class MemoryStorage implements StoragePlugin {
	readonly name = MEMORY_PLUGIN_NAME;

	private readonly logger = createExtensionLogger(MEMORY_PLUGIN_NAME, 'MemoryStorage');

	private store: InMemoryTimeSeriesStore | null = null;
	private parser: InfluxQLParser | null = null;

	initialize(): Promise<void> {
		this.store = new InMemoryTimeSeriesStore();
		this.parser = new InfluxQLParser(this.store);

		this.logger.log('In-memory storage plugin initialized');

		return Promise.resolve();
	}

	destroy(): Promise<void> {
		if (this.store) {
			this.store.destroy();
			this.store = null;
			this.parser = null;
		}

		return Promise.resolve();
	}

	isAvailable(): boolean {
		return this.store !== null;
	}

	writePoints(points: StoragePoint[]): Promise<void> {
		this.getStore().writePoints(points);

		return Promise.resolve();
	}

	query<T>(query: string, _options?: StorageQueryOptions): Promise<T[]> {
		try {
			const results: T[] = this.getParser().execute<T>(query);

			return Promise.resolve(results);
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`In-memory query failed: ${err.message}`);

			return Promise.resolve<T[]>([]);
		}
	}

	queryRaw<T>(_query: string, _options?: StorageQueryOptions): Promise<T> {
		return Promise.resolve({ results: [] } as T);
	}

	registerSchema(_schema: StorageMeasurementSchema): void {
		// No-op: in-memory store doesn't use schemas
	}

	dropMeasurement(measurement: string): Promise<void> {
		this.getStore().dropMeasurement(measurement);

		return Promise.resolve();
	}

	getMeasurements(): Promise<string[]> {
		return Promise.resolve(this.getStore().getMeasurements());
	}

	private getStore(): InMemoryTimeSeriesStore {
		if (!this.store) {
			throw new Error('Memory storage plugin is not initialized');
		}

		return this.store;
	}

	private getParser(): InfluxQLParser {
		if (!this.parser) {
			throw new Error('Memory storage plugin is not initialized');
		}

		return this.parser;
	}
}
