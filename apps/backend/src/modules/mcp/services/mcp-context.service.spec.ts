import { ConfigService } from '../../config/services/config.service';
import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { ChannelsService } from '../../devices/services/channels.service';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
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
	MCP_MAX_ENERGY_RANGE_DAYS,
	MCP_MAX_FORECAST_DAYS,
	MCP_MAX_PROPERTIES_PER_CHANNEL,
	MCP_MAX_SECURITY_ALERTS,
	MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
	MCP_MAX_SECURITY_DEVICES,
	MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
	MCP_MAX_TIMESERIES_POINTS,
	MCP_MAX_TIMESERIES_RANGE_DAYS,
	MCP_MAX_TRIGGER_SCENES,
	MCP_MAX_TRIGGER_SPACES,
	MCP_MAX_WRITABLE_PROPERTIES,
	MCP_MAX_WRITABLE_PROPERTY_CANDIDATES,
	McpCapability,
} from '../mcp.constants';

import { McpContextService } from './mcp-context.service';
import { McpInstallationService } from './mcp-installation.service';

describe('McpContextService', () => {
	let service: McpContextService;
	let spaces: {
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
	let connectionStates: { readLatestManyStrict: jest.Mock };
	let channels: { findSummaryPage: jest.Mock };
	let properties: { findOne: jest.Mock; findBoundedForChannels: jest.Mock };
	let timeseries: { queryTimeseriesStrict: jest.Mock };
	let scenes: { findSummaryPage: jest.Mock };
	let weather: { getPrimaryWeather: jest.Mock; getWeather: jest.Mock };
	let energy: { getSummary: jest.Mock; getSpaceSummary: jest.Mock; getDeviceZoneSummary: jest.Mock };
	let security: { getBoundedStatus: jest.Mock };

	beforeEach(() => {
		spaces = {
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
			getVisibleSpaceCounts: jest.fn().mockResolvedValue({ rooms: {}, zones: {}, floors: {} }),
			findVisibleSummaryById: jest.fn().mockResolvedValue(null),
		};
		connectionStates = {
			readLatestManyStrict: jest
				.fn()
				.mockImplementation((loadedDevices: DeviceEntity[]) =>
					Promise.resolve(
						new Map(
							loadedDevices.map((device) => [
								device.id,
								device.status ?? { online: false, status: 'unknown', lastChanged: null },
							]),
						),
					),
				),
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
			connectionStates as unknown as DeviceConnectionStateService,
			channels as unknown as ChannelsService,
			properties as unknown as ChannelsPropertiesService,
			timeseries as unknown as PropertyTimeseriesService,
			scenes as unknown as ScenesService,
			weather as unknown as WeatherService,
			energy as unknown as EnergyDataService,
			security as unknown as SecurityService,
		);
	});

	afterEach(() => {
		jest.useRealTimers();
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

	it('freezes the numeric MCP context and discovery compatibility limits', () => {
		expect({
			spaces: MCP_MAX_CONTEXT_SPACES,
			devices: MCP_MAX_CONTEXT_DEVICES,
			channelsPerDevice: MCP_MAX_CHANNELS_PER_DEVICE,
			propertiesPerChannel: MCP_MAX_PROPERTIES_PER_CHANNEL,
			scenes: MCP_MAX_CONTEXT_SCENES,
			writableProperties: MCP_MAX_WRITABLE_PROPERTIES,
			writableCandidates: MCP_MAX_WRITABLE_PROPERTY_CANDIDATES,
			triggerScenes: MCP_MAX_TRIGGER_SCENES,
			triggerSpaces: MCP_MAX_TRIGGER_SPACES,
			securityAlerts: MCP_MAX_SECURITY_ALERTS,
			securityDevices: MCP_MAX_SECURITY_DEVICES,
			securityChannelsPerDevice: MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
			securityPropertiesPerChannel: MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
			forecastDays: MCP_MAX_FORECAST_DAYS,
			timeseriesRangeDays: MCP_MAX_TIMESERIES_RANGE_DAYS,
			timeseriesPoints: MCP_MAX_TIMESERIES_POINTS,
			energyRangeDays: MCP_MAX_ENERGY_RANGE_DAYS,
		}).toEqual({
			spaces: 50,
			devices: 100,
			channelsPerDevice: 20,
			propertiesPerChannel: 40,
			scenes: 50,
			writableProperties: 100,
			writableCandidates: 500,
			triggerScenes: 50,
			triggerSpaces: 50,
			securityAlerts: 20,
			securityDevices: 100,
			securityChannelsPerDevice: 10,
			securityPropertiesPerChannel: 20,
			forecastDays: 5,
			timeseriesRangeDays: 14,
			timeseriesPoints: 500,
			energyRangeDays: 31,
		});
	});

	it('bounds compact home context and normalizes unavailable optional domains', async () => {
		spaces.findSummaryPage.mockResolvedValue({
			spaces: [{ id: 'room-id', name: 'Living room', type: SpaceType.ROOM, parentId: null } as unknown as SpaceEntity],
			total: 1,
		});
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
			floors: {},
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
		expect(spaces.findSummaryPage).toHaveBeenCalledWith(MCP_MAX_CONTEXT_SPACES + 1, 0);
		expect(security.getBoundedStatus).toHaveBeenCalledWith(
			MCP_MAX_SECURITY_DEVICES,
			MCP_MAX_SECURITY_CHANNELS_PER_DEVICE,
			MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL,
			undefined,
		);
	});

	it('caps a whole-home snapshot at 100 devices and reports the omitted device', async () => {
		devices.findVisibleSummaryPage.mockResolvedValue({
			devices: Array.from({ length: 100 }, (_, index) => ({
				id: `device-${index}`,
				name: `Device ${index}`,
				category: 'generic',
				enabled: true,
				hidden: false,
				roomId: null,
				zoneIds: [],
				status: { online: true, status: 'connected', lastChanged: null },
			})) as DeviceEntity[],
			total: 101,
		});

		const result = await service.getHomeContext();

		expect(devices.findVisibleSummaryPage).toHaveBeenCalledWith(100);
		expect(result.devices).toHaveLength(100);
		expect(result.limits).toEqual(expect.objectContaining({ devices_truncated: true }));
	});

	it('returns the exact whole-home composite contract with stable collection ordering', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-08-14T12:00:00.000Z'));
		spaces.findSummaryPage.mockResolvedValue({
			spaces: [
				{ id: 'room-1', name: 'Kitchen', type: SpaceType.ROOM, parentId: null } as unknown as SpaceEntity,
				{ id: 'room-2', name: 'Office', type: SpaceType.ROOM, parentId: null } as unknown as SpaceEntity,
			],
			total: 2,
		});
		devices.findVisibleSummaryPage.mockResolvedValue({
			devices: [
				{
					id: 'device-1',
					name: 'Kitchen light',
					category: 'lighting',
					enabled: true,
					hidden: false,
					roomId: 'room-1',
					zoneIds: ['zone-1'],
					status: { online: true, status: 'connected', lastChanged: new Date('2026-08-14T12:00:00.000Z') },
				} as unknown as DeviceEntity,
			],
			total: 1,
		});
		devices.getVisibleSpaceCounts.mockResolvedValue({
			rooms: { 'room-1': 1, 'room-2': 0 },
			zones: {},
			floors: {},
		});
		scenes.findSummaryPage.mockResolvedValue({
			scenes: [
				{
					id: 'scene-1',
					name: 'Morning',
					category: 'generic',
					enabled: true,
					triggerable: true,
					primarySpaceId: 'room-1',
				},
			],
			total: 1,
		});
		weather.getPrimaryWeather.mockResolvedValue({
			locationId: 'location-1',
			location: 'Prague',
			current: { temperature: 21, condition: 'clear' },
			forecast: [{ date: '2026-08-15', temperature: 23 }],
		});
		energy.getSummary.mockResolvedValue({
			totalConsumptionKwh: 12.5,
			totalProductionKwh: 3.25,
			totalGridImportKwh: 10,
			totalGridExportKwh: 0.75,
			hasGridMetrics: true,
			lastUpdatedAt: '2026-08-14T11:55:00.000Z',
		});
		security.getBoundedStatus.mockResolvedValue({
			status: {
				armedState: 'armed_away',
				alarmState: 'idle',
				highestSeverity: 'warning',
				activeAlertsCount: 1,
				hasCriticalAlert: false,
				activeAlerts: [
					{
						id: 'alert-1',
						type: 'intrusion',
						severity: 'warning',
						timestamp: '2026-08-14T11:58:00.000Z',
						acknowledged: false,
						sourceDeviceId: 'device-1',
						message: 'Motion detected',
					},
				],
				lastEvent: {
					type: 'intrusion',
					timestamp: '2026-08-14T11:58:00.000Z',
					sourceDeviceId: 'device-1',
				},
			},
			devicesTruncated: false,
			channelsTruncated: false,
			propertiesTruncated: false,
		});

		await expect(service.getHomeContext()).resolves.toEqual({
			scope: { type: 'home' },
			spaces: [
				{ id: 'room-1', name: 'Kitchen', type: SpaceType.ROOM, parent_id: null, device_count: 1 },
				{ id: 'room-2', name: 'Office', type: SpaceType.ROOM, parent_id: null, device_count: 0 },
			],
			devices: [
				{
					id: 'device-1',
					name: 'Kitchen light',
					category: 'lighting',
					enabled: true,
					room_id: 'room-1',
					zone_ids: ['zone-1'],
					status: { online: true, state: 'connected', last_changed: '2026-08-14T12:00:00.000Z' },
				},
			],
			scenes: [
				{
					id: 'scene-1',
					name: 'Morning',
					category: 'generic',
					enabled: true,
					triggerable: true,
					primary_space_id: 'room-1',
				},
			],
			weather: {
				location_id: 'location-1',
				location: 'Prague',
				current: { temperature: 21, condition: 'clear' },
				forecast: [{ date: '2026-08-15', temperature: 23 }],
			},
			energy: {
				scope: { type: 'home' },
				from: '2026-08-13T12:00:00.000Z',
				to: '2026-08-14T12:00:00.000Z',
				totalConsumptionKwh: 12.5,
				totalProductionKwh: 3.25,
				totalGridImportKwh: 10,
				totalGridExportKwh: 0.75,
				hasGridMetrics: true,
				lastUpdatedAt: '2026-08-14T11:55:00.000Z',
			},
			security: {
				armed_state: 'armed_away',
				alarm_state: 'idle',
				highest_severity: 'warning',
				active_alerts_count: 1,
				has_critical_alert: false,
				active_alerts: [
					{
						id: 'alert-1',
						type: 'intrusion',
						severity: 'warning',
						timestamp: '2026-08-14T11:58:00.000Z',
						acknowledged: false,
						source_device_id: 'device-1',
						message: 'Motion detected',
					},
				],
				alerts_truncated: false,
				devices_truncated: false,
				channels_truncated: false,
				properties_truncated: false,
				state_truncated: false,
				last_event: {
					type: 'intrusion',
					timestamp: '2026-08-14T11:58:00.000Z',
					sourceDeviceId: 'device-1',
				},
			},
			limits: { spaces_truncated: false, devices_truncated: false, scenes_truncated: false },
		});
	});

	it('returns the exact scoped composite contract', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-08-14T12:00:00.000Z'));
		spaces.findOne.mockResolvedValue({
			id: 'room-1',
			name: 'Kitchen',
			type: SpaceType.ROOM,
			parentId: null,
		} as unknown as SpaceEntity);
		weather.getPrimaryWeather.mockResolvedValue({
			locationId: 'location-1',
			location: 'Prague',
			current: { temperature: 21, condition: 'clear' },
			forecast: [{ date: '2026-08-15', temperature: 23 }],
		});
		energy.getSpaceSummary.mockResolvedValue({
			totalConsumptionKwh: 4,
			totalProductionKwh: 1,
			totalGridImportKwh: 3.5,
			totalGridExportKwh: 0.5,
			netKwh: 3,
			netGridKwh: 3,
			hasGridMetrics: true,
			lastUpdatedAt: '2026-08-14T11:55:00.000Z',
		});
		security.getBoundedStatus.mockResolvedValue({
			status: {
				armedState: 'disarmed',
				alarmState: null,
				highestSeverity: 'info',
				activeAlertsCount: 0,
				hasCriticalAlert: false,
				activeAlerts: [],
				lastEvent: undefined,
			},
			devicesTruncated: false,
			channelsTruncated: false,
			propertiesTruncated: false,
		});

		await expect(service.getHomeContext('room-1')).resolves.toEqual({
			scope: { type: 'space', id: 'room-1', name: 'Kitchen' },
			spaces: [{ id: 'room-1', name: 'Kitchen', type: SpaceType.ROOM, parent_id: null, device_count: 0 }],
			devices: [],
			scenes: [],
			weather: {
				location_id: 'location-1',
				location: 'Prague',
				current: { temperature: 21, condition: 'clear' },
				forecast: [{ date: '2026-08-15', temperature: 23 }],
			},
			energy: {
				scope: { type: 'space', id: 'room-1' },
				from: '2026-08-13T12:00:00.000Z',
				to: '2026-08-14T12:00:00.000Z',
				totalConsumptionKwh: 4,
				totalProductionKwh: 1,
				totalGridImportKwh: 3.5,
				totalGridExportKwh: 0.5,
				netKwh: 3,
				netGridKwh: 3,
				hasGridMetrics: true,
				lastUpdatedAt: '2026-08-14T11:55:00.000Z',
			},
			security: {
				armed_state: 'disarmed',
				alarm_state: null,
				highest_severity: 'info',
				active_alerts_count: 0,
				has_critical_alert: false,
				active_alerts: [],
				alerts_truncated: false,
				devices_truncated: false,
				channels_truncated: false,
				properties_truncated: false,
				state_truncated: false,
				last_event: null,
			},
			limits: { spaces_truncated: false, devices_truncated: false, scenes_truncated: false },
		});
	});

	it('caps a scoped space snapshot at 100 devices and reports the omitted device', async () => {
		spaces.findOne.mockResolvedValue({
			id: 'room-1',
			name: 'Kitchen',
			type: SpaceType.ROOM,
			parentId: null,
		} as unknown as SpaceEntity);
		spaces.findVisibleDeviceSummariesBySpace.mockResolvedValue({
			devices: Array.from({ length: 100 }, (_, index) => ({
				id: `device-${index}`,
				name: `Device ${index}`,
				category: 'generic',
				enabled: true,
				hidden: false,
				roomId: 'room-1',
				zoneIds: [],
				status: { online: true, status: 'connected', lastChanged: null },
			})) as DeviceEntity[],
			total: 101,
		});

		const result = await service.getHomeContext('room-1');

		expect(spaces.findVisibleDeviceSummariesBySpace).toHaveBeenCalledWith('room-1', 100);
		expect(result.devices).toHaveLength(100);
		expect(result.limits).toEqual(expect.objectContaining({ devices_truncated: true }));
	});

	it('propagates strict connection status failures from home context', async () => {
		devices.findVisibleSummaryPage.mockResolvedValue({
			devices: [{ id: 'device-id', hidden: false } as DeviceEntity],
			total: 1,
		});
		connectionStates.readLatestManyStrict.mockRejectedValue(new Error('status storage unavailable'));

		await expect(service.getHomeContext()).rejects.toThrow('status storage unavailable');
	});

	it('fetches only a limit-plus-one space page for global context', async () => {
		spaces.findSummaryPage.mockResolvedValue({
			spaces: Array.from({ length: MCP_MAX_CONTEXT_SPACES + 1 }, (_, index) => ({
				id: `room-${index}`,
				name: `Room ${index}`,
				type: SpaceType.ROOM,
				parentId: null,
			})) as SpaceEntity[],
			total: MCP_MAX_CONTEXT_SPACES + 25,
		});

		const result = await service.getHomeContext();

		expect(result.spaces).toHaveLength(MCP_MAX_CONTEXT_SPACES);
		expect(result.limits).toEqual(expect.objectContaining({ spaces_truncated: true }));
		expect(spaces.findSummaryPage).toHaveBeenCalledWith(MCP_MAX_CONTEXT_SPACES + 1, 0);
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
		spaces.findSummaryPage.mockResolvedValue({
			spaces: [
				{
					id: 'floor-id',
					name: 'Ground floor',
					type: SpaceType.ZONE,
					category: SpaceZoneCategory.FLOOR_GROUND,
					parentId: null,
				} as unknown as SpaceEntity,
				{ id: 'room-id', name: 'Kitchen', type: SpaceType.ROOM, parentId: 'floor-id' } as unknown as SpaceEntity,
			],
			total: 2,
		});
		devices.getVisibleSpaceCounts.mockResolvedValue({
			rooms: { 'room-id': 3 },
			zones: {},
			floors: { 'floor-id': 3 },
		});

		const result = await service.getHomeContext();

		expect(result.spaces).toEqual([
			expect.objectContaining({ id: 'floor-id', device_count: 3 }),
			expect.objectContaining({ id: 'room-id', device_count: 3 }),
		]);
	});

	it('uses the whole-home visible device total for a master space summary', async () => {
		spaces.findSummaryPage.mockResolvedValue({
			spaces: [
				{
					id: 'master-id',
					name: 'My home',
					type: SpaceType.MASTER,
					parentId: null,
				} as unknown as SpaceEntity,
			],
			total: 1,
		});
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

	it('preserves disabled visible devices and scenes in the MCP snapshot', async () => {
		devices.findVisibleSummaryPage.mockResolvedValue({
			devices: [
				{
					id: 'disabled-device',
					name: 'Disabled lamp',
					category: 'lighting',
					enabled: false,
					hidden: false,
					roomId: null,
					zoneIds: [],
				} as unknown as DeviceEntity,
			],
			total: 1,
		});
		scenes.findSummaryPage.mockResolvedValue({
			scenes: [
				{
					id: 'disabled-scene',
					name: 'Disabled scene',
					category: 'generic',
					enabled: false,
					triggerable: false,
					primarySpaceId: null,
				},
			],
			total: 1,
		});

		const result = await service.getHomeContext();

		expect(result.devices).toEqual([expect.objectContaining({ id: 'disabled-device', enabled: false })]);
		expect(result.scenes).toEqual([expect.objectContaining({ id: 'disabled-scene', enabled: false })]);
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

		expect(security.getBoundedStatus).toHaveBeenCalledWith(100, 10, 20);
		expect(result).toEqual(
			expect.objectContaining({
				devices_truncated: false,
				channels_truncated: true,
				properties_truncated: true,
				state_truncated: true,
			}),
		);
	});

	it('caps security alerts and preserves alert truncation metadata', async () => {
		const activeAlerts = Array.from({ length: 23 }, (_, index) => ({
			id: `alert-${index}`,
			type: 'intrusion',
			severity: 'warning',
			timestamp: `2026-08-14T12:${String(index).padStart(2, '0')}:00.000Z`,
			acknowledged: index % 2 === 0,
			sourceDeviceId: `device-${index}`,
			message: `Alert ${index}`,
		}));
		security.getBoundedStatus.mockResolvedValue({
			status: {
				armedState: 'armed',
				alarmState: null,
				highestSeverity: 'warning',
				activeAlertsCount: 23,
				hasCriticalAlert: false,
				activeAlerts,
			},
			devicesTruncated: false,
			channelsTruncated: false,
			propertiesTruncated: false,
		});

		const result = await service.getSecurityStatus();

		expect(result.active_alerts).toEqual(
			Array.from({ length: 20 }, (_, index) => ({
				id: `alert-${index}`,
				type: 'intrusion',
				severity: 'warning',
				timestamp: `2026-08-14T12:${String(index).padStart(2, '0')}:00.000Z`,
				acknowledged: index % 2 === 0,
				source_device_id: `device-${index}`,
				message: `Alert ${index}`,
			})),
		);
		expect(result).toEqual(expect.objectContaining({ active_alerts_count: 23 }));
		expect(result.alerts_truncated).toBe(true);
	});

	it('maps the complete direct device-state contract for a requested disabled-but-visible device', async () => {
		devices.findVisibleSummaryById.mockResolvedValue({
			id: 'device-id',
			name: 'Lamp',
			category: 'lighting',
			enabled: false,
			hidden: false,
			roomId: 'room-id',
			zoneIds: ['zone-id'],
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

		expect(result).toEqual({
			id: 'device-id',
			name: 'Lamp',
			category: 'lighting',
			enabled: false,
			room_id: 'room-id',
			zone_ids: ['zone-id'],
			status: {
				online: true,
				state: 'connected',
				last_changed: '2026-08-06T12:00:00.000Z',
			},
			channels: [
				{
					id: 'channel-id',
					name: 'Light',
					category: 'light',
					properties: [
						{
							id: 'property-id',
							name: 'Brightness',
							category: 'brightness',
							data_type: 'uchar',
							unit: '%',
							value: 50,
							last_updated: '2026-08-06T12:00:00Z',
							trend: 'stable',
						},
					],
					properties_truncated: true,
				},
			],
			channels_truncated: true,
		});
		expect(channels.findSummaryPage).toHaveBeenCalledWith('device-id', MCP_MAX_CHANNELS_PER_DEVICE);
		expect(connectionStates.readLatestManyStrict).toHaveBeenCalledWith([expect.objectContaining({ id: 'device-id' })]);
		expect(properties.findBoundedForChannels).toHaveBeenCalledWith(
			['channel-id'],
			MCP_MAX_PROPERTIES_PER_CHANNEL,
			true,
		);
	});

	it('propagates strict device connection status failures', async () => {
		devices.findVisibleSummaryById.mockResolvedValue({
			id: 'device-id',
			name: 'Lamp',
			hidden: false,
		} as unknown as DeviceEntity);
		connectionStates.readLatestManyStrict.mockRejectedValue(new Error('status storage unavailable'));

		await expect(service.getDeviceState('device-id')).rejects.toThrow('status storage unavailable');
		expect(channels.findSummaryPage).not.toHaveBeenCalled();
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

	it('maps an explicit 31-day home energy range and rejects a longer range before querying', async () => {
		const from = '2026-01-01T00:00:00.000Z';
		const atLimit = '2026-02-01T00:00:00.000Z';
		const beyondLimit = '2026-02-02T00:00:00.000Z';
		energy.getSummary.mockResolvedValue({
			totalConsumptionKwh: 12.5,
			totalProductionKwh: 3.25,
			totalGridImportKwh: 10,
			totalGridExportKwh: 0.75,
			hasGridMetrics: true,
			lastUpdatedAt: '2026-01-31T23:55:00.000Z',
		});

		await expect(service.getEnergySummary(from, atLimit)).resolves.toEqual({
			scope: { type: 'home' },
			from,
			to: atLimit,
			totalConsumptionKwh: 12.5,
			totalProductionKwh: 3.25,
			totalGridImportKwh: 10,
			totalGridExportKwh: 0.75,
			hasGridMetrics: true,
			lastUpdatedAt: '2026-01-31T23:55:00.000Z',
		});
		expect(energy.getSummary).toHaveBeenCalledWith(new Date(from), new Date(atLimit));
		await expect(service.getEnergySummary(from, beyondLimit)).rejects.toThrow('may not exceed 31 days');
		expect(energy.getSummary).toHaveBeenCalledTimes(1);
	});

	it('uses primary or explicit weather selection and caps the forecast', async () => {
		const forecast = Array.from({ length: 7 }, (_, index) => ({
			date: `2026-08-${String(index + 15).padStart(2, '0')}`,
		}));
		const weatherResult = {
			locationId: 'location-id',
			location: 'Prague',
			current: { temperature: 21 },
			forecast,
		};
		weather.getPrimaryWeather.mockResolvedValue(weatherResult);
		weather.getWeather.mockResolvedValue(weatherResult);

		const primary = await service.getWeather();
		const explicit = await service.getWeather('location-id');

		expect(weather.getPrimaryWeather).toHaveBeenCalledTimes(1);
		expect(weather.getWeather).toHaveBeenCalledWith('location-id');
		expect(primary.forecast).toEqual([
			{ date: '2026-08-15' },
			{ date: '2026-08-16' },
			{ date: '2026-08-17' },
			{ date: '2026-08-18' },
			{ date: '2026-08-19' },
		]);
		expect(explicit).toEqual(primary);
		expect(explicit).toEqual(expect.objectContaining({ location_id: 'location-id', location: 'Prague' }));
	});

	it('rejects a timeseries bucket that could exceed the result cap before querying storage', async () => {
		await expect(
			service.getPropertyTimeseries('property-id', '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z', '1m'),
		).rejects.toThrow('would exceed');
		expect(properties.findOne).not.toHaveBeenCalled();
		expect(timeseries.queryTimeseriesStrict).not.toHaveBeenCalled();
	});

	it('accepts a 14-day timeseries range and rejects a longer range before querying storage', async () => {
		properties.findOne.mockResolvedValue({
			id: 'property-id',
			channel: { device: { hidden: false } },
		} as unknown as ChannelPropertyEntity);
		timeseries.queryTimeseriesStrict.mockResolvedValue({ bucket: '1h', points: [] });

		await expect(
			service.getPropertyTimeseries('property-id', '2026-08-01T00:00:00.000Z', '2026-08-15T00:00:00.000Z', '1h'),
		).resolves.toEqual(expect.objectContaining({ property_id: 'property-id', bucket: '1h' }));
		await expect(
			service.getPropertyTimeseries('property-id', '2026-08-01T00:00:00.000Z', '2026-08-15T00:00:01.000Z', '1h'),
		).rejects.toThrow('may not exceed 14 days');
		expect(properties.findOne).toHaveBeenCalledTimes(1);
		expect(timeseries.queryTimeseriesStrict).toHaveBeenCalledTimes(1);
	});

	it('maps the complete direct property-timeseries contract for a visible device', async () => {
		properties.findOne.mockResolvedValue({
			id: 'property-id',
			channel: { device: { hidden: false } },
		} as unknown as ChannelPropertyEntity);
		timeseries.queryTimeseriesStrict.mockResolvedValue({
			bucket: '5m',
			points: [
				{ time: '2026-08-01T00:00:00.000Z', value: 1 },
				{ time: '2026-08-01T00:05:00.000Z', value: 2 },
			],
		});

		const result = await service.getPropertyTimeseries(
			'property-id',
			'2026-08-01T00:00:00.000Z',
			'2026-08-01T01:00:00.000Z',
			'5m',
		);

		expect(result).toEqual({
			property_id: 'property-id',
			from: '2026-08-01T00:00:00.000Z',
			to: '2026-08-01T01:00:00.000Z',
			bucket: '5m',
			points: [
				{ time: '2026-08-01T00:00:00.000Z', value: 1 },
				{ time: '2026-08-01T00:05:00.000Z', value: 2 },
			],
			truncated: false,
		});
		expect(timeseries.queryTimeseriesStrict).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'property-id' }),
			new Date('2026-08-01T00:00:00.000Z'),
			new Date('2026-08-01T01:00:00.000Z'),
			'5m',
		);
	});

	it('caps returned timeseries points and reports truncation', async () => {
		properties.findOne.mockResolvedValue({
			id: 'property-id',
			channel: { device: { hidden: false } },
		} as unknown as ChannelPropertyEntity);
		timeseries.queryTimeseriesStrict.mockResolvedValue({
			bucket: '1h',
			points: Array.from({ length: 501 }, (_, index) => ({ time: index, value: index })),
		});

		const result = await service.getPropertyTimeseries(
			'property-id',
			'2026-08-01T00:00:00.000Z',
			'2026-08-14T00:00:00.000Z',
			'1h',
		);

		expect(result.points).toEqual(Array.from({ length: 500 }, (_, index) => ({ time: index, value: index })));
		expect(result.truncated).toBe(true);
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
