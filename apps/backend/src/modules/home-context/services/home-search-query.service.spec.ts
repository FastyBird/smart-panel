/* eslint-disable @typescript-eslint/unbound-method */
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../devices/devices.constants';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { DevicesService } from '../../devices/services/devices.service';
import { SceneCategory } from '../../scenes/scenes.constants';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType, SpaceZoneCategory } from '../../spaces/spaces.constants';
import { HOME_SEARCH_PROFILE_BUDDY_V1 } from '../home-context.constants';
import { HomeContextSpaceNotFoundError } from '../home-context.errors';
import { HomeSearchInvalidCursorError } from '../home-search.errors';
import { HomeEntitySearchQuery } from '../models/home-search-query.model';
import { homeEntitySearchQuerySchema } from '../schemas/home-search-input.schemas';
import { homeEntitySearchResponseSchema } from '../schemas/home-search-output.schemas';

import { HomeSearchQueryService } from './home-search-query.service';

describe('HomeSearchQueryService', () => {
	let spacesService: jest.Mocked<SpacesService>;
	let devicesService: jest.Mocked<DevicesService>;
	let channelsPropertiesService: jest.Mocked<ChannelsPropertiesService>;
	let scenesService: jest.Mocked<ScenesService>;
	let service: HomeSearchQueryService;

	beforeEach(() => {
		spacesService = {
			findOne: jest.fn().mockResolvedValue(null),
			searchSummaryPage: jest.fn().mockResolvedValue({ spaces: [], total: 0 }),
		} as unknown as jest.Mocked<SpacesService>;
		devicesService = {
			searchVisibleSummaryPage: jest.fn().mockResolvedValue({ devices: [], total: 0 }),
		} as unknown as jest.Mocked<DevicesService>;
		channelsPropertiesService = {
			searchVisibleSummaryPage: jest.fn().mockResolvedValue({ properties: [], total: 0 }),
		} as unknown as jest.Mocked<ChannelsPropertiesService>;
		scenesService = {
			searchSummaryPage: jest.fn().mockResolvedValue({ scenes: [], total: 0 }),
		} as unknown as jest.Mocked<ScenesService>;
		service = new HomeSearchQueryService(spacesService, devicesService, channelsPropertiesService, scenesService);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('searches selected metadata domains in parallel and returns stable cross-kind ranking', async () => {
		jest.useFakeTimers().setSystemTime(new Date('2026-08-15T10:00:00.000Z'));
		spacesService.searchSummaryPage.mockResolvedValue({
			spaces: [
				{
					id: 'space-1',
					name: 'Küche',
					type: SpaceType.ROOM,
					category: null,
					parentId: null,
					rankTier: 1,
					lexicalScore: -4,
				},
			],
			total: 1,
		});
		devicesService.searchVisibleSummaryPage.mockResolvedValue({
			devices: [
				{
					id: 'device-1',
					name: 'Küche ceiling',
					identifier: 'kitchen-ceiling',
					category: DeviceCategory.LIGHTING,
					enabled: false,
					roomId: 'space-1',
					rankTier: 2,
					lexicalScore: -8,
				},
			],
			total: 2,
		});
		channelsPropertiesService.searchVisibleSummaryPage.mockResolvedValue({
			properties: [
				{
					id: 'property-1',
					name: null,
					identifier: 'kuche-switch',
					category: PropertyCategory.ON,
					dataType: DataTypeType.BOOL,
					permissions: [PermissionType.READ_WRITE],
					channelId: 'channel-1',
					channelName: 'Main light',
					channelCategory: ChannelCategory.LIGHT,
					deviceId: 'device-1',
					deviceName: 'Küche ceiling',
					deviceCategory: DeviceCategory.LIGHTING,
					deviceEnabled: false,
					roomId: 'space-1',
					rankTier: 2,
					lexicalScore: -2,
				},
			],
			total: 1,
		});
		scenesService.searchSummaryPage.mockResolvedValue({
			scenes: [
				{
					id: 'scene-1',
					name: 'Evening Küche',
					category: SceneCategory.LIGHTING,
					enabled: false,
					triggerable: false,
					primarySpaceId: 'space-1',
					rankTier: 3,
					lexicalScore: -3,
				},
			],
			total: 1,
		});

		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: '  Kuche  ',
		});

		expect(spacesService.searchSummaryPage).toHaveBeenCalledWith({
			match: '"kuche"*',
			rawQuery: 'Kuche',
			normalizedQuery: 'kuche',
			normalizedTokens: ['kuche'],
			offset: 0,
			limit: 100,
			spaceIds: undefined,
			parentSpaceId: undefined,
			categories: undefined,
		});
		expect(devicesService.searchVisibleSummaryPage).toHaveBeenCalledWith({
			match: '"kuche"*',
			rawQuery: 'Kuche',
			normalizedQuery: 'kuche',
			normalizedTokens: ['kuche'],
			offset: 0,
			limit: 100,
			scope: undefined,
			roomParentId: undefined,
			categories: undefined,
		});
		expect(result).toEqual({
			query: 'Kuche',
			entities: [
				{
					kind: 'space',
					id: 'space-1',
					name: 'Küche',
					score: 900,
					reasons: ['exact_name'],
					type: SpaceType.ROOM,
					category: null,
					parent_id: null,
					candidate_capabilities: [],
				},
				{
					kind: 'device',
					id: 'device-1',
					name: 'Küche ceiling',
					score: 800,
					reasons: ['name_prefix'],
					identifier: 'kitchen-ceiling',
					category: DeviceCategory.LIGHTING,
					enabled: false,
					room_id: 'space-1',
					candidate_capabilities: [],
				},
				{
					kind: 'property',
					id: 'property-1',
					name: 'kuche-switch',
					score: 800,
					reasons: ['name_prefix'],
					property_name: null,
					identifier: 'kuche-switch',
					category: PropertyCategory.ON,
					data_type: DataTypeType.BOOL,
					permissions: [PermissionType.READ_WRITE],
					device: { id: 'device-1', name: 'Küche ceiling', enabled: false },
					channel: { id: 'channel-1', name: 'Main light', category: ChannelCategory.LIGHT },
					candidate_capabilities: ['read'],
				},
				{
					kind: 'scene',
					id: 'scene-1',
					name: 'Evening Küche',
					score: 600,
					reasons: ['lexical_match'],
					category: SceneCategory.LIGHTING,
					enabled: false,
					triggerable: false,
					primary_space_id: 'space-1',
					candidate_capabilities: [],
				},
			],
			observed_at: '2026-08-15T10:00:00.000Z',
			total: 5,
			returned: 4,
			totals_by_kind: { space: 1, device: 2, property: 1, scene: 1 },
			partial: false,
			truncated: true,
			refine_required: true,
		});
		expect(homeEntitySearchResponseSchema.safeParse(result).success).toBe(true);
	});

	it('resolves an explicit space once and applies scope and category filters before limits', async () => {
		const selectedSpace = {
			id: 'zone-1',
			name: 'Floor',
			type: SpaceType.ZONE,
			category: SpaceZoneCategory.FLOOR_FIRST,
		};
		spacesService.findOne.mockResolvedValue(selectedSpace as never);

		await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'light',
			kinds: ['space', 'device', 'property', 'scene'],
			spaceId: ' zone-1 ',
			categories: [' lighting ', 'on', 'not-a-domain-category'],
			limit: 5,
		});

		expect(spacesService.findOne).toHaveBeenCalledWith('zone-1');
		expect(spacesService.searchSummaryPage).toHaveBeenCalledWith(
			expect.objectContaining({
				spaceIds: ['zone-1'],
				parentSpaceId: 'zone-1',
				categories: ['lighting', 'on', 'not-a-domain-category'],
			}),
		);
		expect(devicesService.searchVisibleSummaryPage).toHaveBeenCalledWith(
			expect.objectContaining({
				scope: undefined,
				roomParentId: 'zone-1',
				categories: ['lighting', 'on', 'not-a-domain-category'],
			}),
		);
		expect(channelsPropertiesService.searchVisibleSummaryPage).toHaveBeenCalledWith(
			expect.objectContaining({
				scope: undefined,
				roomParentId: 'zone-1',
				categories: [PropertyCategory.ON],
			}),
		);
		expect(scenesService.searchSummaryPage).toHaveBeenCalledWith(
			expect.objectContaining({
				primarySpaceId: 'zone-1',
				primarySpaceParentId: 'zone-1',
				categories: [SceneCategory.LIGHTING],
			}),
		);
	});

	it('returns at most the requested hard-bounded number and reports exact totals', async () => {
		devicesService.searchVisibleSummaryPage.mockResolvedValue({
			devices: Array.from({ length: 21 }, (_, index) => ({
				id: `device-${String(index).padStart(2, '0')}`,
				name: `Sensor ${String(index).padStart(2, '0')}`,
				identifier: null,
				category: DeviceCategory.SENSOR,
				enabled: true,
				roomId: null,
				rankTier: 2,
				lexicalScore: index,
			})),
			total: 1_001,
		});

		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'sensor',
			kinds: ['device'],
			limit: 20,
		});

		expect(result.entities).toHaveLength(20);
		expect(result.total).toBe(1_001);
		expect(result.returned).toBe(20);
		expect(result.truncated).toBe(true);
		expect(result.refine_required).toBe(false);
		expect(result.next_cursor).toBeDefined();
		expect(devicesService.searchVisibleSummaryPage).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
		expect(spacesService.searchSummaryPage).not.toHaveBeenCalled();
		expect(channelsPropertiesService.searchVisibleSummaryPage).not.toHaveBeenCalled();
		expect(scenesService.searchSummaryPage).not.toHaveBeenCalled();
	});

	it('paginates the fixed cross-kind candidate window without changing domain offsets', async () => {
		spacesService.searchSummaryPage.mockResolvedValue({
			spaces: Array.from({ length: 3 }, (_, index) => ({
				id: `space-${index}`,
				name: `Light ${index}`,
				type: SpaceType.ROOM,
				category: null,
				parentId: null,
				rankTier: 2,
				lexicalScore: index,
			})),
			total: 3,
		});
		devicesService.searchVisibleSummaryPage.mockResolvedValue({
			devices: Array.from({ length: 3 }, (_, index) => ({
				id: `device-${index}`,
				name: `Light ${index}`,
				identifier: null,
				category: DeviceCategory.LIGHTING,
				enabled: true,
				roomId: null,
				rankTier: 2,
				lexicalScore: index + 0.5,
			})),
			total: 3,
		});

		const firstPage = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'light',
			kinds: ['space', 'device'],
			categories: ['lighting', 'sensor'],
			limit: 2,
		});
		const secondPage = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'light',
			kinds: ['device', 'space'],
			categories: ['sensor', 'lighting'],
			limit: 3,
			cursor: firstPage.next_cursor,
		});
		const thirdPage = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'light',
			kinds: ['space', 'device'],
			categories: ['lighting', 'sensor'],
			limit: 3,
			cursor: secondPage.next_cursor,
		});

		expect([
			...firstPage.entities.map(({ id }) => id),
			...secondPage.entities.map(({ id }) => id),
			...thirdPage.entities.map(({ id }) => id),
		]).toEqual(['space-0', 'device-0', 'space-1', 'device-1', 'space-2', 'device-2']);
		expect(
			new Set([...firstPage.entities, ...secondPage.entities, ...thirdPage.entities].map(({ id }) => id)).size,
		).toBe(6);
		expect(firstPage).toMatchObject({ returned: 2, truncated: true, refine_required: false });
		expect(secondPage).toMatchObject({ returned: 3, truncated: true, refine_required: false });
		expect(thirdPage).toMatchObject({ returned: 1, truncated: false, refine_required: false });
		expect(thirdPage.next_cursor).toBeUndefined();
		expect(spacesService.searchSummaryPage).toHaveBeenCalledTimes(3);
		expect(devicesService.searchVisibleSummaryPage).toHaveBeenCalledTimes(3);
		for (const [searchInput] of spacesService.searchSummaryPage.mock.calls) {
			expect(searchInput).toEqual(expect.objectContaining({ offset: 0, limit: 100 }));
		}
		for (const [searchInput] of devicesService.searchVisibleSummaryPage.mock.calls) {
			expect(searchInput).toEqual(expect.objectContaining({ offset: 0, limit: 100 }));
		}
	});

	it('stops at the fixed 100-result paging ceiling and requires query refinement', async () => {
		devicesService.searchVisibleSummaryPage.mockResolvedValue({
			devices: Array.from({ length: 100 }, (_, index) => ({
				id: `device-${String(index).padStart(3, '0')}`,
				name: `Sensor ${String(index).padStart(3, '0')}`,
				identifier: null,
				category: DeviceCategory.SENSOR,
				enabled: true,
				roomId: null,
				rankTier: 2,
				lexicalScore: index,
			})),
			total: 1_001,
		});
		let cursor: string | undefined;
		let lastPage: Awaited<ReturnType<HomeSearchQueryService['searchEntities']>> | undefined;

		for (let page = 0; page < 5; page += 1) {
			lastPage = await service.searchEntities({
				profile: HOME_SEARCH_PROFILE_BUDDY_V1,
				query: 'sensor',
				kinds: ['device'],
				limit: 20,
				cursor,
			});
			cursor = lastPage.next_cursor;
		}

		expect(lastPage).toMatchObject({
			total: 1_001,
			returned: 20,
			truncated: true,
			refine_required: true,
		});
		expect(lastPage?.next_cursor).toBeUndefined();
		expect(devicesService.searchVisibleSummaryPage).toHaveBeenCalledTimes(5);
	});

	it.each([
		['read', 'property'],
		['write', 'property'],
		['trigger', 'scene'],
	] as const)('routes the %s candidate filter only to compatible %s metadata', async (candidateCapability, kind) => {
		channelsPropertiesService.searchVisibleSummaryPage.mockResolvedValue({
			properties: [
				{
					id: 'property-1',
					name: 'Switch',
					identifier: null,
					category: PropertyCategory.ON,
					dataType: DataTypeType.BOOL,
					permissions: [PermissionType.READ_WRITE],
					channelId: 'channel-1',
					channelName: 'Light',
					channelCategory: ChannelCategory.LIGHT,
					deviceId: 'device-1',
					deviceName: 'Lamp',
					deviceCategory: DeviceCategory.LIGHTING,
					deviceEnabled: true,
					roomId: null,
					rankTier: 1,
					lexicalScore: -1,
				},
			],
			total: 1,
		});
		scenesService.searchSummaryPage.mockResolvedValue({
			scenes: [
				{
					id: 'scene-1',
					name: 'Evening',
					category: SceneCategory.LIGHTING,
					enabled: true,
					triggerable: true,
					primarySpaceId: null,
					rankTier: 1,
					lexicalScore: -1,
				},
			],
			total: 1,
		});

		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'light',
			candidateCapability,
		});

		expect(result.entities).toHaveLength(1);
		expect(result.entities[0]).toMatchObject({
			kind,
			candidate_capabilities: candidateCapability === 'trigger' ? ['trigger'] : ['read', 'write'],
		});
		expect(result.entities[0]?.reasons).toContain('candidate_capability_filter');
		expect(result.candidate_capability_filter).toBe(candidateCapability);
		expect(spacesService.searchSummaryPage).not.toHaveBeenCalled();
		expect(devicesService.searchVisibleSummaryPage).not.toHaveBeenCalled();
		if (kind === 'property') {
			expect(channelsPropertiesService.searchVisibleSummaryPage).toHaveBeenCalledWith(
				expect.objectContaining({ candidateCapability }),
			);
			expect(scenesService.searchSummaryPage).not.toHaveBeenCalled();
		} else {
			expect(scenesService.searchSummaryPage).toHaveBeenCalledWith(expect.objectContaining({ candidateTrigger: true }));
			expect(channelsPropertiesService.searchVisibleSummaryPage).not.toHaveBeenCalled();
		}
	});

	it('returns an exact empty result when requested kinds cannot satisfy the candidate capability', async () => {
		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'light',
			kinds: ['device'],
			candidateCapability: 'write',
		});

		expect(result).toMatchObject({
			entities: [],
			total: 0,
			returned: 0,
			truncated: false,
			refine_required: false,
			candidate_capability_filter: 'write',
		});
		expect(spacesService.searchSummaryPage).not.toHaveBeenCalled();
		expect(devicesService.searchVisibleSummaryPage).not.toHaveBeenCalled();
		expect(channelsPropertiesService.searchVisibleSummaryPage).not.toHaveBeenCalled();
		expect(scenesService.searchSummaryPage).not.toHaveBeenCalled();
	});

	it('treats cursor offsets as untrusted bounded state and rejects malformed or mismatched cursors', async () => {
		devicesService.searchVisibleSummaryPage.mockResolvedValue({
			devices: Array.from({ length: 3 }, (_, index) => ({
				id: `device-${index}`,
				name: `Light ${index}`,
				identifier: null,
				category: DeviceCategory.LIGHTING,
				enabled: true,
				roomId: null,
				rankTier: 2,
				lexicalScore: index,
			})),
			total: 3,
		});
		const firstPage = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'light',
			kinds: ['device'],
			limit: 1,
		});
		const decoded: unknown = JSON.parse(Buffer.from(firstPage.next_cursor, 'base64url').toString('utf8'));

		if (
			typeof decoded !== 'object' ||
			decoded === null ||
			!('fingerprint' in decoded) ||
			typeof decoded.fingerprint !== 'string'
		) {
			throw new Error('Expected an encoded search cursor');
		}

		const randomAccessCursor = Buffer.from(
			JSON.stringify({ v: 1, fingerprint: decoded.fingerprint, offset: 2 }),
			'utf8',
		).toString('base64url');
		const randomAccessPage = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'light',
			kinds: ['device'],
			cursor: randomAccessCursor,
		});

		expect(randomAccessPage.entities.map(({ id }) => id)).toEqual(['device-2']);
		jest.clearAllMocks();

		await expect(
			service.searchEntities({
				profile: HOME_SEARCH_PROFILE_BUDDY_V1,
				query: 'different',
				kinds: ['device'],
				cursor: firstPage.next_cursor,
			}),
		).rejects.toMatchObject({ reason: 'query_mismatch' });
		const changedFilterCases: Array<Partial<HomeEntitySearchQuery>> = [
			{ kinds: ['scene'] },
			{ kinds: ['device'], categories: ['lighting'] },
			{ kinds: ['device'], spaceId: 'space-1' },
			{ kinds: ['device'], candidateCapability: 'read' },
		];

		for (const changedFilters of changedFilterCases) {
			await expect(
				service.searchEntities({
					profile: HOME_SEARCH_PROFILE_BUDDY_V1,
					query: 'light',
					...changedFilters,
					cursor: firstPage.next_cursor,
				}),
			).rejects.toMatchObject({ reason: 'query_mismatch' });
		}
		await expect(
			service.searchEntities({
				profile: HOME_SEARCH_PROFILE_BUDDY_V1,
				query: 'light',
				kinds: ['device'],
				cursor: 'not+a+cursor',
			}),
		).rejects.toBeInstanceOf(HomeSearchInvalidCursorError);
		const outOfRangeCursor = Buffer.from(
			JSON.stringify({ v: 1, fingerprint: decoded.fingerprint, offset: 100 }),
			'utf8',
		).toString('base64url');
		await expect(
			service.searchEntities({
				profile: HOME_SEARCH_PROFILE_BUDDY_V1,
				query: 'light',
				kinds: ['device'],
				cursor: outOfRangeCursor,
			}),
		).rejects.toMatchObject({ reason: 'offset_out_of_range' });
		for (const malformedPayload of [
			{ v: 2, fingerprint: decoded.fingerprint, offset: 1 },
			{ v: 1, fingerprint: decoded.fingerprint, offset: -1 },
			{ v: 1, fingerprint: decoded.fingerprint, offset: 1.5 },
			{ v: 1, fingerprint: decoded.fingerprint, offset: 1, extra: true },
		]) {
			const malformedCursor = Buffer.from(JSON.stringify(malformedPayload), 'utf8').toString('base64url');

			await expect(
				service.searchEntities({
					profile: HOME_SEARCH_PROFILE_BUDDY_V1,
					query: 'light',
					kinds: ['device'],
					cursor: malformedCursor,
				}),
			).rejects.toMatchObject({ reason: 'malformed' });
		}
		expect(devicesService.searchVisibleSummaryPage).not.toHaveBeenCalled();
		expect(spacesService.findOne).not.toHaveBeenCalled();
	});

	it('rejects a missing explicit space before searching any catalog', async () => {
		await expect(
			service.searchEntities({
				profile: HOME_SEARCH_PROFILE_BUDDY_V1,
				query: 'light',
				spaceId: 'missing-space',
			}),
		).rejects.toBeInstanceOf(HomeContextSpaceNotFoundError);
		expect(spacesService.searchSummaryPage).not.toHaveBeenCalled();
		expect(devicesService.searchVisibleSummaryPage).not.toHaveBeenCalled();
		expect(channelsPropertiesService.searchVisibleSummaryPage).not.toHaveBeenCalled();
		expect(scenesService.searchSummaryPage).not.toHaveBeenCalled();
	});

	it.each([
		['punctuation-only text', '---', 'no_search_tokens'],
		['more than eight tokens', 'one two three four five six seven eight nine', 'too_many_tokens'],
	] as const)('rejects %s without querying domains', async (_label, query, reason) => {
		await expect(service.searchEntities({ profile: HOME_SEARCH_PROFILE_BUDDY_V1, query })).rejects.toMatchObject({
			reason,
		});
		expect(spacesService.searchSummaryPage).not.toHaveBeenCalled();
		expect(devicesService.searchVisibleSummaryPage).not.toHaveBeenCalled();
	});

	it('enforces closed profiles, unique filters, and hard input limits', () => {
		expect(homeEntitySearchQuerySchema.safeParse({ profile: 'mcp-compatibility', query: 'light' }).success).toBe(false);
		expect(
			homeEntitySearchQuerySchema.safeParse({
				profile: HOME_SEARCH_PROFILE_BUDDY_V1,
				query: 'light',
				kinds: ['device', 'device'],
			}).success,
		).toBe(false);
		expect(
			homeEntitySearchQuerySchema.safeParse({
				profile: HOME_SEARCH_PROFILE_BUDDY_V1,
				query: 'light',
				limit: 21,
			}).success,
		).toBe(false);
		expect(
			homeEntitySearchQuerySchema.safeParse({
				profile: HOME_SEARCH_PROFILE_BUDDY_V1,
				query: 'light',
				candidateCapability: 'execute',
			}).success,
		).toBe(false);
		expect(
			homeEntitySearchQuerySchema.safeParse({
				profile: HOME_SEARCH_PROFILE_BUDDY_V1,
				query: 'light',
				cursor: '',
			}).success,
		).toBe(false);
	});
});
