import { ZodError } from 'zod';

import { ChannelCategory, DataTypeType, PropertyCategory } from '../../devices/devices.constants';
import { ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { PropertyValueState } from '../../devices/models/property-value-state.model';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import {
	BoundedPropertyValueItem,
	BoundedPropertyValueReadResult,
	PropertyValueService,
} from '../../devices/services/property-value.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType, SpaceZoneCategory } from '../../spaces/spaces.constants';
import { HOME_CURRENT_STATE_PROFILE_BUDDY_V1 } from '../home-context.constants';
import { HomeContextSpaceNotFoundError } from '../home-context.errors';
import { homeCurrentStateQuerySchema } from '../schemas/home-current-state-input.schemas';
import { homeCurrentStateResultSchema } from '../schemas/home-current-state-output.schemas';

import { HomeCurrentStateQueryService } from './home-current-state-query.service';

const profile = HOME_CURRENT_STATE_PROFILE_BUDDY_V1;
const observedAt = '2026-08-15T12:00:00.000Z';

describe('HomeCurrentStateQueryService', () => {
	let spaces: jest.Mocked<Pick<SpacesService, 'findOne' | 'resolveSnapshotScope'>>;
	let properties: jest.Mocked<Pick<ChannelsPropertiesService, 'findVisibleReadableStateCandidates'>>;
	let values: jest.Mocked<Pick<PropertyValueService, 'readLatestManyBounded'>>;
	let service: HomeCurrentStateQueryService;

	beforeEach(() => {
		spaces = {
			findOne: jest.fn().mockResolvedValue(null),
			resolveSnapshotScope: jest.fn(),
		};
		properties = {
			findVisibleReadableStateCandidates: jest.fn().mockResolvedValue({ properties: [], total: 0 }),
		};
		values = {
			readLatestManyBounded: jest.fn().mockResolvedValue(readResult([])),
		};
		service = new HomeCurrentStateQueryService(
			spaces as unknown as SpacesService,
			properties as unknown as ChannelsPropertiesService,
			values as unknown as PropertyValueService,
		);
	});

	it('returns bounded latest-observed rows without requiring a predicate and keeps row truncation complete', async () => {
		const first = propertyFixture('property-a', 21, false);
		const second = propertyFixture('property-b', 22, true);
		const space = { id: 'room-id', type: SpaceType.ROOM } as SpaceEntity;
		spaces.findOne.mockResolvedValue(space);
		spaces.resolveSnapshotScope.mockResolvedValue({ deviceScope: { roomIds: ['room-id'] }, wholeHome: false });
		properties.findVisibleReadableStateCandidates.mockResolvedValue({ properties: [first, second], total: 2 });
		values.readLatestManyBounded.mockResolvedValue(
			readResult([available(first.id, 21, 'cache'), available(second.id, 22, 'storage')]),
		);

		const result = await service.queryCurrentState({
			profile,
			operation: 'rows',
			spaceId: 'room-id',
			channelCategories: [ChannelCategory.TEMPERATURE],
			propertyCategories: [PropertyCategory.TEMPERATURE],
			dataTypes: [DataTypeType.FLOAT],
			limit: 1,
		});

		expect(properties.findVisibleReadableStateCandidates).toHaveBeenCalledWith({
			limit: 500,
			offset: 0,
			scope: { roomIds: ['room-id'] },
			roomParentId: undefined,
			channelCategories: [ChannelCategory.TEMPERATURE],
			propertyCategories: [PropertyCategory.TEMPERATURE],
			dataTypes: [DataTypeType.FLOAT],
		});
		expect(values.readLatestManyBounded).toHaveBeenCalledWith([first, second]);
		expect(result).toEqual(
			expect.objectContaining({
				operation: 'rows',
				predicate: null,
				eligible: 2,
				scanned: 2,
				evaluated: 2,
				unknown: 0,
				matched: 2,
				returned: 1,
				complete: true,
				partial: false,
				partial_reasons: [],
				truncated: true,
				match_count: 2,
			}),
		);
		expect(result.rows).toEqual([
			{
				property_id: 'property-a',
				property_name: 'Temperature property-a',
				property_category: PropertyCategory.TEMPERATURE,
				data_type: DataTypeType.FLOAT,
				unit: '°C',
				value: 21,
				value_observed_at: observedAt,
				freshness: 'known_timestamp',
				source: 'cache',
				device: {
					id: 'device-property-a',
					name: 'Device property-a',
					enabled: false,
					room_id: 'room-id',
				},
				channel: {
					id: 'channel-property-a',
					name: 'Channel property-a',
					category: ChannelCategory.TEMPERATURE,
				},
			},
		]);
		expect(homeCurrentStateResultSchema.parse(result)).toEqual(result);
	});

	it('uses a typed missing-space error before metadata or value reads', async () => {
		await expect(service.queryCurrentState({ profile, operation: 'rows', spaceId: 'missing' })).rejects.toEqual(
			expect.objectContaining({ constructor: HomeContextSpaceNotFoundError, spaceId: 'missing' }),
		);
		expect(properties.findVisibleReadableStateCandidates).not.toHaveBeenCalled();
		expect(values.readLatestManyBounded).not.toHaveBeenCalled();
	});

	it('uses a database-bounded parent-room scope for floor zones', async () => {
		spaces.findOne.mockResolvedValue({
			id: 'floor-id',
			type: SpaceType.ZONE,
			category: SpaceZoneCategory.FLOOR_FIRST,
		} as unknown as SpaceEntity);

		await service.queryCurrentState({ profile, operation: 'rows', spaceId: 'floor-id' });

		expect(spaces.resolveSnapshotScope).not.toHaveBeenCalled();
		expect(properties.findVisibleReadableStateCandidates).toHaveBeenCalledWith(
			expect.objectContaining({ scope: undefined, roomParentId: 'floor-id' }),
		);
	});

	it('marks any=true as conclusive partial when the metadata scan limit leaves unknown candidates', async () => {
		const property = propertyFixture('open-window', true);
		properties.findVisibleReadableStateCandidates.mockResolvedValue({ properties: [property], total: 501 });
		values.readLatestManyBounded.mockResolvedValue(readResult([available(property.id, true, 'cache')]));

		const result = await service.queryCurrentState({
			profile,
			operation: 'any',
			predicate: { operator: 'eq', value: true },
		});

		expect(result).toEqual(
			expect.objectContaining({
				value: true,
				definitive: true,
				status: 'conclusive_partial',
				eligible: 501,
				scanned: 1,
				evaluated: 1,
				unknown: 500,
				partial: true,
				partial_reasons: ['scan_limit'],
			}),
		);
		expect(result.rows.map((row) => row.property_id)).toEqual(['open-window']);
	});

	it('treats equality type and numeric unit mismatches as unknown rather than definitive negatives', async () => {
		const booleanProperty = propertyFixture('boolean', true);
		properties.findVisibleReadableStateCandidates.mockResolvedValue({ properties: [booleanProperty], total: 1 });
		values.readLatestManyBounded.mockResolvedValue(readResult([available(booleanProperty.id, true, 'cache')]));

		await expect(
			service.queryCurrentState({
				profile,
				operation: 'any',
				predicate: { operator: 'eq', value: 'true' },
			}),
		).resolves.toEqual(
			expect.objectContaining({ value: null, status: 'indeterminate', partial_reasons: ['type_mismatch'] }),
		);

		const numericProperty = propertyFixture('numeric', 20);
		properties.findVisibleReadableStateCandidates.mockResolvedValue({ properties: [numericProperty], total: 1 });
		values.readLatestManyBounded.mockResolvedValue(readResult([available(numericProperty.id, 20, 'cache')]));

		await expect(
			service.queryCurrentState({
				profile,
				operation: 'count_matches',
				predicate: { operator: 'gte', value: 10, unit: '°F' },
			}),
		).resolves.toEqual(
			expect.objectContaining({ value: null, status: 'indeterminate', partial_reasons: ['unit_mismatch'] }),
		);
	});

	it('keeps any=false indeterminate when a missing value prevents complete coverage', async () => {
		const known = propertyFixture('closed-window', false);
		const missingProperty = propertyFixture('unknown-window', true);
		properties.findVisibleReadableStateCandidates.mockResolvedValue({ properties: [known, missingProperty], total: 2 });
		values.readLatestManyBounded.mockResolvedValue(
			readResult([available(known.id, false, 'cache'), missing(missingProperty.id)]),
		);

		const result = await service.queryCurrentState({
			profile,
			operation: 'any',
			predicate: { operator: 'eq', value: true },
		});

		expect(result).toEqual(
			expect.objectContaining({
				value: null,
				definitive: false,
				status: 'indeterminate',
				evaluated: 1,
				unknown: 1,
				partial_reasons: ['missing_values'],
			}),
		);
		expect(result.rows).toEqual([]);
	});

	it('marks all=false conclusive when another available value has an incompatible ordered type', async () => {
		const counterexample = propertyFixture('cold', 5);
		const incompatible = propertyFixture('label', 'warm');
		properties.findVisibleReadableStateCandidates.mockResolvedValue({
			properties: [counterexample, incompatible],
			total: 2,
		});
		values.readLatestManyBounded.mockResolvedValue(
			readResult([available(counterexample.id, 5, 'storage'), available(incompatible.id, 'warm', 'storage')]),
		);

		const result = await service.queryCurrentState({
			profile,
			operation: 'all',
			predicate: { operator: 'gt', value: 10, unit: '°C' },
		});

		expect(result).toEqual(
			expect.objectContaining({
				value: false,
				definitive: true,
				status: 'conclusive_partial',
				evaluated: 1,
				unknown: 1,
				partial_reasons: ['type_mismatch'],
			}),
		);
		expect(result.rows.map((row) => row.property_id)).toEqual(['cold']);
	});

	it('returns complete all=true and an exact complete count, but never an incomplete count', async () => {
		const first = propertyFixture('first', 20);
		const second = propertyFixture('second', 10);
		properties.findVisibleReadableStateCandidates.mockResolvedValue({ properties: [first, second], total: 2 });
		values.readLatestManyBounded.mockResolvedValue(
			readResult([available(first.id, 20, 'cache'), available(second.id, 10, 'cache')]),
		);

		await expect(
			service.queryCurrentState({
				profile,
				operation: 'all',
				predicate: { operator: 'gte', value: 10, unit: '°C' },
			}),
		).resolves.toEqual(expect.objectContaining({ value: true, definitive: true, status: 'complete', complete: true }));
		await expect(
			service.queryCurrentState({
				profile,
				operation: 'count_matches',
				predicate: { operator: 'gte', value: 10, unit: '°C' },
			}),
		).resolves.toEqual(expect.objectContaining({ value: 2, definitive: true, status: 'complete' }));

		const missingSecond = readResult([available(first.id, 20, 'cache'), unprocessed(second.id)], {
			storageStatus: 'timed_out',
		});
		values.readLatestManyBounded.mockResolvedValueOnce(missingSecond);

		await expect(
			service.queryCurrentState({
				profile,
				operation: 'count_matches',
				predicate: { operator: 'gte', value: 10, unit: '°C' },
			}),
		).resolves.toEqual(
			expect.objectContaining({
				value: null,
				definitive: false,
				status: 'indeterminate',
				partial_reasons: ['unprocessed_values'],
			}),
		);
	});

	it('reports no eligible values instead of using vacuous truth for all', async () => {
		const result = await service.queryCurrentState({
			profile,
			operation: 'all',
			predicate: { operator: 'eq', value: true },
		});

		expect(result).toEqual(
			expect.objectContaining({
				value: null,
				definitive: false,
				status: 'no_eligible',
				eligible: 0,
				complete: true,
				partial: false,
			}),
		);
	});

	it('does not use a latest value with an unknown observation timestamp for a current claim', async () => {
		const property = propertyFixture('timestamp-unknown', true);
		properties.findVisibleReadableStateCandidates.mockResolvedValue({ properties: [property], total: 1 });
		values.readLatestManyBounded.mockResolvedValue(
			readResult([available(property.id, true, 'cache', null)], { freshnessUnknownCount: 1 }),
		);

		const result = await service.queryCurrentState({
			profile,
			operation: 'any',
			predicate: { operator: 'eq', value: true },
		});

		expect(result).toEqual(
			expect.objectContaining({
				value: null,
				status: 'indeterminate',
				evaluated: 0,
				unknown: 1,
				partial_reasons: ['unknown_freshness'],
				freshness_unknown_count: 1,
			}),
		);
	});

	it('strictly validates row and aggregate query variants', () => {
		expect(homeCurrentStateQuerySchema.parse({ profile, operation: 'rows' })).toEqual({ profile, operation: 'rows' });
		expect(() => homeCurrentStateQuerySchema.parse({ profile, operation: 'any' })).toThrow(ZodError);
		expect(() =>
			homeCurrentStateQuerySchema.parse({
				profile,
				operation: 'all',
				predicate: { operator: 'gt', value: true, unit: '°C' },
			}),
		).toThrow(ZodError);
		expect(() => homeCurrentStateQuerySchema.parse({ profile, operation: 'rows', arbitrary: true })).toThrow(ZodError);
		expect(() =>
			homeCurrentStateQuerySchema.parse({
				profile,
				operation: 'any',
				predicate: { operator: 'eq', value: 'x'.repeat(257) },
			}),
		).toThrow(ZodError);
	});

	it('rejects cross-field inconsistent result metadata', async () => {
		const result = await service.queryCurrentState({ profile, operation: 'rows' });

		expect(() => homeCurrentStateResultSchema.parse({ ...result, returned: 1 })).toThrow(ZodError);
		expect(() => homeCurrentStateResultSchema.parse({ ...result, unknown: 1, complete: true })).toThrow(ZodError);
	});
});

function propertyFixture(id: string, _value: string | number | boolean, enabled = true): ChannelPropertyEntity {
	return {
		id,
		name: `Temperature ${id}`,
		identifier: id,
		category: PropertyCategory.TEMPERATURE,
		dataType: DataTypeType.FLOAT,
		unit: null,
		channel: {
			id: `channel-${id}`,
			name: `Channel ${id}`,
			category: ChannelCategory.TEMPERATURE,
			device: {
				id: `device-${id}`,
				name: `Device ${id}`,
				enabled,
				hidden: false,
				roomId: 'room-id',
			},
		},
	} as unknown as ChannelPropertyEntity;
}

function available(
	propertyId: string,
	value: string | number | boolean,
	source: 'cache' | 'storage',
	lastUpdated: string | null = observedAt,
): BoundedPropertyValueItem {
	return {
		propertyId,
		sourcePropertyId: propertyId,
		status: 'available',
		source,
		state: new PropertyValueState(value, lastUpdated) as PropertyValueState & {
			value: string | number | boolean;
		},
	};
}

function missing(propertyId: string): BoundedPropertyValueItem {
	return { propertyId, sourcePropertyId: propertyId, status: 'missing', source: 'storage', state: null };
}

function unprocessed(propertyId: string): BoundedPropertyValueItem {
	return { propertyId, sourcePropertyId: propertyId, status: 'unprocessed', source: null, state: null };
}

function readResult(
	items: BoundedPropertyValueItem[],
	overrides: Partial<BoundedPropertyValueReadResult> = {},
): BoundedPropertyValueReadResult {
	const availableItems = items.filter((item) => item.status === 'available');
	const missingCount = items.filter((item) => item.status === 'missing').length;
	const unprocessedCount = items.filter((item) => item.status === 'unprocessed').length;
	const timestamps = availableItems
		.map((item) => item.state.lastUpdated)
		.filter((timestamp): timestamp is string => timestamp !== null && !Number.isNaN(Date.parse(timestamp)))
		.sort();

	return {
		items,
		requestedCount: items.length,
		availableCount: availableItems.length,
		unknownCount: missingCount + unprocessedCount,
		complete: missingCount + unprocessedCount === 0,
		storageStatus: 'not_needed',
		cacheCount: items.filter((item) => item.source === 'cache').length,
		storageCount: items.filter((item) => item.source === 'storage').length,
		missingCount,
		unprocessedCount,
		oldestLastUpdated: timestamps[0] ?? null,
		newestLastUpdated: timestamps[timestamps.length - 1] ?? null,
		freshnessUnknownCount: availableItems.filter(
			(item) => item.state.lastUpdated === null || Number.isNaN(Date.parse(item.state.lastUpdated)),
		).length,
		...overrides,
	};
}
