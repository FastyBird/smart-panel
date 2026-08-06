import { ConfigService } from '../../config/services/config.service';
import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { DevicesService } from '../../devices/services/devices.service';
import { PropertyTimeseriesService } from '../../devices/services/property-timeseries.service';
import { EnergyDataService } from '../../energy/services/energy-data.service';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SecurityService } from '../../security/services/security.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { WeatherService } from '../../weather/services/weather.service';
import { MCP_MAX_CONTEXT_DEVICES, McpCapability } from '../mcp.constants';

import { McpContextService } from './mcp-context.service';
import { McpInstallationService } from './mcp-installation.service';

describe('McpContextService', () => {
	let service: McpContextService;
	let spaces: { findAll: jest.Mock; findOne: jest.Mock; findDevicesBySpace: jest.Mock };
	let devices: { findAll: jest.Mock; findOne: jest.Mock };
	let properties: { findOne: jest.Mock };
	let timeseries: { queryTimeseries: jest.Mock };
	let scenes: { findAll: jest.Mock; findBySpace: jest.Mock };
	let weather: { getPrimaryWeather: jest.Mock; getWeather: jest.Mock };
	let energy: { getSummary: jest.Mock; getSpaceSummary: jest.Mock };
	let security: { getStatus: jest.Mock };

	beforeEach(() => {
		spaces = {
			findAll: jest.fn().mockResolvedValue([]),
			findOne: jest.fn().mockResolvedValue(null),
			findDevicesBySpace: jest.fn().mockResolvedValue([]),
		};
		devices = {
			findAll: jest.fn().mockResolvedValue([]),
			findOne: jest.fn().mockResolvedValue(null),
		};
		properties = { findOne: jest.fn().mockResolvedValue(null) };
		timeseries = { queryTimeseries: jest.fn() };
		scenes = {
			findAll: jest.fn().mockResolvedValue([]),
			findBySpace: jest.fn().mockResolvedValue([]),
		};
		weather = {
			getPrimaryWeather: jest.fn().mockRejectedValue(new Error('weather unavailable')),
			getWeather: jest.fn(),
		};
		energy = {
			getSummary: jest.fn().mockRejectedValue(new Error('energy unavailable')),
			getSpaceSummary: jest.fn(),
		};
		security = { getStatus: jest.fn().mockRejectedValue(new Error('security unavailable')) };

		service = new McpContextService(
			{ getModuleConfig: jest.fn(() => ({ timezone: 'Europe/Prague' })) } as unknown as ConfigService,
			{ getInstallationId: jest.fn().mockResolvedValue('installation-id') } as unknown as McpInstallationService,
			spaces as unknown as SpacesService,
			devices as unknown as DevicesService,
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
		devices.findAll.mockResolvedValue(
			Array.from({ length: MCP_MAX_CONTEXT_DEVICES + 2 }, (_, index) => ({
				id: `device-${index}`,
				name: `Device ${index}`,
				category: 'generic',
				enabled: true,
				hidden: false,
				roomId: null,
				zoneIds: [],
				status: { online: true, status: 'connected', lastChanged: null },
			})),
		);

		const result = await service.getHomeContext();

		expect(result.devices).toHaveLength(MCP_MAX_CONTEXT_DEVICES);
		expect(result.weather).toBeNull();
		expect(result.energy).toBeNull();
		expect(result.security).toBeNull();
		expect(result.limits).toEqual(expect.objectContaining({ devices_truncated: true }));
	});

	it('maps current values only for a requested visible device', async () => {
		devices.findOne.mockResolvedValue({
			id: 'device-id',
			name: 'Lamp',
			category: 'lighting',
			enabled: true,
			hidden: false,
			roomId: 'room-id',
			zoneIds: [],
			status: { online: true, status: 'connected', lastChanged: new Date('2026-08-06T12:00:00Z') },
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
							dataType: 'uchar',
							unit: '%',
							value: { value: 50, lastUpdated: '2026-08-06T12:00:00Z', trend: 'stable' },
						},
					],
				},
			],
		} as unknown as DeviceEntity);

		const result = await service.getDeviceState('device-id');

		expect(result).toEqual(
			expect.objectContaining({
				id: 'device-id',
				channels: [
					expect.objectContaining({
						properties: [expect.objectContaining({ id: 'property-id', value: 50, trend: 'stable' })],
					}),
				],
			}),
		);
	});

	it('rejects a timeseries bucket that could exceed the result cap before querying storage', async () => {
		await expect(
			service.getPropertyTimeseries('property-id', '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z', '1m'),
		).rejects.toThrow('would exceed');
		expect(properties.findOne).not.toHaveBeenCalled();
		expect(timeseries.queryTimeseries).not.toHaveBeenCalled();
	});

	it('returns bounded property history for a visible device', async () => {
		properties.findOne.mockResolvedValue({
			id: 'property-id',
			channel: { device: { hidden: false } },
		} as unknown as ChannelPropertyEntity);
		timeseries.queryTimeseries.mockResolvedValue({
			bucket: '5m',
			points: [{ time: '2026-08-01T00:00:00.000Z', value: 1 }],
		});

		await expect(
			service.getPropertyTimeseries('property-id', '2026-08-01T00:00:00.000Z', '2026-08-01T01:00:00.000Z', '5m'),
		).resolves.toEqual(expect.objectContaining({ property_id: 'property-id', bucket: '5m', truncated: false }));
	});
});
