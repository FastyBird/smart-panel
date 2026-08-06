import { ConfigService } from '../../config/services/config.service';
import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { ChannelsService } from '../../devices/services/channels.service';
import { DevicesService } from '../../devices/services/devices.service';
import { PropertyTimeseriesService } from '../../devices/services/property-timeseries.service';
import { EnergyDataService } from '../../energy/services/energy-data.service';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SecurityService } from '../../security/services/security.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType, SpaceZoneCategory } from '../../spaces/spaces.constants';
import { WeatherService } from '../../weather/services/weather.service';
import {
	MCP_MAX_CHANNELS_PER_DEVICE,
	MCP_MAX_CONTEXT_DEVICES,
	MCP_MAX_CONTEXT_SCENES,
	MCP_MAX_CONTEXT_SPACES,
	MCP_MAX_PROPERTIES_PER_CHANNEL,
	MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
	MCP_MAX_SECURITY_DEVICES,
	MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
	McpCapability,
} from '../mcp.constants';

import { McpContextService } from './mcp-context.service';
import { McpInstallationService } from './mcp-installation.service';

describe('McpContextService', () => {
	let service: McpContextService;
	let spaces: {
		findAll: jest.Mock;
		findSummaryPage: jest.Mock;
		findOne: jest.Mock;
		findVisibleDeviceSummariesBySpace: jest.Mock;
		resolveSnapshotScope: jest.Mock;
	};
	let devices: {
		findVisibleSummaryPage: jest.Mock;
		getVisibleSpaceCounts: jest.Mock;
		findVisibleSummaryById: jest.Mock;
	};
	let channels: { findSummaryPage: jest.Mock };
	let properties: { findOne: jest.Mock; findBoundedForChannels: jest.Mock };
	let timeseries: { queryTimeseriesStrict: jest.Mock };
	let scenes: { findSummaryPage: jest.Mock };
	let weather: { getPrimaryWeather: jest.Mock; getWeather: jest.Mock };
	let energy: { getSummary: jest.Mock; getSpaceSummary: jest.Mock; getDeviceZoneSummary: jest.Mock };
	let security: { getBoundedStatus: jest.Mock };

	beforeEach(() => {
		spaces = {
			findAll: jest.fn().mockResolvedValue([]),
			findSummaryPage: jest.fn().mockResolvedValue({ spaces: [], total: 0 }),
			findOne: jest.fn().mockResolvedValue(null),
			findVisibleDeviceSummariesBySpace: jest.fn().mockResolvedValue({ devices: [], total: 0 }),
			resolveSnapshotScope: jest.fn().mockImplementation((space: SpaceEntity) =>
				Promise.resolve({
					deviceScope: space.type === SpaceType.ROOM ? { roomIds: [space.id] } : { zoneId: space.id },
					sceneSpaceIds: [space.id],
					wholeHome: false,
				}),
			),
		};
		devices = {
			findVisibleSummaryPage: jest.fn().mockResolvedValue({ devices: [], total: 0 }),
			getVisibleSpaceCounts: jest.fn().mockResolvedValue({ rooms: {}, zones: {} }),
			findVisibleSummaryById: jest.fn().mockResolvedValue(null),
		};
		channels = { findSummaryPage: jest.fn().mockResolvedValue({ channels: [], total: 0 }) };
		properties = {
			findOne: jest.fn().mockResolvedValue(null),
			findBoundedForChannels: jest.fn().mockResolvedValue({ properties: [], totals: {} }),
		};
		timeseries = { queryTimeseriesStrict: jest.fn() };
		scenes = { findSummaryPage: jest.fn().mockResolvedValue({ scenes: [], total: 0 }) };
		weather = {
			getPrimaryWeather: jest.fn().mockRejectedValue(new Error('weather unavailable')),
			getWeather: jest.fn(),
		};
		energy = {
			getSummary: jest.fn().mockRejectedValue(new Error('energy unavailable')),
			getSpaceSummary: jest.fn(),
			getDeviceZoneSummary: jest.fn(),
		};
		security = { getBoundedStatus: jest.fn().mockRejectedValue(new Error('security unavailable')) };

		service = new McpContextService(
			{ getModuleConfig: jest.fn(() => ({ timezone: 'Europe/Prague' })) } as unknown as ConfigService,
			{ getInstallationId: jest.fn().mockResolvedValue('installation-id') } as unknown as McpInstallationService,
			spaces as unknown as SpacesService,
			devices as unknown as DevicesService,
			channels as unknown as ChannelsService,
			properties as unknown as ChannelsPropertiesService,
			timeseries as unknown as PropertyTimeseriesService,
			scenes as unknown as ScenesService,
			weather as unknown as WeatherService,
			energy as unknown as EnergyDataService,
			security as unknown as SecurityService,
		);
	});

	it('returns stable installation metadata with effective capabilities', async () => {
		await expect(
			service.getInstallation([McpCapability.READ], 'https://panel.test/api/v1/modules/mcp'),
		).resolves.toEqual(
			expect.objectContaining({
				id: 'installation-id',
				name: 'FastyBird Smart Panel',
				timezone: 'Europe/Prague',
				endpoint: 'https://panel.test/api/v1/modules/mcp',
				effective_capabilities: [McpCapability.READ],
			}),
		);
	});

	it('bounds compact home context and normalizes unavailable optional domains', async () => {
		spaces.findAll.mockResolvedValue([
			{ id: 'room-id', name: 'Living room', type: SpaceType.ROOM, parentId: null } as unknown as SpaceEntity,
		]);
		devices.findVisibleSummaryPage.mockResolvedValue({
			devices: Array.from({ length: MCP_MAX_CONTEXT_DEVICES }, (_, index) => ({
				id: `device-${index}`,
				name: `Device ${index}`,
				category: 'generic',
				enabled: true,
				hidden: false,
				roomId: 'room-id',
				zoneIds: [],
				status: { online: true, status: 'connected', lastChanged: null },
			})),
			total: MCP_MAX_CONTEXT_DEVICES + 2,
		});
		devices.getVisibleSpaceCounts.mockResolvedValue({
			rooms: { 'room-id': MCP_MAX_CONTEXT_DEVICES + 2 },
			zones: {},
		});

		const result = await service.getHomeContext();

		expect(result.devices).toHaveLength(MCP_MAX_CONTEXT_DEVICES);
		expect(result.weather).toBeNull();
		expect(result.energy).toBeNull();
		expect(result.security).toBeNull();
		expect(result.spaces).toEqual([
			expect.objectContaining({ id: 'room-id', device_count: MCP_MAX_CONTEXT_DEVICES + 2 }),
		]);
		expect(result.limits).toEqual(expect.objectContaining({ devices_truncated: true }));
		expect(security.getBoundedStatus).toHaveBeenCalledWith(
			MCP_MAX_SECURITY_DEVICES,
			MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
			MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
			undefined,
		);
	});

	it('preserves the selected zone membership in a scoped snapshot', async () => {
		spaces.findOne.mockResolvedValue({
			id: 'zone-id',
			name: 'Downstairs',
			type: SpaceType.ZONE,
			parentId: null,
		} as unknown as SpaceEntity);
		spaces.findVisibleDeviceSummariesBySpace.mockResolvedValue({
			devices: [
				{
					id: 'device-id',
					name: 'Lamp',
					category: 'lighting',
					enabled: true,
					hidden: false,
					roomId: null,
					deviceZones: [],
					status: { online: true, status: 'connected', lastChanged: null },
				} as unknown as DeviceEntity,
			],
			total: 1,
		});

		const result = await service.getHomeContext('zone-id');

		expect(result.spaces).toEqual([expect.objectContaining({ id: 'zone-id', device_count: 1 })]);
		expect(result.devices).toEqual([expect.objectContaining({ id: 'device-id', zone_ids: ['zone-id'] })]);
		expect(scenes.findSummaryPage).toHaveBeenCalledWith(MCP_MAX_CONTEXT_SCENES, ['zone-id']);
		expect(security.getBoundedStatus).toHaveBeenCalledWith(
			MCP_MAX_SECURITY_DEVICES,
			MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
			MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
			{ zoneId: 'zone-id' },
		);
	});

	it('derives global floor-zone counts from child-room counts', async () => {
		spaces.findAll.mockResolvedValue([
			{
				id: 'floor-id',
				name: 'Ground floor',
				type: SpaceType.ZONE,
				category: SpaceZoneCategory.FLOOR_GROUND,
				parentId: null,
			} as unknown as SpaceEntity,
			{ id: 'room-id', name: 'Kitchen', type: SpaceType.ROOM, parentId: 'floor-id' } as unknown as SpaceEntity,
		]);
		devices.getVisibleSpaceCounts.mockResolvedValue({ rooms: { 'room-id': 3 }, zones: {} });

		const result = await service.getHomeContext();

		expect(result.spaces).toEqual([
			expect.objectContaining({ id: 'floor-id', device_count: 3 }),
			expect.objectContaining({ id: 'room-id', device_count: 3 }),
		]);
	});

	it('uses the whole-home visible device total for a master space summary', async () => {
		spaces.findAll.mockResolvedValue([
			{
				id: 'master-id',
				name: 'My home',
				type: SpaceType.MASTER,
				parentId: null,
			} as unknown as SpaceEntity,
		]);
		devices.findVisibleSummaryPage.mockResolvedValue({ devices: [], total: 17 });

		const result = await service.getHomeContext();

		expect(result.spaces).toEqual([expect.objectContaining({ id: 'master-id', device_count: 17 })]);
	});

	it('includes child-room scenes and scopes security for a floor snapshot', async () => {
		const floor = {
			id: 'floor-id',
			name: 'Ground floor',
			type: SpaceType.ZONE,
			category: SpaceZoneCategory.FLOOR_GROUND,
			parentId: null,
		} as unknown as SpaceEntity;
		spaces.findOne.mockResolvedValue(floor);
		spaces.resolveSnapshotScope.mockResolvedValue({
			deviceScope: { roomIds: ['room-1', 'room-2'] },
			sceneSpaceIds: ['floor-id', 'room-1', 'room-2'],
			wholeHome: false,
		});
		spaces.findVisibleDeviceSummariesBySpace.mockResolvedValue({ devices: [], total: 0 });

		await service.getHomeContext('floor-id');

		expect(scenes.findSummaryPage).toHaveBeenCalledWith(MCP_MAX_CONTEXT_SCENES, ['floor-id', 'room-1', 'room-2']);
		expect(security.getBoundedStatus).toHaveBeenCalledWith(
			MCP_MAX_SECURITY_DEVICES,
			MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
			MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
			{ roomIds: ['room-1', 'room-2'] },
		);
	});

	it('uses whole-home data for a master snapshot', async () => {
		const master = {
			id: 'master-id',
			name: 'My home',
			type: SpaceType.MASTER,
			parentId: null,
		} as unknown as SpaceEntity;
		spaces.findOne.mockResolvedValue(master);
		spaces.resolveSnapshotScope.mockResolvedValue({ deviceScope: {}, wholeHome: true });
		spaces.findVisibleDeviceSummariesBySpace.mockResolvedValue({ devices: [], total: 3 });
		energy.getSummary.mockResolvedValue({ totalConsumptionKwh: 5 });

		const result = await service.getHomeContext('master-id');

		expect(result.scope).toEqual({ type: 'space', id: 'master-id', name: 'My home' });
		expect(scenes.findSummaryPage).toHaveBeenCalledWith(MCP_MAX_CONTEXT_SCENES, undefined);
		expect(energy.getSummary).toHaveBeenCalled();
		expect(energy.getSpaceSummary).not.toHaveBeenCalled();
		expect(security.getBoundedStatus).toHaveBeenCalledWith(
			MCP_MAX_SECURITY_DEVICES,
			MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
			MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
			{},
		);
	});

	it('uses whole-home security while keeping entry snapshot content empty', async () => {
		const entry = {
			id: 'entry-id',
			name: 'Entrance',
			type: SpaceType.ENTRY,
			parentId: null,
		} as unknown as SpaceEntity;
		spaces.findOne.mockResolvedValue(entry);
		spaces.resolveSnapshotScope.mockResolvedValue({
			deviceScope: { roomIds: [] },
			securityDeviceScope: {},
			sceneSpaceIds: [],
			wholeHome: false,
		});
		spaces.findVisibleDeviceSummariesBySpace.mockResolvedValue({ devices: [], total: 0 });

		await service.getHomeContext('entry-id');

		expect(scenes.findSummaryPage).toHaveBeenCalledWith(MCP_MAX_CONTEXT_SCENES, []);
		expect(security.getBoundedStatus).toHaveBeenCalledWith(
			MCP_MAX_SECURITY_DEVICES,
			MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
			MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
			{},
		);
	});

	it('requests only the bounded scene summary page', async () => {
		scenes.findSummaryPage.mockResolvedValue({
			scenes: [
				{
					id: 'scene-id',
					name: 'Movie night',
					category: 'generic',
					enabled: true,
					triggerable: true,
					primarySpaceId: null,
				},
			],
			total: MCP_MAX_CONTEXT_SCENES + 1,
		});

		const result = await service.getHomeContext();

		expect(scenes.findSummaryPage).toHaveBeenCalledWith(MCP_MAX_CONTEXT_SCENES, undefined);
		expect(result.limits).toEqual(expect.objectContaining({ scenes_truncated: true }));
	});

	it('marks bounded security output as incomplete when device selection is truncated', async () => {
		security.getBoundedStatus.mockResolvedValue({
			status: {
				armedState: null,
				alarmState: null,
				highestSeverity: 'info',
				activeAlertsCount: 0,
				hasCriticalAlert: false,
				activeAlerts: [],
			},
			devicesTruncated: false,
			channelsTruncated: true,
			propertiesTruncated: true,
		});

		const result = await service.getSecurityStatus();

		expect(result).toEqual(
			expect.objectContaining({
				devices_truncated: false,
				channels_truncated: true,
				properties_truncated: true,
				state_truncated: true,
			}),
		);
	});

	it('maps current values only for a requested visible device', async () => {
		devices.findVisibleSummaryById.mockResolvedValue({
			id: 'device-id',
			name: 'Lamp',
			category: 'lighting',
			enabled: true,
			hidden: false,
			roomId: 'room-id',
			zoneIds: [],
			status: { online: true, status: 'connected', lastChanged: new Date('2026-08-06T12:00:00Z') },
		} as unknown as DeviceEntity);
		channels.findSummaryPage.mockResolvedValue({
			channels: [
				{
					id: 'channel-id',
					name: 'Light',
					category: 'light',
				},
			],
			total: MCP_MAX_CHANNELS_PER_DEVICE + 1,
		});
		properties.findBoundedForChannels.mockResolvedValue({
			properties: [
				{
					id: 'property-id',
					name: 'Brightness',
					category: 'brightness',
					dataType: 'uchar',
					unit: '%',
					value: { value: 50, lastUpdated: '2026-08-06T12:00:00Z', trend: 'stable' },
					channel: { id: 'channel-id' },
				},
			],
			totals: { 'channel-id': MCP_MAX_PROPERTIES_PER_CHANNEL + 1 },
		});

		const result = await service.getDeviceState('device-id');

		expect(result).toEqual(
			expect.objectContaining({
				id: 'device-id',
				channels_truncated: true,
				channels: [
					expect.objectContaining({
						properties_truncated: true,
						properties: [expect.objectContaining({ id: 'property-id', value: 50, trend: 'stable' })],
					}),
				],
			}),
		);
		expect(channels.findSummaryPage).toHaveBeenCalledWith('device-id', MCP_MAX_CHANNELS_PER_DEVICE);
		expect(properties.findBoundedForChannels).toHaveBeenCalledWith(
			['channel-id'],
			MCP_MAX_PROPERTIES_PER_CHANNEL,
			true,
		);
	});

	it('paginates space resource summaries with a stable offset cursor', async () => {
		spaces.findSummaryPage.mockResolvedValue({
			spaces: [{ id: 'space-51', name: 'Workshop', type: SpaceType.ROOM }],
			total: 52,
		});

		await expect(service.listSpaces('50')).resolves.toEqual({
			spaces: [{ id: 'space-51', name: 'Workshop', type: SpaceType.ROOM }],
			nextCursor: '51',
		});
		expect(spaces.findSummaryPage).toHaveBeenCalledWith(MCP_MAX_CONTEXT_SPACES, 50);
	});

	it('rejects an invalid space resource cursor before querying', async () => {
		await expect(service.listSpaces('not-a-cursor')).rejects.toThrow('cursor is invalid');
		expect(spaces.findSummaryPage).not.toHaveBeenCalled();
	});

	it('uses explicit device-zone membership for a non-floor zone energy summary', async () => {
		spaces.findOne.mockResolvedValue({
			id: 'zone-id',
			name: 'Garden',
			type: SpaceType.ZONE,
			category: SpaceZoneCategory.OUTDOOR_GARDEN,
		} as unknown as SpaceEntity);
		energy.getDeviceZoneSummary.mockResolvedValue({ totalConsumptionKwh: 2 });

		await service.getEnergySummary('2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z', 'zone-id');

		expect(energy.getDeviceZoneSummary).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 'zone-id');
		expect(energy.getSpaceSummary).not.toHaveBeenCalled();
	});

	it('uses whole-home energy for a master space', async () => {
		spaces.findOne.mockResolvedValue({
			id: 'master-id',
			name: 'Whole home',
			type: SpaceType.MASTER,
		} as unknown as SpaceEntity);
		energy.getSummary.mockResolvedValue({ totalConsumptionKwh: 8 });

		await expect(
			service.getEnergySummary('2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z', 'master-id'),
		).resolves.toEqual(expect.objectContaining({ totalConsumptionKwh: 8 }));
		expect(energy.getSummary).toHaveBeenCalledWith(expect.any(Date), expect.any(Date));
		expect(energy.getSpaceSummary).not.toHaveBeenCalled();
	});

	it('rejects a timeseries bucket that could exceed the result cap before querying storage', async () => {
		await expect(
			service.getPropertyTimeseries('property-id', '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z', '1m'),
		).rejects.toThrow('would exceed');
		expect(properties.findOne).not.toHaveBeenCalled();
		expect(timeseries.queryTimeseriesStrict).not.toHaveBeenCalled();
	});

	it('returns bounded property history for a visible device', async () => {
		properties.findOne.mockResolvedValue({
			id: 'property-id',
			channel: { device: { hidden: false } },
		} as unknown as ChannelPropertyEntity);
		timeseries.queryTimeseriesStrict.mockResolvedValue({
			bucket: '5m',
			points: [{ time: '2026-08-01T00:00:00.000Z', value: 1 }],
		});

		await expect(
			service.getPropertyTimeseries('property-id', '2026-08-01T00:00:00.000Z', '2026-08-01T01:00:00.000Z', '5m'),
		).resolves.toEqual(expect.objectContaining({ property_id: 'property-id', bucket: '5m', truncated: false }));
	});

	it('propagates storage failures from strict property history reads', async () => {
		properties.findOne.mockResolvedValue({
			id: 'property-id',
			channel: { device: { hidden: false } },
		} as unknown as ChannelPropertyEntity);
		const storageError = new Error('storage unavailable');
		timeseries.queryTimeseriesStrict.mockRejectedValue(storageError);

		await expect(
			service.getPropertyTimeseries('property-id', '2026-08-01T00:00:00.000Z', '2026-08-01T01:00:00.000Z', '5m'),
		).rejects.toBe(storageError);
	});
});
