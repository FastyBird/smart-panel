import { createExtensionLogger } from '../../../../common/logger';
import { StoragePlugin } from '../../interfaces/storage-plugin.interface';
import { STORAGE_PLUGIN_MEMORY } from '../../storage.constants';
import { StorageMeasurementSchema, StoragePoint, StorageQueryOptions } from '../../storage.types';

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
export class MemoryStoragePlugin implements StoragePlugin {
	readonly name = STORAGE_PLUGIN_MEMORY;

	private readonly logger = createExtensionLogger(STORAGE_PLUGIN_MEMORY, 'MemoryStoragePlugin');

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
