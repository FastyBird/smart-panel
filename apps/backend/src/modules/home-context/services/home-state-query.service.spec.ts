import { Test, TestingModule } from '@nestjs/testing';

import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { ChannelsService } from '../../devices/services/channels.service';
import { DeviceConnectionStateService } from '../../devices/services/device-connection-state.service';
import { DevicesService } from '../../devices/services/devices.service';
import { PropertyTimeseriesService } from '../../devices/services/property-timeseries.service';
import { EnergyDataService } from '../../energy/services/energy-data.service';
import { SecurityService } from '../../security/services/security.service';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpacesService } from '../../spaces/services/spaces.service';
import { SpaceType, SpaceZoneCategory } from '../../spaces/spaces.constants';
import { WeatherService } from '../../weather/services/weather.service';
import { HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY } from '../home-context.constants';
import { HomeContextSpaceNotFoundError } from '../home-context.errors';
import {
	HomeStateDeviceNotFoundError,
	HomeStateInvalidRangeError,
	HomeStatePropertyNotFoundError,
	HomeStateTimeseriesPointLimitError,
} from '../home-state.errors';
import { homeDeviceStateResultSchema } from '../schemas/home-state-output.schemas';

import { HomeStateQueryService } from './home-state-query.service';

const profile = HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY;

describe('HomeStateQueryService', () => {
	let service: HomeStateQueryService;
	let spaces: { findOne: jest.Mock };
	let devices: { findVisibleSummaryById: jest.Mock };
	let connectionStates: { readLatestManyStrict: jest.Mock };
	let channels: { findSummaryPage: jest.Mock };
	let properties: { findOne: jest.Mock; findBoundedForChannels: jest.Mock };
	let timeseries: { queryTimeseriesStrict: jest.Mock };
	let weather: { getPrimaryWeather: jest.Mock; getWeather: jest.Mock };
	let energy: { getSummary: jest.Mock; getSpaceSummary: jest.Mock; getDeviceZoneSummary: jest.Mock };
	let security: { getBoundedStatus: jest.Mock };

	beforeEach(async () => {
		spaces = { findOne: jest.fn().mockResolvedValue(null) };
		devices = { findVisibleSummaryById: jest.fn().mockResolvedValue(null) };
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
		weather = { getPrimaryWeather: jest.fn(), getWeather: jest.fn() };
		energy = { getSummary: jest.fn(), getSpaceSummary: jest.fn(), getDeviceZoneSummary: jest.fn() };
		security = { getBoundedStatus: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				HomeStateQueryService,
				{ provide: SpacesService, useValue: spaces },
				{ provide: DevicesService, useValue: devices },
				{ provide: DeviceConnectionStateService, useValue: connectionStates },
				{ provide: ChannelsService, useValue: channels },
				{ provide: ChannelsPropertiesService, useValue: properties },
				{ provide: PropertyTimeseriesService, useValue: timeseries },
				{ provide: WeatherService, useValue: weather },
				{ provide: EnergyDataService, useValue: energy },
				{ provide: SecurityService, useValue: security },
			],
		}).compile();

		service = module.get(HomeStateQueryService);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('returns the exact bounded state for a disabled visible device', async () => {
		const device = {
			id: 'device-id',
			name: 'Lamp',
			category: 'lighting',
			enabled: false,
			hidden: false,
			roomId: 'room-id',
			zoneIds: ['zone-id'],
			status: { online: true, status: 'connected', lastChanged: new Date('2026-08-15T12:00:00.000Z') },
		} as unknown as DeviceEntity;
		devices.findVisibleSummaryById.mockResolvedValue(device);
		channels.findSummaryPage.mockResolvedValue({
			channels: [{ id: 'channel-id', name: 'Light', category: 'light' }],
			total: 21,
		});
		properties.findBoundedForChannels.mockResolvedValue({
			properties: [
				{
					id: 'property-id',
					name: null,
					category: 'brightness',
					dataType: 'uchar',
					unit: '%',
					value: { value: 50, lastUpdated: '2026-08-15T12:00:00.000Z', trend: 'stable' },
					channel: { id: 'channel-id' },
				},
			],
			totals: { 'channel-id': 41 },
		});

		const result = await service.getDeviceState({ deviceId: 'device-id', profile });

		expect(channels.findSummaryPage).toHaveBeenCalledWith('device-id', 20);
		expect(properties.findBoundedForChannels).toHaveBeenCalledWith(['channel-id'], 40, true);
		expect(result).toEqual({
			id: 'device-id',
			name: 'Lamp',
			category: 'lighting',
			enabled: false,
			room_id: 'room-id',
			zone_ids: ['zone-id'],
			status: { online: true, state: 'connected', last_changed: '2026-08-15T12:00:00.000Z' },
			channels: [
				{
					id: 'channel-id',
					name: 'Light',
					category: 'light',
					properties: [
						{
							id: 'property-id',
							name: null,
							category: 'brightness',
							data_type: 'uchar',
							unit: '%',
							value: 50,
							last_updated: '2026-08-15T12:00:00.000Z',
							trend: 'stable',
						},
					],
					properties_truncated: true,
				},
			],
			channels_truncated: true,
		});
	});

	it('uses typed device-not-found errors and propagates strict status failures', async () => {
		await expect(service.getDeviceState({ deviceId: 'missing', profile })).rejects.toEqual(
			expect.objectContaining({ constructor: HomeStateDeviceNotFoundError, deviceId: 'missing' }),
		);
		devices.findVisibleSummaryById.mockResolvedValue({ id: 'device-id', hidden: false } as DeviceEntity);
		const storageError = new Error('status storage unavailable');
		connectionStates.readLatestManyStrict.mockRejectedValue(storageError);

		await expect(service.getDeviceState({ deviceId: 'device-id', profile })).rejects.toBe(storageError);
		expect(channels.findSummaryPage).not.toHaveBeenCalled();
	});

	it('validates timeseries ranges and point limits before property lookup', async () => {
		await expect(
			service.getPropertyTimeseries({
				propertyId: 'property-id',
				from: 'invalid',
				to: '2026-08-15T00:00:00.000Z',
				bucket: '1h',
				profile,
			}),
		).rejects.toEqual(
			expect.objectContaining({
				constructor: HomeStateInvalidRangeError,
				domain: 'timeseries',
				reason: 'invalid_or_non_ascending',
			}),
		);
		await expect(
			service.getPropertyTimeseries({
				propertyId: 'property-id',
				from: '2026-08-01T00:00:00.000Z',
				to: '2026-08-02T00:00:00.000Z',
				bucket: '1m',
				profile,
			}),
		).rejects.toEqual(expect.objectContaining({ constructor: HomeStateTimeseriesPointLimitError, maxPoints: 500 }));
		expect(properties.findOne).not.toHaveBeenCalled();
	});

	it('accepts exactly 500 projected timeseries points and rejects 501 before another lookup', async () => {
		const property = {
			id: 'property-id',
			channel: { device: { hidden: false } },
		} as unknown as ChannelPropertyEntity;
		properties.findOne.mockResolvedValue(property);
		timeseries.queryTimeseriesStrict.mockResolvedValue({ bucket: '1m', points: [] });

		await expect(
			service.getPropertyTimeseries({
				propertyId: 'property-id',
				from: '2026-08-01T00:00:00.000Z',
				to: '2026-08-01T08:20:00.000Z',
				bucket: '1m',
				profile,
			}),
		).resolves.toEqual(expect.objectContaining({ property_id: 'property-id', truncated: false }));

		await expect(
			service.getPropertyTimeseries({
				propertyId: 'property-id',
				from: '2026-08-01T00:00:00.000Z',
				to: '2026-08-01T08:21:00.000Z',
				bucket: '1m',
				profile,
			}),
		).rejects.toEqual(expect.objectContaining({ constructor: HomeStateTimeseriesPointLimitError, maxPoints: 500 }));
		expect(properties.findOne).toHaveBeenCalledTimes(1);
		expect(timeseries.queryTimeseriesStrict).toHaveBeenCalledTimes(1);
	});

	it('rejects hidden property owners and preserves strict storage failures', async () => {
		properties.findOne.mockResolvedValue({
			id: 'property-id',
			channel: { device: { hidden: true } },
		} as unknown as ChannelPropertyEntity);

		await expect(
			service.getPropertyTimeseries({
				propertyId: 'property-id',
				from: '2026-08-01T00:00:00.000Z',
				to: '2026-08-02T00:00:00.000Z',
				bucket: '1h',
				profile,
			}),
		).rejects.toEqual(
			expect.objectContaining({ constructor: HomeStatePropertyNotFoundError, propertyId: 'property-id' }),
		);
		expect(timeseries.queryTimeseriesStrict).not.toHaveBeenCalled();

		properties.findOne.mockResolvedValue({
			id: 'property-id',
			channel: { device: { hidden: false } },
		} as unknown as ChannelPropertyEntity);
		const storageError = new Error('storage unavailable');
		timeseries.queryTimeseriesStrict.mockRejectedValue(storageError);

		await expect(
			service.getPropertyTimeseries({
				propertyId: 'property-id',
				from: '2026-08-01T00:00:00.000Z',
				to: '2026-08-02T00:00:00.000Z',
				bucket: '1h',
				profile,
			}),
		).rejects.toBe(storageError);
	});

	it('retains the first 500 ordered timeseries points and validates the original result', async () => {
		const property = {
			id: 'property-id',
			channel: { device: { hidden: false } },
		} as unknown as ChannelPropertyEntity;
		const sourcePoints = Array.from({ length: 501 }, (_, index) => ({
			time: new Date(index * 60_000).toISOString(),
			value: index,
		}));
		properties.findOne.mockResolvedValue(property);
		timeseries.queryTimeseriesStrict.mockResolvedValue({ bucket: '1h', points: sourcePoints });

		const result = await service.getPropertyTimeseries({
			propertyId: 'property-id',
			from: '2026-08-01T00:00:00.000Z',
			to: '2026-08-14T00:00:00.000Z',
			bucket: '1h',
			profile,
		});

		expect(result.points).toEqual(sourcePoints.slice(0, 500));
		expect(result.truncated).toBe(true);
		expect(timeseries.queryTimeseriesStrict).toHaveBeenCalledWith(
			property,
			new Date('2026-08-01T00:00:00.000Z'),
			new Date('2026-08-14T00:00:00.000Z'),
			'1h',
		);
	});

	it('maps an exact 31-day home energy range and rejects a longer range', async () => {
		const summary = {
			totalConsumptionKwh: 12.5,
			totalProductionKwh: 3.25,
			totalGridImportKwh: 10,
			totalGridExportKwh: 0.75,
			hasGridMetrics: true,
			lastUpdatedAt: '2026-01-31T23:55:00.000Z',
		};
		energy.getSummary.mockResolvedValue(summary);
		const from = '2026-01-01T00:00:00.000Z';
		const to = '2026-02-01T00:00:00.000Z';

		await expect(service.getEnergySummary({ from, to, profile })).resolves.toEqual({
			scope: { type: 'home' },
			from,
			to,
			...summary,
		});
		expect(energy.getSummary).toHaveBeenCalledWith(new Date(from), new Date(to));
		await expect(service.getEnergySummary({ from, to: '2026-02-01T00:00:00.001Z', profile })).rejects.toEqual(
			expect.objectContaining({
				constructor: HomeStateInvalidRangeError,
				domain: 'energy',
				reason: 'max_days_exceeded',
				maxDays: 31,
			}),
		);
		expect(energy.getSummary).toHaveBeenCalledTimes(1);
	});

	it('resolves an energy space before validation and preserves zone and master routing', async () => {
		await expect(
			service.getEnergySummary({ from: 'invalid', to: 'invalid', spaceId: 'missing', profile }),
		).rejects.toEqual(expect.objectContaining({ constructor: HomeContextSpaceNotFoundError, spaceId: 'missing' }));

		spaces.findOne.mockResolvedValue({
			id: 'zone-id',
			type: SpaceType.ZONE,
			category: SpaceZoneCategory.OUTDOOR_GARDEN,
		} as unknown as SpaceEntity);
		energy.getDeviceZoneSummary.mockResolvedValue({
			totalConsumptionKwh: 2,
			totalProductionKwh: 0,
			totalGridImportKwh: 2,
			totalGridExportKwh: 0,
			netKwh: 2,
			netGridKwh: 2,
			hasGridMetrics: true,
			lastUpdatedAt: null,
		});
		await service.getEnergySummary({
			from: '2026-08-01T00:00:00.000Z',
			to: '2026-08-02T00:00:00.000Z',
			spaceId: 'zone-id',
			profile,
		});
		expect(energy.getDeviceZoneSummary).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 'zone-id');

		spaces.findOne.mockResolvedValue({ id: 'master-id', type: SpaceType.MASTER } as SpaceEntity);
		energy.getSummary.mockResolvedValue({
			totalConsumptionKwh: 8,
			totalProductionKwh: 0,
			totalGridImportKwh: 8,
			totalGridExportKwh: 0,
			hasGridMetrics: true,
			lastUpdatedAt: null,
		});
		await expect(
			service.getEnergySummary({
				from: '2026-08-01T00:00:00.000Z',
				to: '2026-08-02T00:00:00.000Z',
				spaceId: 'master-id',
				profile,
			}),
		).resolves.toEqual(expect.objectContaining({ scope: { type: 'space', id: 'master-id' } }));
	});

	it('selects explicit or primary weather and retains the first five forecast entries', async () => {
		const current = { temperature: 21 };
		const forecast = Array.from({ length: 7 }, (_, index) => ({ day: index }));
		const weatherResult = { locationId: 'location-id', location: 'Prague', current, forecast };
		weather.getPrimaryWeather.mockResolvedValue(weatherResult);
		weather.getWeather.mockResolvedValue(weatherResult);

		const primary = await service.getWeather({ profile });
		const explicit = await service.getWeather({ locationId: 'location-id', profile });

		expect(primary.forecast).toEqual(forecast.slice(0, 5));
		expect(primary.current).toBe(current);
		expect(explicit).toEqual(primary);
		expect(weather.getPrimaryWeather).toHaveBeenCalledTimes(1);
		expect(weather.getWeather).toHaveBeenCalledWith('location-id');
	});

	it('returns the first 20 mapped security alerts and independent truncation flags', async () => {
		const activeAlerts = Array.from({ length: 23 }, (_, index) => ({
			id: `alert-${index}`,
			type: 'intrusion',
			severity: 'warning',
			timestamp: `2026-08-15T12:${String(index).padStart(2, '0')}:00.000Z`,
			acknowledged: false,
			sourceDeviceId: `device-${index}`,
			message: `Alert ${index}`,
		}));
		security.getBoundedStatus.mockResolvedValue({
			status: {
				armedState: 'armed_away',
				alarmState: 'idle',
				highestSeverity: 'warning',
				activeAlertsCount: 23,
				hasCriticalAlert: false,
				activeAlerts,
				lastEvent: { type: 'intrusion', timestamp: activeAlerts[0].timestamp, sourceDeviceId: 'device-0' },
			},
			devicesTruncated: false,
			channelsTruncated: true,
			propertiesTruncated: false,
		});

		const result = await service.getSecurityStatus({ profile });

		expect(security.getBoundedStatus).toHaveBeenCalledWith(100, 10, 20);
		expect(result.active_alerts.map((alert) => alert.id)).toEqual(
			Array.from({ length: 20 }, (_, index) => `alert-${index}`),
		);
		expect(result).toEqual(
			expect.objectContaining({
				active_alerts_count: 23,
				alerts_truncated: true,
				devices_truncated: false,
				channels_truncated: true,
				properties_truncated: false,
				state_truncated: true,
			}),
		);
	});

	it('rejects malformed output schemas without replacing valid result objects', () => {
		const result = {
			id: 'device-id',
			name: 'Lamp',
			category: 'lighting',
			enabled: true,
			room_id: null,
			zone_ids: [],
			status: { online: true, state: 'connected', last_changed: null },
			channels: [],
			channels_truncated: false,
		};

		expect(homeDeviceStateResultSchema.parse(result)).toEqual(result);
		expect(() => homeDeviceStateResultSchema.parse({ ...result, enabled: 'yes' })).toThrow();
	});
});
