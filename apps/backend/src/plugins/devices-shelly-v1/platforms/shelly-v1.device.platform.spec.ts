/*
eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-return,
@typescript-eslint/no-unsafe-assignment
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';

import { PropertyCategory } from '../../../modules/devices/devices.constants';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import {
	ShellyV1ChannelEntity,
	ShellyV1ChannelPropertyEntity,
	ShellyV1DeviceEntity,
} from '../entities/devices-shelly-v1.entity';
import { ShellyDevice } from '../interfaces/shellies.interface';
import { ShelliesAdapterService } from '../services/shellies-adapter.service';

import { ShellyV1DevicePlatform } from './shelly-v1.device.platform';

describe('ShellyV1DevicePlatform', () => {
	// Quiet logger noise and let us assert calls

	beforeAll(() => {});

	afterAll(() => {});

	const makeDevice = (id = 'dev-1', identifier = 'shelly1pm-ABC123', enabled = true): ShellyV1DeviceEntity =>
		Object.assign(new ShellyV1DeviceEntity(), { id, identifier, enabled });

	const makeChannel = (id = 'channel-1', identifier = 'relay_0'): ShellyV1ChannelEntity =>
		Object.assign(new ShellyV1ChannelEntity(), { id, identifier });

	const makeProp = (id = 'prop-1', identifier = 'state'): ShellyV1ChannelPropertyEntity =>
		Object.assign(new ShellyV1ChannelPropertyEntity(), { id, identifier, category: PropertyCategory.ON });

	const makeShellyDevice = (type = 'SHSW-PM', id?: string): jest.Mocked<ShellyDevice> => {
		const defaultId =
			type === 'SHRGBW2' ? 'shellyrgbw2-DEF456' : type === 'SHSW-25' ? 'shelly25-GHI789' : 'shelly1pm-ABC123';

		return {
			id: id || defaultId,
			type,
			host: '192.168.1.100',
			online: true,
			setRelay: jest.fn().mockResolvedValue(undefined),
			setColor: jest.fn().mockResolvedValue(undefined),
			setWhite: jest.fn().mockResolvedValue(undefined),
			setRoller: jest.fn().mockResolvedValue(undefined),
			setRollerPosition: jest.fn().mockResolvedValue(undefined),
			setRollerState: jest.fn().mockResolvedValue(undefined),
		} as any;
	};

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
			`[ShellyV1DevicePlatform] Successfully processed all property updates for device id=${device.id}`,
			expect.objectContaining({ tag: 'devices-shelly-v1-plugin' }),
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
			'[ShellyV1DevicePlatform] Failed to update device property, invalid device provided',
			undefined,
			expect.objectContaining({ tag: 'devices-shelly-v1-plugin' }),
		);
	});

	it('processBatch returns false when device is disabled', async () => {
		const { platform } = makePlatform();
		const device = makeDevice('dev-1', 'shelly1pm-ABC123', false); // disabled

		const ok = await platform.processBatch([{ device, channel: makeChannel('ch'), property: makeProp('p'), value: 1 }]);

		expect(ok).toBe(false);
	});

	it('processBatch returns false when Shelly device not found in adapter (offline)', async () => {
		const getDevice = jest.fn().mockReturnValue(null);
		const { platform } = makePlatform({ getDevice });

		const device = makeDevice('dev-1');

		const ok = await platform.processBatch([{ device, channel: makeChannel('ch'), property: makeProp('p'), value: 1 }]);

		expect(ok).toBe(false);
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			`[ShellyV1DevicePlatform] Shelly device not found in adapter: ${device.identifier}, device may be offline`,
			expect.objectContaining({ tag: 'devices-shelly-v1-plugin' }),
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
				`[ShellyV1DevicePlatform] Device ${device.identifier} does not support setRelay method`,
				expect.objectContaining({ tag: 'devices-shelly-v1-plugin' }),
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
			expect(shellyDevice.setColor).toHaveBeenCalledWith({ switch: true });
		});

		it('should execute light brightness command', async () => {
			const shellyDevice = makeShellyDevice('SHRGBW2');
			shellyDevice.mode = 'white';
			shellyDevice.brightness = 50; // current brightness
			shellyDevice.switch = true; // current state
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shellyrgbw2-DEF456');
			const channel = makeChannel('ch-1', 'light_0');
			const property = makeProp('p-1', 'brightness');

			const ok = await platform.processBatch([{ device, channel, property, value: 75 }]);

			expect(ok).toBe(true);
			// SHRGBW2 is multi-channel: setWhite(index, brightness, on)
			expect(shellyDevice.setWhite).toHaveBeenCalledWith(0, 75, true);
		});

		it('should clamp brightness value to 0-100 range', async () => {
			const shellyDevice = makeShellyDevice('SHRGBW2');
			shellyDevice.mode = 'white';
			shellyDevice.brightness = 50;
			shellyDevice.switch = true;
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shellyrgbw2-DEF456');
			const channel = makeChannel('ch-1', 'light_0');
			const property = makeProp('p-1', 'brightness');

			await platform.processBatch([{ device, channel, property, value: 150 }]);

			// Brightness clamped to 100, SHRGBW2 is multi-channel: setWhite(index, brightness, on)
			expect(shellyDevice.setWhite).toHaveBeenCalledWith(0, 100, true);
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

			expect(shellyDevice.setColor).toHaveBeenCalledWith({ red: 255 });

			// Reset mock
			(shellyDevice.setColor as jest.Mock).mockClear();

			// Test green
			await platform.processBatch([{ device, channel, property: makeProp('p-2', 'green'), value: 128 }]);

			expect(shellyDevice.setColor).toHaveBeenCalledWith({ green: 128 });
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
			expect(shellyDevice.setColor).toHaveBeenCalledTimes(1);
			expect(shellyDevice.setColor).toHaveBeenCalledWith({
				switch: true,
				red: 255,
				green: 128,
			});
		});
	});

	describe('Roller commands', () => {
		it('should execute roller position command', async () => {
			const shellyDevice = makeShellyDevice('SHSW-25');
			shellyDevice.mode = 'roller';
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shelly25-GHI789');
			const channel = makeChannel('ch-1', 'roller_0');
			const property = makeProp('p-1', 'position');

			const ok = await platform.processBatch([{ device, channel, property, value: 50 }]);

			expect(ok).toBe(true);
			expect(shellyDevice.setRollerPosition).toHaveBeenCalledWith(50);
		});

		it('should execute roller open command', async () => {
			const shellyDevice = makeShellyDevice('SHSW-25');
			shellyDevice.mode = 'roller';
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shelly25-GHI789');
			const channel = makeChannel('ch-1', 'roller_0');
			const property = makeProp('p-1', 'command');

			const ok = await platform.processBatch([{ device, channel, property, value: 'open' }]);

			expect(ok).toBe(true);
			expect(shellyDevice.setRollerState).toHaveBeenCalledWith('open');
		});

		it('should return false for invalid roller command', async () => {
			const shellyDevice = makeShellyDevice('SHSW-25');
			shellyDevice.mode = 'roller';
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shelly25-GHI789');
			const channel = makeChannel('ch-1', 'roller_0');
			const property = makeProp('p-1', 'command');

			// Clear previous warn calls
			(Logger.prototype.warn as jest.Mock).mockClear();

			const ok = await platform.processBatch([{ device, channel, property, value: 'invalid' }]);

			expect(ok).toBe(false);
			expect(Logger.prototype.warn).toHaveBeenCalledWith(
				'[ShellyV1DevicePlatform] Invalid roller command: invalid, must be one of: open, close, stop',
				expect.objectContaining({ tag: 'devices-shelly-v1-plugin' }),
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
			expect(Logger.prototype.error).toHaveBeenCalledWith(
				expect.stringContaining('[ShellyV1DevicePlatform] Error processing property update'),
				undefined,
				expect.objectContaining({ tag: 'devices-shelly-v1-plugin' }),
			);
		});
	});
});
