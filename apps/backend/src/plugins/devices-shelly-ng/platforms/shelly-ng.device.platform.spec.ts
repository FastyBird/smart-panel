/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';

import { DelegatesManagerService } from '../delegates/delegates-manager.service';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';

import { ShellyNgDevicePlatform } from './shelly-ng.device.platform';

describe('ShellyNgDevicePlatform', () => {
	// Quiet logger noise and let us assert calls
	let logSpy: jest.SpyInstance;
	let warnSpy: jest.SpyInstance;
	let errSpy: jest.SpyInstance;

	beforeAll(() => {
		logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		errSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterAll(() => {
		logSpy.mockRestore();
		warnSpy.mockRestore();
		errSpy.mockRestore();
	});

	const makeDevice = (id = 'dev-1'): ShellyNgDeviceEntity => Object.assign(new ShellyNgDeviceEntity(), { id });

	const makeChannel = (id = 'channel-1'): ShellyNgChannelEntity => Object.assign(new ShellyNgChannelEntity(), { id });

	const makeProp = (id = 'prop-1'): ShellyNgChannelPropertyEntity =>
		({ id }) as unknown as ShellyNgChannelPropertyEntity;

	const makePlatform = (setPropertyValue?: jest.Mock) => {
		const delegates = {
			setPropertyValue: setPropertyValue ?? jest.fn(),
		} as unknown as DelegatesManagerService;

		return new ShellyNgDevicePlatform(delegates);
	};

	it('getType returns DEVICES_SHELLY_NG_TYPE', () => {
		const platform = makePlatform();
		expect(platform.getType()).toBe(DEVICES_SHELLY_NG_TYPE);
	});

	it('process delegates to processBatch with single update', async () => {
		const setMock = jest.fn().mockResolvedValue(true);
		const platform = makePlatform(setMock);

		const device = makeDevice('dev-1');
		const channel = makeChannel('ch-1');
		const property = makeProp('p-1');

		const ok = await platform.process({
			device,
			channel,
			property,
			value: true,
		});

		expect(ok).toBe(true);
		expect(setMock).toHaveBeenCalledWith(device, property, true);
		expect(Logger.prototype.log).toHaveBeenCalled(); // success log
	});

	it('processBatch returns false immediately when device is not ShellyNgDeviceEntity', async () => {
		const platform = makePlatform(jest.fn());
		const notShellyDevice = { id: 'x' } as ShellyNgDeviceEntity;

		const ok = await platform.processBatch([
			{ device: notShellyDevice, channel: makeChannel('ch'), property: makeProp('p'), value: 1 },
		]);

		expect(ok).toBe(false);
		expect(Logger.prototype.error).toHaveBeenCalledWith(
			'[SHELLY NG][PLATFORM] Failed to update device property, invalid device provided',
		);
	});

	it('processBatch returns true when all updates succeed', async () => {
		const setMock = jest.fn().mockResolvedValue(true);
		const platform = makePlatform(setMock);

		const device = makeDevice('dev-2');
		const channel = makeChannel('ch-2');
		const p1 = makeProp('p-1');
		const p2 = makeProp('p-2');

		const ok = await platform.processBatch([
			{ device, channel, property: p1, value: 10 },
			{ device, channel, property: p2, value: false },
		]);

		expect(ok).toBe(true);
		expect(setMock).toHaveBeenNthCalledWith(1, device, p1, 10);
		expect(setMock).toHaveBeenNthCalledWith(2, device, p2, false);
		expect(Logger.prototype.log).toHaveBeenCalledWith(
			`[SHELLY NG][PLATFORM] Successfully processed all property updates for device id=${device.id}`,
		);
	});

	it('processBatch returns false when any update returns false', async () => {
		const setMock = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false); // second fails

		const platform = makePlatform(setMock);

		const device = makeDevice('dev-3');
		const channel = makeChannel('ch-3');
		const p1 = makeProp('p-1');
		const p2 = makeProp('p-2');

		const ok = await platform.processBatch([
			{ device, channel, property: p1, value: 1 },
			{ device, channel, property: p2, value: 2 },
		]);

		expect(ok).toBe(false);
		expect(Logger.prototype.error).toHaveBeenCalledWith('[SHELLY NG][PLATFORM] Failed to update device property');
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			expect.stringContaining(`[SHELLY NG][PLATFORM] Some properties failed to update for device id=${device.id}`),
		);
	});

	it('processBatch returns false when setPropertyValue throws', async () => {
		const setMock = jest.fn().mockRejectedValue(new Error('boom'));
		const platform = makePlatform(setMock);

		const device = makeDevice('dev-4');
		const channel = makeChannel('ch-4');
		const p = makeProp('p-1');

		const ok = await platform.processBatch([{ device, channel, property: p, value: 'x' }]);

		expect(ok).toBe(false);
		expect(Logger.prototype.error).toHaveBeenCalledWith(
			'[SHELLY NG][PLATFORM] Error processing property update',
			expect.objectContaining({ message: 'boom' }),
		);
	});
});
