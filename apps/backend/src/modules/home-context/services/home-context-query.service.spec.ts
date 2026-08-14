import { Test, TestingModule } from '@nestjs/testing';

import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { DevicesService } from '../../devices/services/devices.service';
import { EnergyDataService } from '../../energy/services/energy-data.service';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SecurityService } from '../../security/services/security.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType } from '../../spaces/spaces.constants';
import { WeatherService } from '../../weather/services/weather.service';
import { HOME_CONTEXT_LIMIT_PROFILES, HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../home-context.constants';
import { HomeContextSpaceNotFoundError } from '../home-context.errors';
import { homeSnapshotQuerySchema } from '../schemas/home-context-input.schemas';
import { homeSnapshotResultSchema } from '../schemas/home-context-output.schemas';

import { HomeContextQueryService } from './home-context-query.service';

describe('HomeContextQueryService', () => {
	let service: HomeContextQueryService;
	let spaces: {
		findSummaryPage: jest.Mock;
		findOne: jest.Mock;
		findVisibleDeviceSummariesBySpace: jest.Mock;
		resolveSnapshotScope: jest.Mock;
	};
	let devices: {
		findVisibleSummaryPage: jest.Mock;
		getVisibleSpaceCounts: jest.Mock;
	};
	let connectionStates: { readLatestManyStrict: jest.Mock };
	let scenes: { findSummaryPage: jest.Mock };
	let weather: { getPrimaryWeather: jest.Mock };
	let energy: { getSummary: jest.Mock; getSpaceSummary: jest.Mock; getDeviceZoneSummary: jest.Mock };
	let security: { getBoundedStatus: jest.Mock };

	beforeEach(async () => {
		spaces = {
			findSummaryPage: jest.fn().mockResolvedValue({ spaces: [], total: 0 }),
			findOne: jest.fn().mockResolvedValue(null),
			findVisibleDeviceSummariesBySpace: jest.fn().mockResolvedValue({ devices: [], total: 0 }),
			resolveSnapshotScope: jest.fn().mockImplementation((space: SpaceEntity) =>
				Promise.resolve({
					deviceScope: { roomIds: [space.id] },
					sceneSpaceIds: [space.id],
					wholeHome: false,
				}),
			),
		};
		devices = {
			findVisibleSummaryPage: jest.fn().mockResolvedValue({ devices: [], total: 0 }),
			getVisibleSpaceCounts: jest.fn().mockResolvedValue({ rooms: {}, zones: {}, floors: {} }),
		};
		connectionStates = {
			readLatestManyStrict: jest
				.fn()
				.mockImplementation((loadedDevices: DeviceEntity[]) =>
					Promise.resolve(new Map(loadedDevices.map((device) => [device.id, device.status]))),
				),
		};
		scenes = { findSummaryPage: jest.fn().mockResolvedValue({ scenes: [], total: 0 }) };
		weather = { getPrimaryWeather: jest.fn().mockRejectedValue(new Error('weather unavailable')) };
		energy = {
			getSummary: jest.fn().mockRejectedValue(new Error('energy unavailable')),
			getSpaceSummary: jest.fn(),
			getDeviceZoneSummary: jest.fn(),
		};
		security = { getBoundedStatus: jest.fn().mockRejectedValue(new Error('security unavailable')) };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				HomeContextQueryService,
				{ provide: SpacesService, useValue: spaces },
				{ provide: DevicesService, useValue: devices },
				{ provide: DeviceConnectionStateService, useValue: connectionStates },
				{ provide: ScenesService, useValue: scenes },
				{ provide: WeatherService, useValue: weather },
				{ provide: EnergyDataService, useValue: energy },
				{ provide: SecurityService, useValue: security },
			],
		}).compile();

		service = module.get(HomeContextQueryService);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('freezes the trusted MCP compatibility profile limits', () => {
		expect(HOME_CONTEXT_LIMIT_PROFILES[HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY]).toEqual({
			spaces: 50,
			devices: 100,
			scenes: 50,
			forecastDays: 5,
			securityAlerts: 20,
			securityDevices: 100,
			securityChannelsPerDevice: 10,
			securityPropertiesPerChannel: 20,
		});
	});

	it('returns the exact whole-home composite in stable order while excluding hidden and retaining disabled entries', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-08-15T12:00:00.000Z'));
		spaces.findSummaryPage.mockResolvedValue({
			spaces: [
				{ id: 'room-1', name: 'Kitchen', type: SpaceType.ROOM, parentId: null } as unknown as SpaceEntity,
				{ id: 'room-2', name: 'Office', type: SpaceType.ROOM, parentId: null } as unknown as SpaceEntity,
			],
			total: 2,
		});
		devices.findVisibleSummaryPage.mockResolvedValue({
			devices: [
				device({ id: 'device-1', name: 'Kitchen light', roomId: 'room-1', enabled: true }),
				device({ id: 'hidden-device', name: 'Hidden sensor', roomId: 'room-1', enabled: true, hidden: true }),
				device({ id: 'device-2', name: 'Disabled plug', roomId: 'room-2', enabled: false }),
			],
			total: 2,
		});
		devices.getVisibleSpaceCounts.mockResolvedValue({
			rooms: { 'room-1': 1, 'room-2': 1 },
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
				{
					id: 'scene-2',
					name: 'Disabled scene',
					category: 'generic',
					enabled: false,
					triggerable: false,
					primarySpaceId: null,
				},
			],
			total: 2,
		});
		weather.getPrimaryWeather.mockResolvedValue({
			locationId: 'location-1',
			location: 'Prague',
			current: { temperature: 21, condition: 'clear' },
			forecast: [{ date: '2026-08-16', temperature: 23 }],
		});
		energy.getSummary.mockResolvedValue({
			totalConsumptionKwh: 12.5,
			totalProductionKwh: 3.25,
			totalGridImportKwh: 10,
			totalGridExportKwh: 0.75,
			hasGridMetrics: true,
			lastUpdatedAt: '2026-08-15T11:55:00.000Z',
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
						timestamp: '2026-08-15T11:58:00.000Z',
						acknowledged: false,
						sourceDeviceId: 'device-1',
						message: 'Motion detected',
					},
				],
				lastEvent: {
					type: 'intrusion',
					timestamp: '2026-08-15T11:58:00.000Z',
					sourceDeviceId: 'device-1',
				},
			},
			devicesTruncated: false,
			channelsTruncated: false,
			propertiesTruncated: false,
		});

		const result = await service.getHomeSnapshot({ profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY });

		expect(spaces.findSummaryPage).toHaveBeenCalledWith(51, 0);
		expect(devices.findVisibleSummaryPage).toHaveBeenCalledWith(100);
		expect(scenes.findSummaryPage).toHaveBeenCalledWith(50, undefined);
		expect(security.getBoundedStatus).toHaveBeenCalledWith(100, 10, 20, undefined);
		expect(result).toEqual({
			scope: { type: 'home' },
			spaces: [
				{ id: 'room-1', name: 'Kitchen', type: SpaceType.ROOM, parent_id: null, device_count: 1 },
				{ id: 'room-2', name: 'Office', type: SpaceType.ROOM, parent_id: null, device_count: 1 },
			],
			devices: [
				{
					id: 'device-1',
					name: 'Kitchen light',
					category: 'lighting',
					enabled: true,
					room_id: 'room-1',
					zone_ids: ['zone-1'],
					status: { online: true, state: 'connected', last_changed: '2026-08-15T12:00:00.000Z' },
				},
				{
					id: 'device-2',
					name: 'Disabled plug',
					category: 'lighting',
					enabled: false,
					room_id: 'room-2',
					zone_ids: ['zone-1'],
					status: { online: true, state: 'connected', last_changed: '2026-08-15T12:00:00.000Z' },
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
				{
					id: 'scene-2',
					name: 'Disabled scene',
					category: 'generic',
					enabled: false,
					triggerable: false,
					primary_space_id: null,
				},
			],
			weather: {
				location_id: 'location-1',
				location: 'Prague',
				current: { temperature: 21, condition: 'clear' },
				forecast: [{ date: '2026-08-16', temperature: 23 }],
			},
			energy: {
				scope: { type: 'home' },
				from: '2026-08-14T12:00:00.000Z',
				to: '2026-08-15T12:00:00.000Z',
				totalConsumptionKwh: 12.5,
				totalProductionKwh: 3.25,
				totalGridImportKwh: 10,
				totalGridExportKwh: 0.75,
				hasGridMetrics: true,
				lastUpdatedAt: '2026-08-15T11:55:00.000Z',
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
						timestamp: '2026-08-15T11:58:00.000Z',
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
					timestamp: '2026-08-15T11:58:00.000Z',
					sourceDeviceId: 'device-1',
				},
			},
			limits: { spaces_truncated: false, devices_truncated: false, scenes_truncated: false },
		});
		expect(homeSnapshotResultSchema.safeParse(result).success).toBe(true);
	});

	it('returns the exact scoped composite and forwards the literal MCP profile bounds', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-08-15T12:00:00.000Z'));
		const selectedSpace = {
			id: 'room-1',
			name: 'Kitchen',
			type: SpaceType.ROOM,
			parentId: null,
		} as unknown as SpaceEntity;
		spaces.findOne.mockResolvedValue(selectedSpace);
		spaces.resolveSnapshotScope.mockResolvedValue({
			deviceScope: { roomIds: ['room-1'] },
			sceneSpaceIds: ['room-1'],
			wholeHome: false,
		});
		spaces.findVisibleDeviceSummariesBySpace.mockResolvedValue({
			devices: [device({ id: 'device-1', name: 'Disabled lamp', roomId: 'room-1', enabled: false })],
			total: 1,
		});
		weather.getPrimaryWeather.mockResolvedValue({
			locationId: 'location-1',
			location: 'Prague',
			current: { temperature: 21 },
			forecast: [],
		});
		energy.getSpaceSummary.mockResolvedValue({
			totalConsumptionKwh: 4,
			totalProductionKwh: 1,
			totalGridImportKwh: 3.5,
			totalGridExportKwh: 0.5,
			netKwh: 3,
			netGridKwh: 3,
			hasGridMetrics: true,
			lastUpdatedAt: '2026-08-15T11:55:00.000Z',
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

		const result = await service.getHomeSnapshot({
			profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
			spaceId: 'room-1',
		});

		expect(spaces.findVisibleDeviceSummariesBySpace).toHaveBeenCalledWith('room-1', 100);
		expect(scenes.findSummaryPage).toHaveBeenCalledWith(50, ['room-1']);
		expect(security.getBoundedStatus).toHaveBeenCalledWith(100, 10, 20, { roomIds: ['room-1'] });
		expect(result).toEqual({
			scope: { type: 'space', id: 'room-1', name: 'Kitchen' },
			spaces: [{ id: 'room-1', name: 'Kitchen', type: SpaceType.ROOM, parent_id: null, device_count: 1 }],
			devices: [
				{
					id: 'device-1',
					name: 'Disabled lamp',
					category: 'lighting',
					enabled: false,
					room_id: 'room-1',
					zone_ids: ['zone-1'],
					status: { online: true, state: 'connected', last_changed: '2026-08-15T12:00:00.000Z' },
				},
			],
			scenes: [],
			weather: {
				location_id: 'location-1',
				location: 'Prague',
				current: { temperature: 21 },
				forecast: [],
			},
			energy: {
				scope: { type: 'space', id: 'room-1' },
				from: '2026-08-14T12:00:00.000Z',
				to: '2026-08-15T12:00:00.000Z',
				totalConsumptionKwh: 4,
				totalProductionKwh: 1,
				totalGridImportKwh: 3.5,
				totalGridExportKwh: 0.5,
				netKwh: 3,
				netGridKwh: 3,
				hasGridMetrics: true,
				lastUpdatedAt: '2026-08-15T11:55:00.000Z',
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
		expect(homeSnapshotResultSchema.safeParse(result).success).toBe(true);
	});

	it('normalizes unavailable optional domains to null', async () => {
		await expect(service.getHomeSnapshot({ profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY })).resolves.toEqual({
			scope: { type: 'home' },
			spaces: [],
			devices: [],
			scenes: [],
			weather: null,
			energy: null,
			security: null,
			limits: { spaces_truncated: false, devices_truncated: false, scenes_truncated: false },
		});
	});

	it('throws the typed shared error when a requested space does not exist', async () => {
		await expect(
			service.getHomeSnapshot({
				profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
				spaceId: 'missing-space',
			}),
		).rejects.toBeInstanceOf(HomeContextSpaceNotFoundError);
		expect(spaces.resolveSnapshotScope).not.toHaveBeenCalled();
		expect(spaces.findVisibleDeviceSummariesBySpace).not.toHaveBeenCalled();
	});

	it('validates the closed trusted input profile and exact output shape', () => {
		expect(
			homeSnapshotQuerySchema.safeParse({ profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY, spaceId: 'room-1' }).success,
		).toBe(true);
		expect(
			homeSnapshotQuerySchema.safeParse({ profile: HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY, spaceId: '' }).success,
		).toBe(false);
		expect(homeSnapshotQuerySchema.safeParse({ profile: 'client-selected', spaces: 10_000 }).success).toBe(false);
		expect(
			homeSnapshotResultSchema.safeParse({
				scope: { type: 'home' },
				spaces: [],
				devices: [],
				scenes: [],
				weather: null,
				energy: null,
				security: null,
				limits: { spaces_truncated: false, devices_truncated: false, scenes_truncated: false },
			}).success,
		).toBe(true);
		expect(
			homeSnapshotResultSchema.safeParse({
				scope: { type: 'home' },
				spaces: [],
				devices: [],
				scenes: [],
				weather: null,
				energy: {
					scope: { type: 'home' },
					from: '2026-08-14T12:00:00.000Z',
					to: '2026-08-15T12:00:00.000Z',
				},
				security: null,
				limits: { spaces_truncated: false, devices_truncated: false, scenes_truncated: false },
			}).success,
		).toBe(false);
		expect(homeSnapshotResultSchema.safeParse({ scope: { type: 'home' } }).success).toBe(false);
	});

	function device(options: {
		id: string;
		name: string;
		roomId: string;
		enabled: boolean;
		hidden?: boolean;
	}): DeviceEntity {
		return {
			id: options.id,
			name: options.name,
			category: 'lighting',
			enabled: options.enabled,
			hidden: options.hidden ?? false,
			roomId: options.roomId,
			zoneIds: ['zone-1'],
			status: {
				online: true,
				status: 'connected',
				lastChanged: new Date('2026-08-15T12:00:00.000Z'),
			},
		} as unknown as DeviceEntity;
	}
});
