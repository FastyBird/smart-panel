/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';

import { PropertyCategory, PermissionType } from '../../../modules/devices/devices.constants';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import { ShellyDevice } from '../interfaces/shellies.interface';

import { ShellyV1DevicePlatform } from './shelly-v1.device.platform';
import { ShelliesAdapterService } from '../services/shellies-adapter.service';

describe('ShellyV1DevicePlatform', () => {
	// Quiet logger noise and let us assert calls
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

	const makeDevice = (id = 'dev-1', identifier = 'shelly1pm-ABC123', enabled = true): ShellyV1DeviceEntity =>
		Object.assign(new ShellyV1DeviceEntity(), { id, identifier, enabled });

	const makeChannel = (id = 'channel-1', identifier = 'relay_0'): ShellyV1ChannelEntity =>
		Object.assign(new ShellyV1ChannelEntity(), { id, identifier });

	const makeProp = (id = 'prop-1', identifier = 'state'): ShellyV1ChannelPropertyEntity =>
		Object.assign(new ShellyV1ChannelPropertyEntity(), { id, identifier, category: PropertyCategory.ON });

	const makeShellyDevice = (type = 'SHSW-PM'): jest.Mocked<ShellyDevice> =>
		({
			id: 'shelly1pm-ABC123',
			type,
			host: '192.168.1.100',
			online: true,
			setRelay: jest.fn().mockResolvedValue(undefined),
			setLight: jest.fn().mockResolvedValue(undefined),
			setRoller: jest.fn().mockResolvedValue(undefined),
		}) as any;

	const makePlatform = (opts?: { getDevice?: jest.Mock }) => {
		const shelliesAdapter = {
			getDevice: opts?.getDevice ?? jest.fn(),
		} as unknown as ShelliesAdapterService;

		return { platform: new ShellyV1DevicePlatform(shelliesAdapter), shelliesAdapter };
	};

	it('getType returns DEVICES_SHELLY_V1_TYPE', () => {
		const { platform } = makePlatform();

		expect(platform.getType()).toBe(DEVICES_SHELLY_V1_TYPE);
	});

	it('process delegates to processBatch', async () => {
		const shellyDevice = makeShellyDevice();
		const getDevice = jest.fn().mockReturnValue(shellyDevice);
		const { platform } = makePlatform({ getDevice });

		const device = makeDevice('dev-1');
		const channel = makeChannel('ch-1', 'relay_0');
		const property = makeProp('p-1', 'state');

		const ok = await platform.process({
			device,
			channel,
			property,
			value: true,
		});

		expect(ok).toBe(true);
		expect(getDevice).toHaveBeenCalledWith('shelly1pm', 'shelly1pm-ABC123');
		expect(shellyDevice.setRelay).toHaveBeenCalledWith(0, true);
		expect(Logger.prototype.log).toHaveBeenCalledWith(
			`[SHELLY V1][PLATFORM] Successfully processed all property updates for device id=${device.id}`,
		);
	});

	it('processBatch returns false when device is not ShellyV1DeviceEntity', async () => {
		const { platform } = makePlatform();
		const notShellyDevice = { id: 'x' } as ShellyV1DeviceEntity;

		const ok = await platform.processBatch([
			{ device: notShellyDevice, channel: makeChannel('ch'), property: makeProp('p'), value: 1 },
		]);

		expect(ok).toBe(false);
		expect(Logger.prototype.error).toHaveBeenCalledWith(
			'[SHELLY V1][PLATFORM] Failed to update device property, invalid device provided',
		);
	});

	it('processBatch returns false when device is disabled', async () => {
		const { platform } = makePlatform();
		const device = makeDevice('dev-1', 'shelly1pm-ABC123', false); // disabled

		const ok = await platform.processBatch([
			{ device, channel: makeChannel('ch'), property: makeProp('p'), value: 1 },
		]);

		expect(ok).toBe(false);
		expect(Logger.prototype.debug).toHaveBeenCalledWith(
			`[SHELLY V1][PLATFORM] Device ${device.identifier} is disabled, ignoring command`,
		);
	});

	it('processBatch returns false when Shelly device not found in adapter (offline)', async () => {
		const getDevice = jest.fn().mockReturnValue(null);
		const { platform } = makePlatform({ getDevice });

		const device = makeDevice('dev-1');

		const ok = await platform.processBatch([
			{ device, channel: makeChannel('ch'), property: makeProp('p'), value: 1 },
		]);

		expect(ok).toBe(false);
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			`[SHELLY V1][PLATFORM] Shelly device not found in adapter: ${device.identifier}, device may be offline`,
		);
	});

	describe('Relay commands', () => {
		it('should execute relay ON command', async () => {
			const shellyDevice = makeShellyDevice();
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice();
			const channel = makeChannel('ch-1', 'relay_0');
			const property = makeProp('p-1', 'state');

			const ok = await platform.processBatch([{ device, channel, property, value: true }]);

			expect(ok).toBe(true);
			expect(shellyDevice.setRelay).toHaveBeenCalledWith(0, true);
		});

		it('should execute relay OFF command', async () => {
			const shellyDevice = makeShellyDevice();
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice();
			const channel = makeChannel('ch-1', 'relay_0');
			const property = makeProp('p-1', 'state');

			const ok = await platform.processBatch([{ device, channel, property, value: false }]);

			expect(ok).toBe(true);
			expect(shellyDevice.setRelay).toHaveBeenCalledWith(0, false);
		});

		it('should parse string boolean values', async () => {
			const shellyDevice = makeShellyDevice();
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice();
			const channel = makeChannel('ch-1', 'relay_0');
			const property = makeProp('p-1', 'state');

			await platform.processBatch([{ device, channel, property, value: 'true' }]);

			expect(shellyDevice.setRelay).toHaveBeenCalledWith(0, true);
		});

		it('should return false when device does not support setRelay', async () => {
			const shellyDevice = makeShellyDevice();
			shellyDevice.setRelay = undefined as any;
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice();
			const channel = makeChannel('ch-1', 'relay_0');
			const property = makeProp('p-1', 'state');

			const ok = await platform.processBatch([{ device, channel, property, value: true }]);

			expect(ok).toBe(false);
			expect(Logger.prototype.warn).toHaveBeenCalledWith(
				`[SHELLY V1][PLATFORM] Device ${device.identifier} does not support setRelay method`,
			);
		});
	});

	describe('Light commands', () => {
		it('should execute light state command', async () => {
			const shellyDevice = makeShellyDevice('SHRGBW2');
			shellyDevice.mode = 'color';
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shellyrgbw2-DEF456');
			const channel = makeChannel('ch-1', 'light_0');
			const property = makeProp('p-1', 'state');

			const ok = await platform.processBatch([{ device, channel, property, value: true }]);

			expect(ok).toBe(true);
			expect(shellyDevice.setLight).toHaveBeenCalledWith(0, { switch: true });
		});

		it('should execute light brightness command', async () => {
			const shellyDevice = makeShellyDevice('SHRGBW2');
			shellyDevice.mode = 'white';
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shellyrgbw2-DEF456');
			const channel = makeChannel('ch-1', 'light_0');
			const property = makeProp('p-1', 'brightness');

			const ok = await platform.processBatch([{ device, channel, property, value: 75 }]);

			expect(ok).toBe(true);
			expect(shellyDevice.setLight).toHaveBeenCalledWith(0, { brightness: 75 });
		});

		it('should clamp brightness value to 0-100 range', async () => {
			const shellyDevice = makeShellyDevice('SHRGBW2');
			shellyDevice.mode = 'white';
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shellyrgbw2-DEF456');
			const channel = makeChannel('ch-1', 'light_0');
			const property = makeProp('p-1', 'brightness');

			await platform.processBatch([{ device, channel, property, value: 150 }]);

			expect(shellyDevice.setLight).toHaveBeenCalledWith(0, { brightness: 100 });
		});

		it('should execute RGBW color commands', async () => {
			const shellyDevice = makeShellyDevice('SHRGBW2');
			shellyDevice.mode = 'color';
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shellyrgbw2-DEF456');
			const channel = makeChannel('ch-1', 'light_0');

			// Test red
			await platform.processBatch([{ device, channel, property: makeProp('p-1', 'red'), value: 255 }]);

			expect(shellyDevice.setLight).toHaveBeenCalledWith(0, { red: 255 });

			// Reset mock
			(shellyDevice.setLight as jest.Mock).mockClear();

			// Test green
			await platform.processBatch([{ device, channel, property: makeProp('p-2', 'green'), value: 128 }]);

			expect(shellyDevice.setLight).toHaveBeenCalledWith(0, { green: 128 });
		});

		it('should batch multiple light property updates into single command', async () => {
			const shellyDevice = makeShellyDevice('SHRGBW2');
			shellyDevice.mode = 'color';
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shellyrgbw2-DEF456');
			const channel = makeChannel('ch-1', 'light_0');

			const ok = await platform.processBatch([
				{ device, channel, property: makeProp('p-1', 'state'), value: true },
				{ device, channel, property: makeProp('p-2', 'red'), value: 255 },
				{ device, channel, property: makeProp('p-3', 'green'), value: 128 },
			]);

			expect(ok).toBe(true);
			expect(shellyDevice.setLight).toHaveBeenCalledTimes(1);
			expect(shellyDevice.setLight).toHaveBeenCalledWith(0, {
				switch: true,
				red: 255,
				green: 128,
			});
		});
	});

	describe('Roller commands', () => {
		it.skip('should execute roller position command', async () => {
			const shellyDevice = makeShellyDevice('SHSW-25');
			shellyDevice.mode = 'roller';
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shelly25-GHI789');
			const channel = makeChannel('ch-1', 'roller_0');
			const property = makeProp('p-1', 'position');

			const ok = await platform.processBatch([{ device, channel, property, value: 50 }]);

			expect(ok).toBe(true);
			expect(shellyDevice.setRoller).toHaveBeenCalledWith(0, 'to', 50);
		});

		it.skip('should execute roller open command', async () => {
			const shellyDevice = makeShellyDevice('SHSW-25');
			shellyDevice.mode = 'roller';
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shelly25-GHI789');
			const channel = makeChannel('ch-1', 'roller_0');
			const property = makeProp('p-1', 'command');

			const ok = await platform.processBatch([{ device, channel, property, value: 'open' }]);

			expect(ok).toBe(true);
			expect(shellyDevice.setRoller).toHaveBeenCalledWith(0, 'open');
		});

		it.skip('should return false for invalid roller command', async () => {
			const shellyDevice = makeShellyDevice('SHSW-25');
			shellyDevice.mode = 'roller';
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shelly25-GHI789');
			const channel = makeChannel('ch-1', 'roller_0');
			const property = makeProp('p-1', 'command');

			const ok = await platform.processBatch([{ device, channel, property, value: 'invalid' }]);

			expect(ok).toBe(false);
			expect(Logger.prototype.warn).toHaveBeenCalledWith(
				'[SHELLY V1][PLATFORM] Invalid roller command: invalid, must be open/close/stop',
			);
		});
	});

	describe('Error handling', () => {
		it('should handle errors during command execution', async () => {
			const shellyDevice = makeShellyDevice();
			shellyDevice.setRelay = jest.fn().mockRejectedValue(new Error('Network error'));
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice();
			const channel = makeChannel('ch-1', 'relay_0');
			const property = makeProp('p-1', 'state');

			const ok = await platform.processBatch([{ device, channel, property, value: true }]);

			expect(ok).toBe(false);
			expect(Logger.prototype.error).toHaveBeenCalledWith('[SHELLY V1][PLATFORM] Error processing property update', {
				message: expect.stringContaining('Network error'),
				stack: expect.any(String),
			});
		});
	});
});
