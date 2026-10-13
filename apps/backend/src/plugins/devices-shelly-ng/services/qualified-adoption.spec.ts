import { ShellyPlus1Pm } from 'shellies-ds9';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceValidationService } from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { getPropertyMetadata, getRequiredProperties } from '../../../modules/devices/utils/schema.utils';
import { nativeTemperatureIdentity } from '../contracts/native-temperature.contract';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';
import { MappingLoaderService, PropertyMappingStorageService, TransformerRegistry } from '../mappings';

import { DeviceAddressService } from './device-address.service';
import { DeviceManagerService } from './device-manager.service';
import { ShellyRpcClientService } from './shelly-rpc-client.service';
import { ShellySampleSourcesService } from './shelly-sample-sources.service';

/** Real discovery/adoption/RPC serialization, with fixture HTTP and persistence only. */
describe('native temperature adoption identity', () => {
	let componentKey: string;
	let sourceConfig: Record<string, unknown>;
	let sourceStatus: Record<string, unknown>;
	let peripherals: Record<string, unknown>;
	let channels: ShellyNgChannelEntity[];
	let properties: { channel: string; category: PropertyCategory; identifier?: string; value?: unknown }[];
	let service: DeviceManagerService;
	let removed: jest.Mock;
	let bindSource: jest.Mock;
	let invalidateSource: jest.Mock;

	beforeEach(() => {
		componentKey = 'input:100';
		sourceConfig = {
			id: 100,
			type: 'analog',
			enable: true,
			range_map: [0, 100],
			xpercent: { expr: 'x/2', unit: '°C' },
		};
		sourceStatus = { id: 100, percent: 50, xpercent: 25 };
		peripherals = { analog_in: { 'input:100': { io: 0 } } };
		channels = [];
		properties = [];
		removed = jest.fn();
		bindSource = jest.fn().mockResolvedValue({});
		invalidateSource = jest.fn().mockResolvedValue(undefined);
		const device = Object.assign(new ShellyNgDeviceEntity(), {
			id: 'pilot',
			identifier: 'physical',
			hasEthernet: false,
		});
		jest.spyOn(globalThis, 'fetch').mockImplementation((_url, request) => {
			const body = JSON.parse(request.body as string) as { method: string; params?: { id?: number } };
			const payloads: Record<string, unknown> = {
				'Shelly.GetDeviceInfo': { id: device.identifier, model: ShellyPlus1Pm.model, ver: 'fixture-only' },
				'Shelly.GetComponents': { components: [{ key: componentKey }], offset: 0, total: 1 },
				'Sys.GetConfig': { device: { name: 'floor fixture' } },
				'WiFi.GetStatus': { rssi: -50 },
				'Input.GetConfig': sourceConfig,
				'Input.GetStatus': sourceStatus,
				'Voltmeter.GetConfig': sourceConfig,
				'Temperature.GetConfig': sourceConfig,
				'Temperature.GetStatus': sourceStatus,
				'SensorAddon.GetPeripherals': peripherals,
			};
			if (!Object.hasOwn(payloads, body.method)) throw new Error(`Unexpected fixture RPC ${body.method}`);
			return Promise.resolve(new Response(JSON.stringify({ result: payloads[body.method] })));
		});
		service = new DeviceManagerService(
			new ShellyRpcClientService(),
			{ findOne: () => Promise.resolve(device) } as unknown as DevicesService,
			{
				findOneBy: (_field: string, identifier: string) =>
					Promise.resolve(channels.find((channel) => channel.identifier === identifier) ?? null),
				create: (data: { category: ChannelCategory; identifier?: string }) => {
					const channel = Object.assign(
						new ShellyNgChannelEntity(),
						{ category: data.category, identifier: data.identifier },
						{
							id: `channel-${channels.length}`,
							device,
						},
					);
					channels.push(channel);
					return Promise.resolve(channel);
				},
				update: (id: string) => Promise.resolve(channels.find((channel) => channel.id === id)),
				findAll: () => Promise.resolve(channels),
				remove: removed,
			} as unknown as ChannelsService,
			{
				findOneBy: () => Promise.resolve(null),
				findAll: () => Promise.resolve([]),
				create: (channel: string, data: { category: PropertyCategory; identifier?: string; value?: unknown }) => {
					properties.push({ channel, ...data });
					return Promise.resolve(
						Object.assign(
							new ShellyNgChannelPropertyEntity(),
							{ category: data.category, identifier: data.identifier },
							{ id: `property-${properties.length}` },
						),
					);
				},
			} as unknown as ChannelsPropertiesService,
			{ findMatchingMapping: () => null } as unknown as MappingLoaderService,
			{} as TransformerRegistry,
			{} as PropertyMappingStorageService,
			{
				enqueue: (_id: string, task: () => Promise<ShellyNgDeviceEntity>) => task(),
			} as unknown as ConstructorParameters<typeof DeviceManagerService>[7],
			{ getPreferredAddressOrMigrate: () => Promise.resolve('fixture.invalid') } as unknown as DeviceAddressService,
			{ bind: bindSource, invalidateComponent: invalidateSource } as unknown as ShellySampleSourcesService,
		);
	});
	afterEach(() => jest.restoreAllMocks());

	it.each([25, null, undefined])(
		'creates a separate canonical temperature for configured helper %s without raw fallback',
		async (xpercent) => {
			sourceStatus.xpercent = xpercent;
			await service.createOrUpdate('pilot');
			const identity = nativeTemperatureIdentity(componentKey, sourceConfig, peripherals);
			const canonical = channels.find((channel) => channel.identifier === identity.channelIdentifier);
			expect(bindSource).toHaveBeenCalledWith(
				expect.any(String),
				'pilot',
				expect.objectContaining({
					unit: '°C',
					expression: 'x/2',
					componentKey: 'input:100',
					fingerprint: identity.fingerprint,
				}),
			);
			expect(canonical.category).toBe(ChannelCategory.TEMPERATURE);
			expect(properties).toContainEqual(
				expect.objectContaining({
					channel: canonical.id,
					category: PropertyCategory.TEMPERATURE,
					identifier: 'xpercent',
					value: undefined,
				}),
			);
			const analog = channels.find((channel) => channel.identifier === componentKey);
			expect(properties).toContainEqual(
				expect.objectContaining({
					channel: analog.id,
					category: PropertyCategory.VALUE,
					value: typeof xpercent === 'number' ? 25 : undefined,
				}),
			);
			expect(properties).toContainEqual(
				expect.objectContaining({ channel: analog.id, category: PropertyCategory.UNIT, value: '°C' }),
			);
		},
	);

	it('keeps the old helper channel and alias identity/history when config changes', async () => {
		await service.createOrUpdate('pilot');
		const oldIdentity = nativeTemperatureIdentity(componentKey, sourceConfig, peripherals).channelIdentifier;
		sourceConfig = { ...sourceConfig, xpercent: { expr: 'x/3', unit: '°C' } };
		await service.createOrUpdate('pilot');
		const newIdentity = nativeTemperatureIdentity(componentKey, sourceConfig, peripherals).channelIdentifier;
		expect(channels.map((channel) => channel.identifier)).toEqual(expect.arrayContaining([oldIdentity, newIdentity]));
		expect(removed).not.toHaveBeenCalledWith(channels.find((channel) => channel.identifier === oldIdentity).id);
	});

	it('adopts dynamic Voltmeter native Celsius without assuming Gen2 Plus Number components', async () => {
		componentKey = 'voltmeter:100';
		sourceConfig = { id: 100, xvoltage: { expr: 'x/2', unit: '°C' } };
		peripherals = { voltmeter: { 'voltmeter:100': { io: 0 } } };
		await service.createOrUpdate('pilot');
		const identity = nativeTemperatureIdentity(componentKey, sourceConfig, peripherals);
		expect(channels).toContainEqual(
			expect.objectContaining({ identifier: identity.channelIdentifier, category: ChannelCategory.TEMPERATURE }),
		);
		expect(properties).toContainEqual(expect.objectContaining({ identifier: 'xvoltage', value: undefined }));
	});

	it('binds dynamic temperature to a physical probe address, and declines absent peripheral evidence', async () => {
		componentKey = 'temperature:100';
		sourceConfig = { id: 100, name: 'floor', offset: 0 };
		sourceStatus = { id: 100, tC: 25 };
		peripherals = { ds18b20: { 'temperature:100': { addr: '40:255:100:6:199:204:149:177' } } };
		await service.createOrUpdate('pilot');
		expect(channels).toContainEqual(
			expect.objectContaining({
				identifier: nativeTemperatureIdentity(componentKey, sourceConfig, peripherals).channelIdentifier,
			}),
		);
		channels = [];
		properties = [];
		peripherals = {};
		await service.createOrUpdate('pilot');
		expect(channels.some((channel) => channel.identifier?.startsWith('probe-temperature:'))).toBe(false);
		expect(channels.some((channel) => channel.identifier === 'temperature:100')).toBe(true);
	});
	it.each([
		[DeviceCategory.OUTLET, ChannelCategory.OUTLET],
		[DeviceCategory.SWITCHER, ChannelCategory.SWITCHER],
		[DeviceCategory.LIGHTING, ChannelCategory.LIGHT],
	])('validates multiple canonical sensor channels on supported host category %s', (category, controlCategory) => {
		const channel = (channelCategory: ChannelCategory) => ({
			category: channelCategory,
			properties: getRequiredProperties(channelCategory).map((propertyCategory) => {
				const metadata = getPropertyMetadata(channelCategory, propertyCategory);
				return { category: propertyCategory, dataType: metadata.data_type, permissions: metadata.permissions };
			}),
		});
		const validator = new DeviceValidationService({} as DevicesService);
		const result = validator.validateDeviceStructure({
			category,
			channels: [
				channel(controlCategory),
				channel(ChannelCategory.DEVICE_INFORMATION),
				channel(ChannelCategory.TEMPERATURE),
				channel(ChannelCategory.TEMPERATURE),
			],
		});
		expect(result.issues).toEqual([]);
		expect(result.isValid).toBe(true);
	});
});
