import { DataSource } from 'typeorm';

import { AddHomeEntitySearchIndex1000000000020 } from '../../../migrations/1000000000020-AddHomeEntitySearchIndex';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { DevicesService } from '../../devices/services/devices.service';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SpaceSearchSummaryInput, SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType, SpaceZoneCategory } from '../../spaces/spaces.constants';
import { HOME_SEARCH_PROFILE_BUDDY_V1 } from '../home-context.constants';

import { HomeSearchQueryService } from './home-search-query.service';

describe('HomeSearchQueryService SQLite integration', () => {
	let dataSource: DataSource;

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		await dataSource.query(
			`CREATE TABLE spaces_module_spaces (
				id varchar PRIMARY KEY, name varchar NOT NULL, type varchar, category varchar, "parentId" varchar
			)`,
		);
		await dataSource.query(
			`CREATE TABLE devices_module_devices (
				id varchar PRIMARY KEY, name varchar NOT NULL, identifier varchar, type varchar, category varchar,
				enabled boolean NOT NULL, hidden boolean NOT NULL, "roomId" varchar
			)`,
		);
		await dataSource.query(
			`CREATE TABLE devices_module_channels_properties (
				id varchar PRIMARY KEY, name varchar, identifier varchar, type varchar, category varchar,
				"dataType" varchar, permissions text, "channelId" varchar
			)`,
		);
		await dataSource.query(
			`CREATE TABLE devices_module_channels (
				id varchar PRIMARY KEY, name varchar NOT NULL, category varchar, "deviceId" varchar
			)`,
		);
		await dataSource.query(
			`CREATE TABLE devices_module_devices_zones ("deviceId" varchar NOT NULL, "zoneId" varchar NOT NULL)`,
		);
		await dataSource.query(
			`CREATE TABLE scenes_module_scenes (
				id varchar PRIMARY KEY, name varchar NOT NULL, category varchar, enabled boolean NOT NULL,
				triggerable boolean NOT NULL, "primarySpaceId" varchar
			)`,
		);
		await new AddHomeEntitySearchIndex1000000000020().up(dataSource.createQueryRunner());
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	it('finds a disabled visible target beyond the first 100 alphabetical devices without leaking its hidden twin', async () => {
		for (let index = 0; index < 101; index += 1) {
			await dataSource.query(
				`INSERT INTO devices_module_devices
				 (id, name, identifier, type, category, enabled, hidden, "roomId")
				 VALUES (?, ?, ?, 'test', 'sensor', 1, 0, NULL)`,
				[`device-${index}`, `Alpha device ${String(index).padStart(3, '0')}`, `alpha-${index}`],
			);
		}
		await dataSource.query(
			`INSERT INTO devices_module_devices
			 (id, name, identifier, type, category, enabled, hidden, "roomId")
			 VALUES
			 ('target-visible', 'Zeta Target Sensor', 'zeta-target', 'test', 'sensor', 0, 0, NULL),
			 ('target-hidden', 'Zeta Target Sensor Hidden', 'zeta-target-hidden', 'test', 'sensor', 1, 1, NULL)`,
		);

		const devicesService = Object.create(DevicesService.prototype) as DevicesService;
		Object.defineProperty(devicesService, 'dataSource', { value: dataSource });
		const spacesService = {
			findOne: jest.fn(),
			resolveSnapshotScope: jest.fn(),
			searchSummaryPage: jest.fn(),
		} as unknown as SpacesService;
		const propertiesService = { searchVisibleSummaryPage: jest.fn() } as unknown as ChannelsPropertiesService;
		const scenesService = { searchSummaryPage: jest.fn() } as unknown as ScenesService;
		const service = new HomeSearchQueryService(spacesService, devicesService, propertiesService, scenesService);

		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'target',
			kinds: ['device'],
		});

		expect(result.entities).toEqual([
			expect.objectContaining({
				kind: 'device',
				id: 'target-visible',
				name: 'Zeta Target Sensor',
				enabled: false,
			}),
		]);
		expect(result.total).toBe(1);
		expect(result.returned).toBe(1);
		expect(result.truncated).toBe(false);
	});

	it('keeps a diacritic-normalized exact name ahead of more than 100 competing matches before the hard cap', async () => {
		for (let index = 0; index < 110; index += 1) {
			await dataSource.query(
				`INSERT INTO devices_module_devices
				 (id, name, identifier, type, category, enabled, hidden, "roomId")
				 VALUES (?, ?, ?, 'test', 'sensor', 1, 0, NULL)`,
				[`competitor-${index}`, `Kuche competitor ${index} kuche kuche`, `kuche-competitor-${index}`],
			);
		}
		await dataSource.query(
			`INSERT INTO devices_module_devices
			 (id, name, identifier, type, category, enabled, hidden, "roomId")
			 VALUES ('exact-kitchen', 'Küche', 'exact-kitchen', 'test', 'sensor', 0, 0, NULL)`,
		);

		const devicesService = Object.create(DevicesService.prototype) as DevicesService;
		Object.defineProperty(devicesService, 'dataSource', { value: dataSource });
		const service = new HomeSearchQueryService(
			{ findOne: jest.fn(), searchSummaryPage: jest.fn() } as unknown as SpacesService,
			devicesService,
			{ searchVisibleSummaryPage: jest.fn() } as unknown as ChannelsPropertiesService,
			{ searchSummaryPage: jest.fn() } as unknown as ScenesService,
		);

		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'Kuche',
			kinds: ['device'],
			limit: 20,
		});

		expect(result.entities).toHaveLength(20);
		expect(result.entities[0]).toMatchObject({
			id: 'exact-kitchen',
			name: 'Küche',
			score: 900,
			reasons: ['exact_name'],
			enabled: false,
		});
		expect(result.total).toBe(111);
		expect(result.truncated).toBe(true);
	});

	it('preserves compatibility characters so query tokens match the SQLite tokenizer', async () => {
		await dataSource.query(
			`INSERT INTO devices_module_devices
			 (id, name, identifier, type, category, enabled, hidden, "roomId")
			 VALUES ('ligature-floor', 'ﬂoor', 'ligature-floor', 'test', 'sensor', 1, 0, NULL)`,
		);

		const devicesService = Object.create(DevicesService.prototype) as DevicesService;
		Object.defineProperty(devicesService, 'dataSource', { value: dataSource });
		const service = new HomeSearchQueryService(
			{ findOne: jest.fn(), searchSummaryPage: jest.fn() } as unknown as SpacesService,
			devicesService,
			{ searchVisibleSummaryPage: jest.fn() } as unknown as ChannelsPropertiesService,
			{ searchSummaryPage: jest.fn() } as unknown as ScenesService,
		);

		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'ﬂoor',
			kinds: ['device'],
		});

		expect(result.entities).toEqual([
			expect.objectContaining({
				id: 'ligature-floor',
				name: 'ﬂoor',
				score: 900,
				reasons: ['exact_name'],
			}),
		]);
	});

	it('folds Greek final sigma like unicode61 before applying the candidate cap', async () => {
		for (let index = 0; index < 110; index += 1) {
			await dataSource.query(
				`INSERT INTO devices_module_devices
				 (id, name, identifier, type, category, enabled, hidden, "roomId")
				 VALUES (?, ?, ?, 'test', 'sensor', 1, 0, NULL)`,
				[`greek-competitor-${index}`, `ΟΣ competitor ${index} ΟΣ ΟΣ`, `greek-competitor-${index}`],
			);
		}
		await dataSource.query(
			`INSERT INTO devices_module_devices
			 (id, name, identifier, type, category, enabled, hidden, "roomId")
			 VALUES ('greek-exact', 'ΟΣ', 'greek-exact', 'test', 'sensor', 1, 0, NULL)`,
		);

		const devicesService = Object.create(DevicesService.prototype) as DevicesService;
		Object.defineProperty(devicesService, 'dataSource', { value: dataSource });
		const service = new HomeSearchQueryService(
			{ findOne: jest.fn(), searchSummaryPage: jest.fn() } as unknown as SpacesService,
			devicesService,
			{ searchVisibleSummaryPage: jest.fn() } as unknown as ChannelsPropertiesService,
			{ searchSummaryPage: jest.fn() } as unknown as ScenesService,
		);

		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'ΟΣ',
			kinds: ['device'],
			limit: 20,
		});

		expect(result.entities[0]).toMatchObject({
			id: 'greek-exact',
			name: 'ΟΣ',
			score: 900,
			reasons: ['exact_name'],
		});
		expect(result.total).toBe(111);
		expect(result.truncated).toBe(true);
	});

	it('keeps an unnamed property with an exact identifier ahead of the per-kind candidate cap', async () => {
		await dataSource.query(
			`INSERT INTO devices_module_devices
			 (id, name, identifier, type, category, enabled, hidden, "roomId")
			 VALUES ('property-owner', 'Target owner', 'property-owner', 'test', 'sensor', 1, 0, NULL)`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_channels (id, name, category, "deviceId")
			 VALUES ('property-channel', 'Target channel', 'generic', 'property-owner')`,
		);
		for (let index = 0; index < 110; index += 1) {
			await dataSource.query(
				`INSERT INTO devices_module_channels_properties
				 (id, name, identifier, type, category, "dataType", permissions, "channelId")
				 VALUES (?, ?, ?, 'test', 'generic', 'string', 'ro', 'property-channel')`,
				[
					`property-competitor-${index}`,
					`Target identifier competitor ${index} target identifier`,
					`competitor-${index}`,
				],
			);
		}
		await dataSource.query(
			`INSERT INTO devices_module_channels_properties
			 (id, name, identifier, type, category, "dataType", permissions, "channelId")
			 VALUES ('property-exact', NULL, 'target-identifier', 'test', 'generic', 'string', 'ro',
			         'property-channel')`,
		);

		const propertiesService = Object.create(ChannelsPropertiesService.prototype) as ChannelsPropertiesService;
		Object.defineProperty(propertiesService, 'dataSource', { value: dataSource });
		const service = new HomeSearchQueryService(
			{ findOne: jest.fn(), searchSummaryPage: jest.fn() } as unknown as SpacesService,
			{ searchVisibleSummaryPage: jest.fn() } as unknown as DevicesService,
			propertiesService,
			{ searchSummaryPage: jest.fn() } as unknown as ScenesService,
		);

		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'target-identifier',
			kinds: ['property'],
			limit: 20,
		});

		expect(result.entities).toHaveLength(20);
		expect(result.entities[0]).toMatchObject({
			kind: 'property',
			id: 'property-exact',
			name: 'target-identifier',
			score: 900,
			reasons: ['exact_name'],
		});
		expect(result.total).toBe(111);
		expect(result.truncated).toBe(true);
	});

	it('does not rank an identifier as the display name when a symbol-only property name is non-null', async () => {
		await dataSource.query(
			`INSERT INTO devices_module_devices
			 (id, name, identifier, type, category, enabled, hidden, "roomId")
			 VALUES ('symbol-owner', 'Symbol owner', 'symbol-owner', 'test', 'sensor', 1, 0, NULL)`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_channels (id, name, category, "deviceId")
			 VALUES ('symbol-channel', 'Symbol channel', 'generic', 'symbol-owner')`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_channels_properties
			 (id, name, identifier, type, category, "dataType", permissions, "channelId") VALUES
			 ('genuine-display-name', 'Symbol fallback', 'genuine', 'test', 'generic', 'string', 'ro', 'symbol-channel'),
			 ('symbol-only-name', '---', 'symbol-fallback', 'test', 'generic', 'string', 'ro', 'symbol-channel')`,
		);

		const propertiesService = Object.create(ChannelsPropertiesService.prototype) as ChannelsPropertiesService;
		Object.defineProperty(propertiesService, 'dataSource', { value: dataSource });
		const service = new HomeSearchQueryService(
			{ findOne: jest.fn(), searchSummaryPage: jest.fn() } as unknown as SpacesService,
			{ searchVisibleSummaryPage: jest.fn() } as unknown as DevicesService,
			propertiesService,
			{ searchSummaryPage: jest.fn() } as unknown as ScenesService,
		);

		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'symbol-fallback',
			kinds: ['property'],
		});

		expect(result.entities.map((entity) => ({ id: entity.id, name: entity.name, score: entity.score }))).toEqual([
			{ id: 'genuine-display-name', name: 'Symbol fallback', score: 900 },
			{ id: 'symbol-only-name', name: '---', score: 600 },
		]);
	});

	it('executes all four owning-domain queries against the real FTS index and joined metadata', async () => {
		await dataSource.query(
			`INSERT INTO spaces_module_spaces (id, name, type, category, "parentId")
			 VALUES ('space-kitchen', 'Kitchen', 'room', NULL, NULL)`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_devices
			 (id, name, identifier, type, category, enabled, hidden, "roomId")
			 VALUES ('device-light', 'Kitchen light', 'kitchen-light', 'test', 'lighting', 1, 0, 'space-kitchen')`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_channels (id, name, category, "deviceId")
			 VALUES ('channel-light', 'Kitchen light', 'light', 'device-light')`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_channels_properties
			 (id, name, identifier, type, category, "dataType", permissions, "channelId")
			 VALUES ('property-brightness', 'Kitchen brightness', 'brightness', 'test', 'brightness', 'uchar',
			         'ro,rw', 'channel-light')`,
		);
		await dataSource.query(
			`INSERT INTO scenes_module_scenes (id, name, category, enabled, triggerable, "primarySpaceId")
			 VALUES ('scene-evening', 'Kitchen evening', 'lighting', 0, 0, 'space-kitchen')`,
		);

		const devicesService = Object.create(DevicesService.prototype) as DevicesService;
		Object.defineProperty(devicesService, 'dataSource', { value: dataSource });
		const spacesService = Object.create(SpacesService.prototype) as SpacesService;
		Object.defineProperty(spacesService, 'dataSource', { value: dataSource });
		const propertiesService = Object.create(ChannelsPropertiesService.prototype) as ChannelsPropertiesService;
		Object.defineProperty(propertiesService, 'dataSource', { value: dataSource });
		const scenesService = Object.create(ScenesService.prototype) as ScenesService;
		Object.defineProperty(scenesService, 'dataSource', { value: dataSource });
		const service = new HomeSearchQueryService(spacesService, devicesService, propertiesService, scenesService);

		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'kitchen',
		});

		expect(result.entities[0]).toMatchObject({ kind: 'space', id: 'space-kitchen' });
		expect(result.entities.map(({ kind, id }) => ({ kind, id }))).toEqual(
			expect.arrayContaining([
				{ kind: 'space', id: 'space-kitchen' },
				{ kind: 'device', id: 'device-light' },
				{ kind: 'property', id: 'property-brightness' },
				{ kind: 'scene', id: 'scene-evening' },
			]),
		);
		expect(result.totals_by_kind).toEqual({ space: 1, device: 1, property: 1, scene: 1 });
		expect(result.entities.find((entity) => entity.kind === 'device')).toMatchObject({ enabled: true });
		expect(result.entities.find((entity) => entity.kind === 'property')).toMatchObject({
			permissions: [expect.stringMatching(/^r/), expect.stringMatching(/^r/)],
			device: { id: 'device-light', name: 'Kitchen light', enabled: true },
			channel: { id: 'channel-light', name: 'Kitchen light', category: 'light' },
		});
		expect(result.entities.find((entity) => entity.kind === 'scene')).toMatchObject({
			enabled: false,
			triggerable: false,
		});
	});

	it('walks a stable mixed-kind candidate window through opaque cursors without duplicates', async () => {
		for (let index = 0; index < 25; index += 1) {
			await dataSource.query(
				`INSERT INTO devices_module_devices
				 (id, name, identifier, type, category, enabled, hidden, "roomId")
				 VALUES (?, ?, ?, 'test', 'sensor', 1, 0, NULL)`,
				[`page-device-${index}`, `Pageable ${String(index).padStart(2, '0')}`, `page-device-${index}`],
			);
		}
		for (let index = 0; index < 5; index += 1) {
			await dataSource.query(
				`INSERT INTO scenes_module_scenes (id, name, category, enabled, triggerable, "primarySpaceId")
				 VALUES (?, ?, 'generic', 1, 1, NULL)`,
				[`page-scene-${index}`, `Pageable ${String(index).padStart(2, '0')}`],
			);
		}

		const devicesService = Object.create(DevicesService.prototype) as DevicesService;
		Object.defineProperty(devicesService, 'dataSource', { value: dataSource });
		const scenesService = Object.create(ScenesService.prototype) as ScenesService;
		Object.defineProperty(scenesService, 'dataSource', { value: dataSource });
		const service = new HomeSearchQueryService(
			{ findOne: jest.fn(), searchSummaryPage: jest.fn() } as unknown as SpacesService,
			devicesService,
			{ searchVisibleSummaryPage: jest.fn() } as unknown as ChannelsPropertiesService,
			scenesService,
		);
		const ids: string[] = [];
		let cursor: string | undefined;
		let pages = 0;

		do {
			const result = await service.searchEntities({
				profile: HOME_SEARCH_PROFILE_BUDDY_V1,
				query: 'pageable',
				kinds: ['device', 'scene'],
				limit: 7,
				cursor,
			});

			expect(result.total).toBe(30);
			expect(result.refine_required).toBe(false);
			ids.push(...result.entities.map(({ id }) => id));
			cursor = result.next_cursor;
			pages += 1;
		} while (cursor);

		expect(pages).toBe(5);
		expect(ids).toHaveLength(30);
		expect(new Set(ids).size).toBe(30);
	});

	it('applies static property and scene candidate capabilities in real SQL before limits', async () => {
		await dataSource.query(
			`INSERT INTO devices_module_devices
			 (id, name, identifier, type, category, enabled, hidden, "roomId") VALUES
			 ('enabled-owner', 'Capability enabled', 'enabled-owner', 'test', 'lighting', 1, 0, NULL),
			 ('disabled-owner', 'Capability disabled', 'disabled-owner', 'test', 'lighting', 0, 0, NULL),
			 ('hidden-owner', 'Capability hidden', 'hidden-owner', 'test', 'lighting', 1, 1, NULL)`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_channels (id, name, category, "deviceId") VALUES
			 ('enabled-channel', 'Capability enabled', 'light', 'enabled-owner'),
			 ('disabled-channel', 'Capability disabled', 'light', 'disabled-owner'),
			 ('hidden-channel', 'Capability hidden', 'light', 'hidden-owner')`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_channels_properties
			 (id, name, identifier, type, category, "dataType", permissions, "channelId") VALUES
			 ('read-only', 'Capability read only', 'read-only', 'test', 'generic', 'bool', 'ro', 'enabled-channel'),
			 ('read-write', 'Capability read write', 'read-write', 'test', 'generic', 'bool', 'rw', 'enabled-channel'),
			 ('write-only', 'Capability write only', 'write-only', 'test', 'generic', 'bool', 'wo', 'enabled-channel'),
			 ('event-only', 'Capability event only', 'event-only', 'test', 'generic', 'bool', 'ev', 'enabled-channel'),
			 ('unsupported-write', 'Capability unsupported', 'unsupported-write', 'test', 'generic', 'unknown', 'rw',
			  'enabled-channel'),
			 ('disabled-write', 'Capability disabled write', 'disabled-write', 'test', 'generic', 'bool', 'wo',
			  'disabled-channel'),
			 ('hidden-write', 'Capability hidden write', 'hidden-write', 'test', 'generic', 'bool', 'rw',
			  'hidden-channel')`,
		);
		await dataSource.query(
			`INSERT INTO scenes_module_scenes (id, name, category, enabled, triggerable, "primarySpaceId") VALUES
			 ('trigger-ready', 'Capability trigger ready', 'generic', 1, 1, NULL),
			 ('trigger-disabled', 'Capability trigger disabled', 'generic', 0, 1, NULL),
			 ('trigger-blocked', 'Capability trigger blocked', 'generic', 1, 0, NULL)`,
		);

		const propertiesService = Object.create(ChannelsPropertiesService.prototype) as ChannelsPropertiesService;
		Object.defineProperty(propertiesService, 'dataSource', { value: dataSource });
		const scenesService = Object.create(ScenesService.prototype) as ScenesService;
		Object.defineProperty(scenesService, 'dataSource', { value: dataSource });
		const service = new HomeSearchQueryService(
			{ findOne: jest.fn(), searchSummaryPage: jest.fn() } as unknown as SpacesService,
			{ searchVisibleSummaryPage: jest.fn() } as unknown as DevicesService,
			propertiesService,
			scenesService,
		);

		const readable = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'capability',
			candidateCapability: 'read',
		});
		const writable = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'capability',
			candidateCapability: 'write',
		});
		const triggerable = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'capability',
			candidateCapability: 'trigger',
		});

		expect(readable.entities.map(({ id }) => id).sort()).toEqual(['read-only', 'read-write', 'unsupported-write']);
		expect(readable.total).toBe(3);
		expect(writable.entities.map(({ id }) => id).sort()).toEqual(['read-write', 'write-only']);
		expect(writable.total).toBe(2);
		expect(triggerable.entities.map(({ id }) => id)).toEqual(['trigger-ready']);
		expect(triggerable.total).toBe(1);
		expect(
			writable.entities.every(
				(entity) => entity.kind === 'property' && entity.candidate_capabilities.includes('write'),
			),
		).toBe(true);
		expect(triggerable.entities[0]).toMatchObject({ candidate_capabilities: ['trigger'] });
	});

	it('applies floor scope, category filters, and hidden-owner visibility in real SQL', async () => {
		await dataSource.query(
			`INSERT INTO spaces_module_spaces (id, name, type, category, "parentId") VALUES
			 ('floor-id', 'Probe floor', 'zone', 'generic', NULL),
			 ('child-room', 'Probe child room', 'room', 'generic', 'floor-id'),
			 ('other-room', 'Probe other room', 'room', 'generic', NULL),
			 ('zone-id', 'Probe zone', 'zone', 'generic', NULL),
			 ('entry-id', 'Probe entry', 'entry', 'generic', NULL)`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_devices
			 (id, name, identifier, type, category, enabled, hidden, "roomId") VALUES
			 ('visible-child', 'Probe visible child', 'visible-child', 'test', 'generic', 1, 0, 'child-room'),
			 ('hidden-child', 'Probe hidden child', 'hidden-child', 'test', 'generic', 1, 1, 'child-room'),
			 ('other-device', 'Probe other device', 'other-device', 'test', 'generic', 1, 0, 'other-room'),
			 ('zone-device', 'Probe zone device', 'zone-device', 'test', 'generic', 1, 0, 'other-room')`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_devices_zones ("deviceId", "zoneId") VALUES ('zone-device', 'zone-id')`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_channels (id, name, category, "deviceId") VALUES
			 ('visible-channel', 'Probe visible channel', 'generic', 'visible-child'),
			 ('hidden-channel', 'Probe hidden channel', 'generic', 'hidden-child'),
			 ('other-channel', 'Probe other channel', 'generic', 'other-device')`,
		);
		await dataSource.query(
			`INSERT INTO devices_module_channels_properties
			 (id, name, identifier, type, category, "dataType", permissions, "channelId") VALUES
			 ('visible-property', 'Probe visible property', 'visible-property', 'test', 'generic', 'bool', 'ro',
			  'visible-channel'),
			 ('hidden-property', 'Probe hidden property', 'hidden-property', 'test', 'generic', 'bool', 'ro',
			  'hidden-channel'),
			 ('other-property', 'Probe other property', 'other-property', 'test', 'generic', 'bool', 'ro',
			  'other-channel')`,
		);
		await dataSource.query(
			`INSERT INTO scenes_module_scenes (id, name, category, enabled, triggerable, "primarySpaceId") VALUES
			 ('floor-scene', 'Probe floor scene', 'generic', 1, 1, 'floor-id'),
			 ('child-scene', 'Probe child scene', 'generic', 1, 1, 'child-room'),
			 ('other-scene', 'Probe other scene', 'generic', 1, 1, 'other-room')`,
		);

		const rawSpacesService = Object.create(SpacesService.prototype) as SpacesService;
		Object.defineProperty(rawSpacesService, 'dataSource', { value: dataSource });
		const findOne = jest.fn().mockResolvedValue({
			id: 'floor-id',
			name: 'Probe floor',
			type: SpaceType.ZONE,
			category: SpaceZoneCategory.FLOOR_FIRST,
		});
		const spacesService = {
			findOne,
			searchSummaryPage: (input: SpaceSearchSummaryInput) => rawSpacesService.searchSummaryPage(input),
		} as unknown as SpacesService;
		const devicesService = Object.create(DevicesService.prototype) as DevicesService;
		Object.defineProperty(devicesService, 'dataSource', { value: dataSource });
		const propertiesService = Object.create(ChannelsPropertiesService.prototype) as ChannelsPropertiesService;
		Object.defineProperty(propertiesService, 'dataSource', { value: dataSource });
		const scenesService = Object.create(ScenesService.prototype) as ScenesService;
		Object.defineProperty(scenesService, 'dataSource', { value: dataSource });
		const service = new HomeSearchQueryService(spacesService, devicesService, propertiesService, scenesService);

		const result = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'probe',
			spaceId: 'floor-id',
			categories: ['generic'],
		});

		expect(result.totals_by_kind).toEqual({ space: 2, device: 1, property: 1, scene: 2 });
		expect(result.entities.map((entity) => entity.id).sort()).toEqual([
			'child-room',
			'child-scene',
			'floor-id',
			'floor-scene',
			'visible-child',
			'visible-property',
		]);
		expect(result.entities.every((entity) => entity.reasons.includes('space_filter'))).toBe(true);
		expect(result.entities.every((entity) => entity.reasons.includes('category_filter'))).toBe(true);

		findOne.mockResolvedValue({ id: 'child-room', name: 'Probe child room', type: SpaceType.ROOM });
		const roomResult = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'probe',
			spaceId: 'child-room',
			categories: ['generic'],
			kinds: ['device'],
		});
		expect(roomResult.entities.map((entity) => entity.id)).toEqual(['visible-child']);

		findOne.mockResolvedValue({ id: 'zone-id', name: 'Probe zone', type: SpaceType.ZONE, category: 'custom' });
		const zoneResult = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'probe',
			spaceId: 'zone-id',
			categories: ['generic'],
			kinds: ['device'],
		});
		expect(zoneResult.entities.map((entity) => entity.id)).toEqual(['zone-device']);

		findOne.mockResolvedValue({ id: 'entry-id', name: 'Probe entry', type: SpaceType.ENTRY });
		const entryResult = await service.searchEntities({
			profile: HOME_SEARCH_PROFILE_BUDDY_V1,
			query: 'probe',
			spaceId: 'entry-id',
			kinds: ['device'],
		});
		expect(entryResult).toMatchObject({ total: 0, returned: 0, entities: [] });
	});
});
