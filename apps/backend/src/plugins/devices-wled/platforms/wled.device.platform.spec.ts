/*
eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DataTypeType, DeviceCategory, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	DEVICES_WLED_TYPE,
	WLED_CHANNEL_IDENTIFIERS,
	WLED_LIGHT_PROPERTY_IDENTIFIERS,
} from '../devices-wled.constants';
import { WledChannelEntity, WledChannelPropertyEntity, WledDeviceEntity } from '../entities/devices-wled.entity';
import { WledClientAdapterService } from '../services/wled-client-adapter.service';

import { WledDevicePlatform } from './wled.device.platform';

describe('WledDevicePlatform', () => {
	let platform: WledDevicePlatform;
	let wledAdapter: jest.Mocked<WledClientAdapterService>;

	// Quiet logger noise
	let logSpy: jest.SpyInstance;
	let debugSpy: jest.SpyInstance;
	let warnSpy: jest.SpyInstance;
	let errSpy: jest.SpyInstance;

	beforeAll(() => {
		logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		errSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterAll(() => {
		logSpy.mockRestore();
		debugSpy.mockRestore();
		warnSpy.mockRestore();
		errSpy.mockRestore();
	});

	beforeEach(async () => {
		const mockWledAdapter = {
			getDeviceByIdentifier: jest.fn(),
			updateState: jest.fn(),
			updateStateExtended: jest.fn(),
			setNightlight: jest.fn(),
			setUdpSync: jest.fn(),
			updateSegment: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				WledDevicePlatform,
				{
					provide: WledClientAdapterService,
					useValue: mockWledAdapter,
				},
			],
		}).compile();

		platform = module.get<WledDevicePlatform>(WledDevicePlatform);
		wledAdapter = module.get(WledClientAdapterService);
	});

	const createMockDevice = (identifier: string, enabled = true): WledDeviceEntity => {
		const device = new WledDeviceEntity();
		device.id = 'device-uuid';
		device.identifier = identifier;
		device.name = 'Test WLED';
		device.enabled = enabled;
		device.category = DeviceCategory.LIGHTING;
		device.hostname = '192.168.1.100';
		return device;
	};

	const createMockChannel = (identifier: string): WledChannelEntity => {
		const channel = new WledChannelEntity();
		channel.id = 'channel-uuid';
		channel.identifier = identifier;
		channel.name = 'Light';
		channel.category = ChannelCategory.LIGHT;
		channel.device = 'device-uuid';
		return channel;
	};

	const createMockProperty = (
		identifier: string,
		category: PropertyCategory,
		dataType: DataTypeType,
	): WledChannelPropertyEntity => {
		const property = new WledChannelPropertyEntity();
		property.id = 'property-uuid';
		property.identifier = identifier;
		property.name = identifier;
		property.category = category;
		property.dataType = dataType;
		property.permissions = [PermissionType.READ_WRITE];
		property.channel = 'channel-uuid';
		return property;
	};

	describe('getType', () => {
		it('should return WLED device type', () => {
			expect(platform.getType()).toBe(DEVICES_WLED_TYPE);
		});
	});

	describe('process', () => {
		it('should delegate to processBatch', async () => {
			const device = createMockDevice('wled-test');
			const channel = createMockChannel(WLED_CHANNEL_IDENTIFIERS.LIGHT);
			const property = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.ON,
				PropertyCategory.ON,
				DataTypeType.BOOL,
			);

			wledAdapter.getDeviceByIdentifier.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			});
			wledAdapter.updateStateExtended.mockResolvedValue(true);

			const result = await platform.process({
				device,
				channel,
				property,
				value: true,
			});

			expect(result).toBe(true);
			expect(wledAdapter.updateStateExtended).toHaveBeenCalled();
		});
	});

	describe('processBatch', () => {
		it('should return false for disabled device', async () => {
			const device = createMockDevice('wled-test', false);
			const channel = createMockChannel(WLED_CHANNEL_IDENTIFIERS.LIGHT);
			const property = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.ON,
				PropertyCategory.ON,
				DataTypeType.BOOL,
			);

			const result = await platform.processBatch([
				{
					device,
					channel,
					property,
					value: true,
				},
			]);

			expect(result).toBe(false);
			expect(wledAdapter.updateStateExtended).not.toHaveBeenCalled();
		});

		it('should return false if device not found in adapter', async () => {
			const device = createMockDevice('wled-test');
			const channel = createMockChannel(WLED_CHANNEL_IDENTIFIERS.LIGHT);
			const property = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.ON,
				PropertyCategory.ON,
				DataTypeType.BOOL,
			);

			wledAdapter.getDeviceByIdentifier.mockReturnValue(undefined);

			const result = await platform.processBatch([
				{
					device,
					channel,
					property,
					value: true,
				},
			]);

			expect(result).toBe(false);
		});

		it('should return false if device not connected', async () => {
			const device = createMockDevice('wled-test');
			const channel = createMockChannel(WLED_CHANNEL_IDENTIFIERS.LIGHT);
			const property = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.ON,
				PropertyCategory.ON,
				DataTypeType.BOOL,
			);

			wledAdapter.getDeviceByIdentifier.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: false,
				enabled: true,
			});

			const result = await platform.processBatch([
				{
					device,
					channel,
					property,
					value: true,
				},
			]);

			expect(result).toBe(false);
		});

		it('should update state property', async () => {
			const device = createMockDevice('wled-test');
			const channel = createMockChannel(WLED_CHANNEL_IDENTIFIERS.LIGHT);
			const property = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.ON,
				PropertyCategory.ON,
				DataTypeType.BOOL,
			);

			wledAdapter.getDeviceByIdentifier.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			});
			wledAdapter.updateStateExtended.mockResolvedValue(true);

			const result = await platform.processBatch([
				{
					device,
					channel,
					property,
					value: true,
				},
			]);

			expect(result).toBe(true);
			expect(wledAdapter.updateStateExtended).toHaveBeenCalledWith(
				'192.168.1.100',
				expect.objectContaining({ on: true }),
			);
		});

		it('should update brightness property (spec 0-100% to WLED 0-255)', async () => {
			const device = createMockDevice('wled-test');
			const channel = createMockChannel(WLED_CHANNEL_IDENTIFIERS.LIGHT);
			const property = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.BRIGHTNESS,
				PropertyCategory.BRIGHTNESS,
				DataTypeType.UCHAR,
			);

			wledAdapter.getDeviceByIdentifier.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			});
			wledAdapter.updateStateExtended.mockResolvedValue(true);

			// Input: spec brightness 80% -> Output: WLED brightness 204 (80% of 255)
			const result = await platform.processBatch([
				{
					device,
					channel,
					property,
					value: 80, // spec percentage
				},
			]);

			expect(result).toBe(true);
			expect(wledAdapter.updateStateExtended).toHaveBeenCalledWith(
				'192.168.1.100',
				expect.objectContaining({ brightness: 204 }), // 80% of 255 = 204
			);
		});

		it('should update color properties', async () => {
			const device = createMockDevice('wled-test');
			const channel = createMockChannel(WLED_CHANNEL_IDENTIFIERS.LIGHT);
			const redProperty = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_RED,
				PropertyCategory.COLOR_RED,
				DataTypeType.UCHAR,
			);
			redProperty.id = 'red-uuid';
			const greenProperty = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_GREEN,
				PropertyCategory.COLOR_GREEN,
				DataTypeType.UCHAR,
			);
			greenProperty.id = 'green-uuid';
			const blueProperty = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.COLOR_BLUE,
				PropertyCategory.COLOR_BLUE,
				DataTypeType.UCHAR,
			);
			blueProperty.id = 'blue-uuid';

			wledAdapter.getDeviceByIdentifier.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			});
			wledAdapter.updateStateExtended.mockResolvedValue(true);

			const result = await platform.processBatch([
				{ device, channel, property: redProperty, value: 255 },
				{ device, channel, property: greenProperty, value: 128 },
				{ device, channel, property: blueProperty, value: 64 },
			]);

			expect(result).toBe(true);
			expect(wledAdapter.updateStateExtended).toHaveBeenCalledWith(
				'192.168.1.100',
				expect.objectContaining({
					segment: expect.objectContaining({
						colors: [[255, 128, 64]],
					}),
				}),
			);
		});

		it('should update effect property', async () => {
			const device = createMockDevice('wled-test');
			const channel = createMockChannel(WLED_CHANNEL_IDENTIFIERS.LIGHT);
			const property = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.EFFECT,
				PropertyCategory.MODE,
				DataTypeType.UCHAR,
			);

			wledAdapter.getDeviceByIdentifier.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			});
			wledAdapter.updateStateExtended.mockResolvedValue(true);

			const result = await platform.processBatch([
				{
					device,
					channel,
					property,
					value: 5,
				},
			]);

			expect(result).toBe(true);
			expect(wledAdapter.updateStateExtended).toHaveBeenCalledWith(
				'192.168.1.100',
				expect.objectContaining({
					segment: expect.objectContaining({
						effect: 5,
					}),
				}),
			);
		});

		it('should ignore non-light channel commands', async () => {
			const device = createMockDevice('wled-test');
			const channel = createMockChannel('device_information');
			const property = createMockProperty('firmware_revision', PropertyCategory.FIRMWARE_REVISION, DataTypeType.STRING);

			wledAdapter.getDeviceByIdentifier.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			});

			const result = await platform.processBatch([
				{
					device,
					channel,
					property,
					value: '1.0.0',
				},
			]);

			expect(result).toBe(false);
			expect(wledAdapter.updateStateExtended).not.toHaveBeenCalled();
		});

		it('should handle string boolean values', async () => {
			const device = createMockDevice('wled-test');
			const channel = createMockChannel(WLED_CHANNEL_IDENTIFIERS.LIGHT);
			const property = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.ON,
				PropertyCategory.ON,
				DataTypeType.BOOL,
			);

			wledAdapter.getDeviceByIdentifier.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			});
			wledAdapter.updateStateExtended.mockResolvedValue(true);

			await platform.processBatch([
				{ device, channel, property, value: 'true' },
			]);

			expect(wledAdapter.updateStateExtended).toHaveBeenCalledWith(
				'192.168.1.100',
				expect.objectContaining({ on: true }),
			);
		});

		it('should handle numeric boolean values', async () => {
			const device = createMockDevice('wled-test');
			const channel = createMockChannel(WLED_CHANNEL_IDENTIFIERS.LIGHT);
			const property = createMockProperty(
				WLED_LIGHT_PROPERTY_IDENTIFIERS.ON,
				PropertyCategory.ON,
				DataTypeType.BOOL,
			);

			wledAdapter.getDeviceByIdentifier.mockReturnValue({
				host: '192.168.1.100',
				identifier: 'wled-test',
				connected: true,
				enabled: true,
			});
			wledAdapter.updateStateExtended.mockResolvedValue(true);

			await platform.processBatch([
				{ device, channel, property, value: 1 },
			]);

			expect(wledAdapter.updateStateExtended).toHaveBeenCalledWith(
				'192.168.1.100',
				expect.objectContaining({ on: true }),
			);
		});
	});
});
