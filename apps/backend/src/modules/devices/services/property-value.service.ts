import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { StorageService } from '../../storage/services/storage.service';
import { DEVICES_MODULE_NAME, DataTypeType } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';
import { PropertyValueState, type PropertyValueTrend } from '../models/property-value-state.model';

import { PropertyValueSourceRegistryService } from './property-value-source.registry.service';

/**
 * Number of recent data points used for trend computation.
 */
const TREND_POINTS_COUNT = 5;
const BOUNDED_READ_MAX_PROPERTIES = 500;
const BOUNDED_READ_SOURCE_CHUNK_SIZE = 50;
const BOUNDED_READ_DEFAULT_DEADLINE_MS = 750;

interface PropertyValueRow {
	time?: Date | string;
	stringValue?: string;
	numberValue?: number;
	propertyId: ChannelPropertyEntity['id'];
}

export type BoundedPropertyValueSource = 'cache' | 'storage';
export type BoundedPropertyValueStorageStatus = 'not_needed' | 'available' | 'disconnected' | 'failed' | 'timed_out';

interface BoundedPropertyValueItemBase {
	propertyId: ChannelPropertyEntity['id'];
	sourcePropertyId: ChannelPropertyEntity['id'];
}

export type BoundedPropertyValueItem =
	| (BoundedPropertyValueItemBase & {
			status: 'available';
			source: BoundedPropertyValueSource;
			state: PropertyValueState & { value: string | number | boolean };
	  })
	| (BoundedPropertyValueItemBase & {
			status: 'missing';
			source: BoundedPropertyValueSource;
			state: PropertyValueState | null;
	  })
	| (BoundedPropertyValueItemBase & {
			status: 'unprocessed';
			source: null;
			state: null;
	  });

export interface BoundedPropertyValueReadOptions {
	deadlineAt?: Date;
}

export interface BoundedPropertyValueReadResult {
	items: BoundedPropertyValueItem[];
	requestedCount: number;
	availableCount: number;
	unknownCount: number;
	complete: boolean;
	storageStatus: BoundedPropertyValueStorageStatus;
	cacheCount: number;
	storageCount: number;
	missingCount: number;
	unprocessedCount: number;
	oldestLastUpdated: string | null;
	newestLastUpdated: string | null;
	freshnessUnknownCount: number;
}

interface BoundedPropertyValueSourceGroup {
	property: ChannelPropertyEntity;
	indexes: number[];
}

@Injectable()
export class PropertyValueService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PropertyValueService');

	private valuesMap: Map<ChannelPropertyEntity['id'], PropertyValueState> = new Map();

	/**
	 * Cache of recent values for trend computation.
	 * Stores last N numeric values per property.
	 */
	private recentValuesMap: Map<ChannelPropertyEntity['id'], number[]> = new Map();

	constructor(
		private readonly storageService: StorageService,
		private readonly valueSourceRegistry: PropertyValueSourceRegistryService,
	) {}

	/**
	 * Write property value to storage
	 * @returns true if value changed, false if value was the same or invalid
	 */
	async write(property: ChannelPropertyEntity, value: string | boolean | number | null): Promise<boolean> {
		return this.writeInternal(property, value, false);
	}

	/**
	 * Persist a value to at least one storage backend before publishing it to the
	 * process-local cache. Reconciliation callers can then retry a failed write
	 * without the cache falsely claiming that the measurement already exists.
	 */
	async writeStrict(property: ChannelPropertyEntity, value: string | boolean | number | null): Promise<boolean> {
		return this.writeInternal(property, value, true);
	}

	private async writeInternal(
		property: ChannelPropertyEntity,
		value: string | boolean | number | null,
		strict: boolean,
	): Promise<boolean> {
		const key = this.valueSourceRegistry.resolve(property);

		// A projected property owns no series — the value belongs to its source, and only the source's
		// own reports may write it. This is the exact mirror of delete()'s guard below, and exists for
		// the same reason: dereferencing here would persist the supplied value as a real measurement of
		// a device that was never commanded and never reported it, corrupting the source's latest value,
		// its trend cache and its stored history with a number no hardware produced.
		//
		// Nothing legitimate is lost, because no write ever legitimately arrives *through* a projection:
		//
		// - A source device reports on its own property, where the key already is that property's id.
		// - A command issued against a projection is forwarded to the source device's own platform
		//   (VirtualDevicePlatform), which makes the source report it back as above. The value the
		//   caller asked for still reaches the hardware; what is dropped is only the optimistic local
		//   echo, which for a projection would land in somebody else's series ahead of — or instead of —
		//   the hardware ever confirming it.
		// - A value supplied while *creating* a projection (POST with `value`) has no reporter behind it
		//   at all, and no command either. ChannelsPropertiesService.create() refuses that outright
		//   rather than letting it fall through to here, so the caller is told it was not stored.
		//
		// Past this point `key` is provably `property.id`; it stays named for the storage tag, so this
		// method and readLatest() keep resolving the series the same way.
		if (key !== property.id) {
			this.logger.debug(
				`Skipping write for projected property id=${property.id}: its value belongs to source property id=${key}`,
			);

			return false;
		}

		// Skip null values - device hasn't reported this property yet
		if (value === null || value === undefined) {
			return false;
		}

		// Skip invalid/sentinel values (e.g., -1 when sensor is off)
		// These are defined in the property's invalid field
		if (property.invalid !== null && this.isInvalidValue(property.invalid, value)) {
			this.logger.debug(`Skipping invalid/sentinel value for property id=${property.id}: value=${value}`);
			return false;
		}

		const cached = this.valuesMap.get(key);
		if (!strict && cached && cached.value === value) {
			// no change → skip storage write, but refresh lastUpdated so freshness stays accurate
			cached.lastUpdated = new Date().toISOString();
			return false;
		}

		// Validate value against format constraints
		const validationError = this.validateValue(property, value);
		if (validationError) {
			this.logger.warn(
				`Invalid value for property id=${property.id}: ${validationError}. Value=${JSON.stringify(value)}`,
			);
			return false;
		}

		const formattedValue: { stringValue?: string; numberValue?: number } = {};

		switch (property.dataType) {
			case DataTypeType.ENUM:
			case DataTypeType.STRING:
				formattedValue.stringValue = String(value);
				break;

			case DataTypeType.BOOL:
				formattedValue.stringValue = String(value ? 'true' : 'false');
				break;

			case DataTypeType.CHAR:
			case DataTypeType.UCHAR:
			case DataTypeType.SHORT:
			case DataTypeType.USHORT:
			case DataTypeType.INT:
			case DataTypeType.UINT:
			case DataTypeType.FLOAT:
				formattedValue.numberValue = Number(value);
				break;

			default:
				this.logger.error(`Unsupported data type dataType=${property.dataType} id=${property.id}`);

				return false;
		}

		const timestamp = new Date();
		const now = timestamp.toISOString();
		const point = {
			measurement: 'property_value',
			tags: { propertyId: key },
			fields: formattedValue,
			timestamp,
		};

		if (strict) {
			await this.storageService.writePointsStrict([point]);
		}

		// Update recent values cache for trend computation
		if (
			typeof value === 'number' ||
			(typeof value === 'string' && !isNaN(Number(value)) && this.isNumericDataType(property.dataType))
		) {
			const numValue = Number(value);
			const recent = this.recentValuesMap.get(key) ?? [];
			recent.push(numValue);
			if (recent.length > TREND_POINTS_COUNT) {
				recent.shift();
			}
			this.recentValuesMap.set(key, recent);
		}

		const trend = this.computeTrend(property, key);
		const state = new PropertyValueState(value, now, trend);

		// Update local cache regardless of storage availability
		this.valuesMap.set(key, state);

		if (strict) {
			return true;
		}

		if (!this.storageService.isConnected()) {
			return true; // Value changed in cache
		}

		try {
			await this.storageService.writePoints([point]);

			this.logger.debug(`Value saved id=${property.id} dataType=${property.dataType} value=${value}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`Failed to write value to storage id=${property.id} dataType=${property.dataType} error=${err.message}`,
				err.stack,
			);
		}

		return true; // Value changed
	}

	async readLatest(property: ChannelPropertyEntity): Promise<PropertyValueState | null> {
		return this.readLatestInternal(property, false);
	}

	async readLatestStrict(property: ChannelPropertyEntity): Promise<PropertyValueState | null> {
		return this.readLatestInternal(property, true);
	}

	async readLatestManyStrict(
		properties: ChannelPropertyEntity[],
	): Promise<Map<ChannelPropertyEntity['id'], PropertyValueState | null>> {
		const states = new Map<ChannelPropertyEntity['id'], PropertyValueState | null>();
		const missingByKey = new Map<ChannelPropertyEntity['id'], ChannelPropertyEntity>();
		const keyByProperty = new Map<ChannelPropertyEntity['id'], ChannelPropertyEntity['id']>();

		for (const property of properties) {
			const key = this.valueSourceRegistry.resolve(property);
			keyByProperty.set(property.id, key);
			const cached = this.valuesMap.get(key);

			if (cached) {
				states.set(property.id, cached);
			} else if (!missingByKey.has(key)) {
				missingByKey.set(key, property);
			}
		}

		if (missingByKey.size === 0) {
			return states;
		}
		if (!this.storageService.isConnected()) {
			throw new Error('Property value storage is unavailable');
		}

		const predicate = Array.from(missingByKey.keys())
			.map((key) => `propertyId = '${this.escapeTagValue(key)}'`)
			.join(' OR ');
		const query = `
        SELECT *
        FROM property_value
        WHERE (${predicate})
		GROUP BY "propertyId"
		ORDER BY time DESC
		LIMIT ${TREND_POINTS_COUNT}
      `;

		try {
			const rows = await this.storageService.queryStrict<PropertyValueRow>(query);
			const rowsByKey = new Map<ChannelPropertyEntity['id'], PropertyValueRow[]>();

			for (const row of rows) {
				rowsByKey.set(row.propertyId, [...(rowsByKey.get(row.propertyId) ?? []), row]);
			}

			for (const [key, property] of missingByKey) {
				const propertyRows = rowsByKey.get(key) ?? [];

				if (this.isNumericDataType(property.dataType)) {
					this.recentValuesMap.set(
						key,
						propertyRows
							.map((row) => row.numberValue)
							.filter((value): value is number => value !== undefined)
							.reverse(),
					);
				}

				const state = propertyRows[0] ? this.toState(property, key, propertyRows[0]) : null;

				if (state) {
					this.valuesMap.set(key, state);
				}
			}

			for (const property of properties) {
				if (!states.has(property.id)) {
					states.set(property.id, this.valuesMap.get(keyByProperty.get(property.id) ?? property.id) ?? null);
				}
			}

			return states;
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Failed to batch read latest property values from storage error=${err.message}`, err.stack);

			throw error;
		}
	}

	/**
	 * Reconciles a bounded property set against the live cache and cold storage without discarding cache hits when
	 * storage is unavailable. Counts are per logical property; projected properties share one source lookup but retain
	 * separate ordered result items. The optional deadline may tighten, but never extend, the 750 ms response ceiling.
	 */
	async readLatestManyBounded(
		properties: ChannelPropertyEntity[],
		options: BoundedPropertyValueReadOptions = {},
	): Promise<BoundedPropertyValueReadResult> {
		if (properties.length > BOUNDED_READ_MAX_PROPERTIES) {
			throw new RangeError(`At most ${BOUNDED_READ_MAX_PROPERTIES} property values may be read at once`);
		}

		const startedAt = Date.now();
		const requestedDeadlineAt = options.deadlineAt?.getTime() ?? startedAt + BOUNDED_READ_DEFAULT_DEADLINE_MS;

		if (!Number.isFinite(requestedDeadlineAt)) {
			throw new RangeError('Property value read deadline must be a valid date');
		}

		const deadlineAt = Math.min(requestedDeadlineAt, startedAt + BOUNDED_READ_DEFAULT_DEADLINE_MS);

		const items = new Array<BoundedPropertyValueItem | undefined>(properties.length);
		const sourcePropertyIds = new Array<ChannelPropertyEntity['id']>(properties.length);
		const unresolvedBySource = new Map<ChannelPropertyEntity['id'], BoundedPropertyValueSourceGroup>();

		for (const [index, property] of properties.entries()) {
			const sourcePropertyId = this.valueSourceRegistry.resolve(property);
			sourcePropertyIds[index] = sourcePropertyId;
			const cached = this.valuesMap.get(sourcePropertyId);

			if (cached) {
				items[index] = this.toBoundedItem(property.id, sourcePropertyId, cached, 'cache');
				continue;
			}

			const group = unresolvedBySource.get(sourcePropertyId);

			if (group) {
				group.indexes.push(index);
			} else {
				unresolvedBySource.set(sourcePropertyId, { property, indexes: [index] });
			}
		}

		if (unresolvedBySource.size === 0) {
			return this.buildBoundedResult(items, 'not_needed');
		}

		if (Date.now() >= deadlineAt) {
			this.refreshBoundedItemsFromCache(items, properties, sourcePropertyIds);
			this.fillUnprocessedBoundedItems(items, properties, unresolvedBySource);

			return this.buildBoundedResult(items, 'timed_out');
		}

		if (!this.storageService.isConnected()) {
			this.refreshBoundedItemsFromCache(items, properties, sourcePropertyIds);
			this.fillUnprocessedBoundedItems(items, properties, unresolvedBySource);

			return this.buildBoundedResult(items, 'disconnected');
		}

		const sourceEntries = [...unresolvedBySource.entries()];
		let storageStatus: BoundedPropertyValueStorageStatus = 'available';

		for (let offset = 0; offset < sourceEntries.length; offset += BOUNDED_READ_SOURCE_CHUNK_SIZE) {
			if (Date.now() >= deadlineAt) {
				storageStatus = 'timed_out';
				break;
			}

			const chunk = sourceEntries.slice(offset, offset + BOUNDED_READ_SOURCE_CHUNK_SIZE);
			const query = this.buildBoundedPropertyValueQuery(chunk.map(([sourcePropertyId]) => sourcePropertyId));

			try {
				const queryResult = await this.queryPropertyValuesBeforeDeadline(query, deadlineAt);

				if (queryResult === null) {
					storageStatus = 'timed_out';
					break;
				}

				this.applyBoundedStorageRows(items, properties, chunk, queryResult);

				for (const [sourcePropertyId] of chunk) {
					unresolvedBySource.delete(sourcePropertyId);
				}
			} catch (error) {
				const err = error as Error;
				this.logger.error(`Failed to bounded-batch read latest property values error=${err.message}`, err.stack);
				storageStatus = 'failed';
				break;
			}
		}

		this.refreshBoundedItemsFromCache(items, properties, sourcePropertyIds);
		this.fillUnprocessedBoundedItems(items, properties, unresolvedBySource);

		return this.buildBoundedResult(items, storageStatus);
	}

	private buildBoundedPropertyValueQuery(sourcePropertyIds: ChannelPropertyEntity['id'][]): string {
		const predicate = sourcePropertyIds
			.map((sourcePropertyId) => `propertyId = '${this.escapeTagValue(sourcePropertyId)}'`)
			.join(' OR ');

		return `
	        SELECT *
	        FROM property_value
	        WHERE (${predicate})
			GROUP BY "propertyId"
			ORDER BY time DESC
			LIMIT ${TREND_POINTS_COUNT}
	      `;
	}

	private async queryPropertyValuesBeforeDeadline(
		query: string,
		deadlineAt: number,
	): Promise<PropertyValueRow[] | null> {
		const remainingMs = deadlineAt - Date.now();

		if (remainingMs <= 0) {
			return null;
		}

		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(new Error('Property value storage query timed out')),
			remainingMs,
		);

		try {
			return await this.storageService.queryStrict<PropertyValueRow>(query, { signal: controller.signal });
		} catch (error) {
			if (controller.signal.aborted) {
				return null;
			}

			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}

	private applyBoundedStorageRows(
		items: Array<BoundedPropertyValueItem | undefined>,
		properties: ChannelPropertyEntity[],
		chunk: Array<[ChannelPropertyEntity['id'], BoundedPropertyValueSourceGroup]>,
		rows: PropertyValueRow[],
	): void {
		const rowsBySource = new Map<ChannelPropertyEntity['id'], PropertyValueRow[]>();

		for (const row of rows) {
			rowsBySource.set(row.propertyId, [...(rowsBySource.get(row.propertyId) ?? []), row]);
		}

		for (const [sourcePropertyId, group] of chunk) {
			const sourceRows = rowsBySource.get(sourcePropertyId) ?? [];
			const firstRow = sourceRows[0];
			let storedState = firstRow ? this.toState(group.property, sourcePropertyId, firstRow) : null;
			const concurrentCache = this.valuesMap.get(sourcePropertyId);
			const useCache = concurrentCache !== undefined && this.isStateNewerOrEqual(concurrentCache, storedState);

			if (!useCache && firstRow) {
				this.updateRecentValuesFromRows(group.property, sourcePropertyId, sourceRows);
				storedState = this.toState(group.property, sourcePropertyId, firstRow);
			}

			const state = useCache ? concurrentCache : storedState;
			const source: BoundedPropertyValueSource = useCache ? 'cache' : 'storage';

			if (!useCache && storedState) {
				this.valuesMap.set(sourcePropertyId, storedState);
			}

			for (const index of group.indexes) {
				items[index] = this.toBoundedItem(properties[index].id, sourcePropertyId, state, source);
			}
		}
	}

	private isStateNewerOrEqual(cached: PropertyValueState, stored: PropertyValueState | null): boolean {
		if (!stored) {
			return true;
		}

		const cachedTime = cached.lastUpdated === null ? null : Date.parse(cached.lastUpdated);
		const storedTime = stored.lastUpdated === null ? null : Date.parse(stored.lastUpdated);

		if (cachedTime === null || Number.isNaN(cachedTime)) {
			return storedTime === null || Number.isNaN(storedTime);
		}
		if (storedTime === null || Number.isNaN(storedTime)) {
			return true;
		}

		return cachedTime >= storedTime;
	}

	private updateRecentValuesFromRows(
		property: ChannelPropertyEntity,
		sourcePropertyId: ChannelPropertyEntity['id'],
		rows: PropertyValueRow[],
	): void {
		if (!this.isNumericDataType(property.dataType)) {
			return;
		}

		this.recentValuesMap.set(
			sourcePropertyId,
			rows
				.map((row) => row.numberValue)
				.filter((value): value is number => value !== undefined)
				.reverse(),
		);
	}

	private toBoundedItem(
		propertyId: ChannelPropertyEntity['id'],
		sourcePropertyId: ChannelPropertyEntity['id'],
		state: PropertyValueState | null,
		source: BoundedPropertyValueSource,
	): BoundedPropertyValueItem {
		if (state === null || state.value === null) {
			return { propertyId, sourcePropertyId, status: 'missing', source, state };
		}

		return {
			propertyId,
			sourcePropertyId,
			status: 'available',
			source,
			state: state as PropertyValueState & { value: string | number | boolean },
		};
	}

	private refreshBoundedItemsFromCache(
		items: Array<BoundedPropertyValueItem | undefined>,
		properties: ChannelPropertyEntity[],
		sourcePropertyIds: ChannelPropertyEntity['id'][],
	): void {
		for (const [index, property] of properties.entries()) {
			const sourcePropertyId = sourcePropertyIds[index];
			const cached = this.valuesMap.get(sourcePropertyId);

			if (!cached) {
				continue;
			}
			const current = items[index];

			if (current?.state === cached) {
				continue;
			}
			if (current?.state && !this.isStateNewerOrEqual(cached, current.state)) {
				continue;
			}

			items[index] = this.toBoundedItem(property.id, sourcePropertyId, cached, 'cache');
		}
	}

	private fillUnprocessedBoundedItems(
		items: Array<BoundedPropertyValueItem | undefined>,
		properties: ChannelPropertyEntity[],
		groups: Map<ChannelPropertyEntity['id'], BoundedPropertyValueSourceGroup>,
	): void {
		for (const [sourcePropertyId, group] of groups) {
			for (const index of group.indexes) {
				if (items[index] !== undefined) {
					continue;
				}

				items[index] = {
					propertyId: properties[index].id,
					sourcePropertyId,
					status: 'unprocessed',
					source: null,
					state: null,
				};
			}
		}
	}

	private buildBoundedResult(
		items: Array<BoundedPropertyValueItem | undefined>,
		storageStatus: BoundedPropertyValueStorageStatus,
	): BoundedPropertyValueReadResult {
		const resolvedItems = items.filter((item): item is BoundedPropertyValueItem => item !== undefined);
		const cacheCount = resolvedItems.filter((item) => item.source === 'cache').length;
		const storageCount = resolvedItems.filter((item) => item.source === 'storage').length;
		const missingCount = resolvedItems.filter((item) => item.status === 'missing').length;
		const unprocessedCount = resolvedItems.filter((item) => item.status === 'unprocessed').length;
		const availableCount = resolvedItems.filter((item) => item.status === 'available').length;
		const unknownCount = missingCount + unprocessedCount;
		const freshnessUnknownCount = resolvedItems.filter(
			(item) =>
				item.status === 'available' &&
				(item.state.lastUpdated === null || Number.isNaN(Date.parse(item.state.lastUpdated))),
		).length;
		const timestamps = resolvedItems
			.filter((item) => item.status === 'available' && item.state?.lastUpdated !== null)
			.map((item) => item.state?.lastUpdated)
			.filter((timestamp): timestamp is string => timestamp !== undefined && !Number.isNaN(Date.parse(timestamp)))
			.sort((left, right) => Date.parse(left) - Date.parse(right));

		return {
			items: resolvedItems,
			requestedCount: items.length,
			availableCount,
			unknownCount,
			complete: unknownCount === 0,
			storageStatus,
			cacheCount,
			storageCount,
			missingCount,
			unprocessedCount,
			oldestLastUpdated: timestamps[0] ?? null,
			newestLastUpdated: timestamps[timestamps.length - 1] ?? null,
			freshnessUnknownCount,
		};
	}

	private async readLatestInternal(
		property: ChannelPropertyEntity,
		strict: boolean,
	): Promise<PropertyValueState | null> {
		const key = this.valueSourceRegistry.resolve(property);

		// Check local cache first
		const cached = this.valuesMap.get(key);
		if (cached) {
			this.logger.debug(`Loaded cached value for property id=${property.id}, value=${cached.value}`);

			return cached;
		}

		// Return null if storage not connected
		if (!this.storageService.isConnected()) {
			if (strict) {
				throw new Error('Property value storage is unavailable');
			}

			return null;
		}

		try {
			const query = `
        SELECT * FROM property_value
        WHERE propertyId = '${key}'
        ORDER BY time DESC
        LIMIT ${TREND_POINTS_COUNT}
      `;

			this.logger.debug(`Fetching latest value id=${property.id}`);

			const result = await (strict
				? this.storageService.queryStrict<PropertyValueRow>(query)
				: this.storageService.query<PropertyValueRow>(query));

			if (!result.length) {
				this.logger.debug(`No stored value found for id=${property.id}`);

				return null;
			}

			// Results are ordered DESC, so first = latest
			const latest = result[0];

			// Build recent values cache from query results (for trend computation)
			if (this.isNumericDataType(property.dataType) && result.length >= 1) {
				// Results are DESC, reverse to get ASC order for trend
				const recentValues: number[] = [];
				for (let i = result.length - 1; i >= 0; i--) {
					const val = result[i].numberValue;
					if (val != null) {
						recentValues.push(val);
					}
				}
				this.recentValuesMap.set(key, recentValues);
			}

			const state = this.toState(property, key, latest);

			this.logger.debug(`Read latest value id=${property.id} dataType=${property.dataType} value=${state.value}`);

			this.valuesMap.set(key, state);

			return state;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to read latest value from storage id=${property.id} error=${err.message}`, err.stack);
			if (strict) {
				throw error;
			}

			return null;
		}
	}

	private toState(property: ChannelPropertyEntity, key: string, latest: PropertyValueRow): PropertyValueState {
		let parsedValue: string | number | boolean | null;

		switch (property.dataType) {
			case DataTypeType.ENUM:
			case DataTypeType.STRING:
				parsedValue = latest.stringValue ?? null;
				break;
			case DataTypeType.BOOL:
				parsedValue = latest.stringValue != null ? latest.stringValue === 'true' : null;
				break;
			case DataTypeType.CHAR:
			case DataTypeType.UCHAR:
			case DataTypeType.SHORT:
			case DataTypeType.USHORT:
			case DataTypeType.INT:
			case DataTypeType.UINT:
				parsedValue = latest.numberValue != null ? Math.round(latest.numberValue) : null;
				break;
			case DataTypeType.FLOAT:
				parsedValue = latest.numberValue ?? null;
				break;
			default:
				parsedValue = null;
		}

		const lastUpdated = latest.time
			? latest.time instanceof Date
				? latest.time.toISOString()
				: String(latest.time)
			: null;

		return new PropertyValueState(parsedValue, lastUpdated, this.computeTrend(property, key));
	}

	private escapeTagValue(value: string): string {
		return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
	}

	async delete(property: ChannelPropertyEntity): Promise<void> {
		const key = this.valueSourceRegistry.resolve(property);

		// A projected property owns no series — the value belongs to its source. Deleting here would
		// destroy the source device's entire history, so bail out before clearing caches or storage.
		if (key !== property.id) {
			return;
		}

		// Always clear local cache
		this.valuesMap.delete(property.id);
		this.recentValuesMap.delete(property.id);

		if (!this.storageService.isConnected()) {
			return;
		}

		try {
			const query = `DELETE FROM property_value WHERE propertyId = '${property.id}'`;

			await this.storageService.query(query);

			this.logger.log(`Deleted all stored values for id=${property.id}`);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`Failed to delete property data from storage propertyId=${property.id} error=${err.message}`,
				err.stack,
			);
		}
	}

	async deleteSinceStrict(property: ChannelPropertyEntity, since: Date): Promise<void> {
		const key = this.valueSourceRegistry.resolve(property);
		if (key !== property.id) {
			return;
		}
		if (!this.storageService.isConnected()) {
			throw new Error('Property value storage is unavailable');
		}

		this.valuesMap.delete(key);
		this.recentValuesMap.delete(key);
		const firstTransientMillisecond = new Date(since.getTime() + 1);
		await this.storageService.queryStrict(
			`DELETE FROM property_value WHERE propertyId = '${this.escapeTagValue(key)}' AND time >= '${firstTransientMillisecond.toISOString()}'`,
		);
	}

	/**
	 * Compute trend direction from recent cached values.
	 * Returns null for non-numeric types or insufficient data.
	 */
	private computeTrend(property: ChannelPropertyEntity, key: string): PropertyValueTrend | null {
		if (!this.isNumericDataType(property.dataType)) {
			return null;
		}

		const recent = this.recentValuesMap.get(key);
		if (!recent || recent.length < 2) {
			return null;
		}

		const first = recent[0];
		const last = recent[recent.length - 1];
		const delta = last - first;

		// Compute threshold: 0.5% of range if format provides min/max, else absolute 0.01
		let threshold = 0.01;
		if (property.format && property.format.length >= 2) {
			const min = typeof property.format[0] === 'number' ? property.format[0] : null;
			const max = typeof property.format[1] === 'number' ? property.format[1] : null;
			if (min !== null && max !== null && max > min) {
				threshold = (max - min) * 0.005;
			}
		}

		if (delta > threshold) {
			return 'rising';
		}
		if (delta < -threshold) {
			return 'falling';
		}
		return 'stable';
	}

	/**
	 * Check if a data type is numeric
	 */
	private isNumericDataType(dataType: DataTypeType): boolean {
		return [
			DataTypeType.CHAR,
			DataTypeType.UCHAR,
			DataTypeType.SHORT,
			DataTypeType.USHORT,
			DataTypeType.INT,
			DataTypeType.UINT,
			DataTypeType.FLOAT,
		].includes(dataType);
	}

	/**
	 * Validate value against property format constraints
	 * @returns error message if invalid, null if valid
	 */
	private validateValue(property: ChannelPropertyEntity, value: string | boolean | number): string | null {
		const { dataType, format } = property;

		// No format constraints defined - allow any value
		if (!format || format.length === 0) {
			return null;
		}

		switch (dataType) {
			case DataTypeType.ENUM:
				// For ENUM, format should be string[] of allowed values
				if (format.every((item): item is string => typeof item === 'string')) {
					const stringValue = String(value);
					if (!format.includes(stringValue)) {
						return `Value "${stringValue}" not in allowed values: [${format.join(', ')}]`;
					}
				}
				break;

			case DataTypeType.CHAR:
			case DataTypeType.UCHAR:
			case DataTypeType.SHORT:
			case DataTypeType.USHORT:
			case DataTypeType.INT:
			case DataTypeType.UINT:
			case DataTypeType.FLOAT: {
				// For numeric types, format can be [min, max], [min, null], [null, max], or [min]
				const numValue = Number(value);

				if (isNaN(numValue)) {
					return `Value "${value}" is not a valid number`;
				}

				const min = format.length >= 1 && typeof format[0] === 'number' ? format[0] : null;
				const max = format.length >= 2 && typeof format[1] === 'number' ? format[1] : null;

				if (min !== null && numValue < min) {
					return `Value ${numValue} below minimum ${min}`;
				}

				if (max !== null && numValue > max) {
					return `Value ${numValue} above maximum ${max}`;
				}
				break;
			}

			case DataTypeType.STRING:
			case DataTypeType.BOOL:
				// STRING and BOOL don't have format-based validation
				break;

			default:
				// Unknown data type - skip validation
				break;
		}

		return null;
	}

	/**
	 * Check if value matches the property's invalid/sentinel value
	 * Handles string↔number conversion (e.g., -1 as number vs "-1" as string)
	 */
	private isInvalidValue(invalidValue: string | boolean | number, value: string | boolean | number): boolean {
		// Direct equality check
		if (invalidValue === value) {
			return true;
		}

		// Handle string↔number conversion explicitly
		// Avoid loose equality (==) which has unintended side effects:
		// 0 == false, 1 == true, "" == 0, "1" == true all evaluate to true
		if (typeof invalidValue === 'number' && typeof value === 'string') {
			const numValue = Number(value);
			if (!Number.isNaN(numValue) && invalidValue === numValue) {
				return true;
			}
		}

		if (typeof invalidValue === 'string' && typeof value === 'number') {
			const numInvalid = Number(invalidValue);
			if (!Number.isNaN(numInvalid) && numInvalid === value) {
				return true;
			}
		}

		return false;
	}
}
