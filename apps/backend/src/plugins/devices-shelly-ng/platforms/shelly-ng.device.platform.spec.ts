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
import { DevicesShellyNgNotImplementedException } from '../devices-shelly-ng.exceptions';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';

import { ShellyNgDevicePlatform } from './shelly-ng.device.platform';

describe('ShellyNgDevicePlatform', () => {
	// Quiet logger noise and let us assert calls

	beforeAll(() => {
	});

	afterAll(() => {
	});

	const makeDevice = (id = 'dev-1'): ShellyNgDeviceEntity => Object.assign(new ShellyNgDeviceEntity(), { id });

	const makeChannel = (id = 'channel-1'): ShellyNgChannelEntity => Object.assign(new ShellyNgChannelEntity(), { id });

	const makeProp = (id = 'prop-1'): ShellyNgChannelPropertyEntity =>
		Object.assign(new ShellyNgChannelPropertyEntity(), { id });

	const makePlatform = (opts?: { setChannelValue?: jest.Mock; setPropertyValue?: jest.Mock }) => {
		const delegates = {
			setChannelValue: opts?.setChannelValue ?? jest.fn(),
			setPropertyValue: opts?.setPropertyValue ?? jest.fn(),
		} as unknown as DelegatesManagerService;

		return { platform: new ShellyNgDevicePlatform(delegates), delegates };
	};

	it('getType returns DEVICES_SHELLY_NG_TYPE', () => {
		const { platform } = makePlatform();
		expect(platform.getType()).toBe(DEVICES_SHELLY_NG_TYPE);
	});

	it('process delegates to processBatch and uses batch handler (setChannelValue)', async () => {
		const setChannelValue = jest.fn().mockResolvedValue(true);
		const { platform, delegates } = makePlatform({ setChannelValue });

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
		expect(setChannelValue).toHaveBeenCalledTimes(1);
		expect(setChannelValue).toHaveBeenCalledWith(device, channel, [{ property, value: true }]);
		// per-property handler by se v tomto scénáři volat neměl
		expect(delegates.setPropertyValue as jest.Mock).not.toHaveBeenCalled();
		expect(Logger.prototype.log).toHaveBeenCalledWith(
			`[ShellyNgDevicePlatform] Successfully processed all property updates for device id=${device.id}`,
			expect.objectContaining({ tag: 'devices-shelly-ng-plugin' }),
		);
	});

	it('processBatch returns false immediately when device is not ShellyNgDeviceEntity', async () => {
		const { platform } = makePlatform();
		const notShellyDevice = { id: 'x' } as ShellyNgDeviceEntity; // není instance ShellyNgDeviceEntity

		const ok = await platform.processBatch([
			{ device: notShellyDevice, channel: makeChannel('ch'), property: makeProp('p'), value: 1 },
		]);

		expect(ok).toBe(false);
		expect(Logger.prototype.error).toHaveBeenCalledWith(
			'[ShellyNgDevicePlatform] Failed to update device property, invalid device provided',
			undefined,
			expect.objectContaining({ tag: 'devices-shelly-ng-plugin' }),
		);
	});

	it('processBatch uses batch handler when available and all updates succeed', async () => {
		const setChannelValue = jest.fn().mockResolvedValue(true);
		const { platform, delegates } = makePlatform({ setChannelValue });

		const device = makeDevice('dev-2');
		const channel = makeChannel('ch-2');
		const p1 = makeProp('p-1');
		const p2 = makeProp('p-2');

		const ok = await platform.processBatch([
			{ device, channel, property: p1, value: 10 },
			{ device, channel, property: p2, value: false },
		]);

		expect(ok).toBe(true);

		expect(setChannelValue).toHaveBeenCalledTimes(1);
		expect(setChannelValue).toHaveBeenCalledWith(device, channel, [
			{ property: p1, value: 10 },
			{ property: p2, value: false },
		]);
		expect(delegates.setPropertyValue as jest.Mock).not.toHaveBeenCalled();
		expect(Logger.prototype.log).toHaveBeenCalledWith(
			`[ShellyNgDevicePlatform] Successfully processed all property updates for device id=${device.id}`,
			expect.objectContaining({ tag: 'devices-shelly-ng-plugin' }),
		);
	});

	it('processBatch returns false when batch handler returns false (no fallback)', async () => {
		const setChannelValue = jest.fn().mockResolvedValue(false);
		const { platform, delegates } = makePlatform({ setChannelValue });

		const device = makeDevice('dev-3');
		const channel = makeChannel('ch-3');
		const p1 = makeProp('p-1');
		const p2 = makeProp('p-2');

		const ok = await platform.processBatch([
			{ device, channel, property: p1, value: 1 },
			{ device, channel, property: p2, value: 2 },
		]);

		expect(ok).toBe(false);
		// batch handler byl volán
		expect(setChannelValue).toHaveBeenCalledTimes(1);
		// per-property fallback by se v tomto scénáři volat neměl
		expect(delegates.setPropertyValue as jest.Mock).not.toHaveBeenCalled();

		expect(Logger.prototype.error).toHaveBeenCalledWith(
			'[ShellyNgDevicePlatform] Failed to update device property',
			undefined,
			expect.objectContaining({ tag: 'devices-shelly-ng-plugin' }),
		);
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			expect.stringContaining(`Some properties failed to update for device id=${device.id}`),
			expect.objectContaining({ tag: 'devices-shelly-ng-plugin' }),
		);
	});

	it('processBatch falls back to per-property handlers when batch handler throws DevicesShellyNgNotImplementedException and returns true when all succeed', async () => {
		const setChannelValue = jest.fn().mockRejectedValue(new DevicesShellyNgNotImplementedException('not implemented'));

		const setPropertyValue = jest.fn().mockResolvedValue(true);

		const { platform } = makePlatform({ setChannelValue, setPropertyValue });

		const device = makeDevice('dev-4');
		const channel = makeChannel('ch-4');
		const p1 = makeProp('p-1');
		const p2 = makeProp('p-2');

		const ok = await platform.processBatch([
			{ device, channel, property: p1, value: 10 },
			{ device, channel, property: p2, value: 20 },
		]);

		expect(ok).toBe(true);

		expect(setChannelValue).toHaveBeenCalledTimes(1);
		expect(setPropertyValue).toHaveBeenNthCalledWith(1, device, p1, 10);
		expect(setPropertyValue).toHaveBeenNthCalledWith(2, device, p2, 20);

		expect(Logger.prototype.log).toHaveBeenCalledWith(
			`[ShellyNgDevicePlatform] Successfully processed all property updates for device id=${device.id}`,
			expect.objectContaining({ tag: 'devices-shelly-ng-plugin' }),
		);
	});

	it('processBatch returns false when any per-property update returns false in fallback mode', async () => {
		const setChannelValue = jest.fn().mockRejectedValue(new DevicesShellyNgNotImplementedException('not implemented'));

		const setPropertyValue = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false); // druhý prop selže

		const { platform } = makePlatform({ setChannelValue, setPropertyValue });

		const device = makeDevice('dev-5');
		const channel = makeChannel('ch-5');
		const p1 = makeProp('p-1');
		const p2 = makeProp('p-2');

		const ok = await platform.processBatch([
			{ device, channel, property: p1, value: 1 },
			{ device, channel, property: p2, value: 2 },
		]);

		expect(ok).toBe(false);

		expect(setPropertyValue).toHaveBeenNthCalledWith(1, device, p1, 1);
		expect(setPropertyValue).toHaveBeenNthCalledWith(2, device, p2, 2);

		expect(Logger.prototype.error).toHaveBeenCalledWith(
			'[ShellyNgDevicePlatform] Failed to update device property',
			undefined,
			expect.objectContaining({ tag: 'devices-shelly-ng-plugin' }),
		);
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			expect.stringContaining(`Some properties failed to update for device id=${device.id}`),
			expect.objectContaining({ tag: 'devices-shelly-ng-plugin' }),
		);
	});

	it('processBatch returns false when per-property update throws in fallback mode', async () => {
		const setChannelValue = jest.fn().mockRejectedValue(new DevicesShellyNgNotImplementedException('not implemented'));

		const setPropertyValue = jest.fn().mockRejectedValue(new Error('boom'));

		const { platform } = makePlatform({ setChannelValue, setPropertyValue });

		const device = makeDevice('dev-6');
		const channel = makeChannel('ch-6');
		const p = makeProp('p-1');

		const ok = await platform.processBatch([{ device, channel, property: p, value: 'x' }]);

		expect(ok).toBe(false);
		expect(Logger.prototype.error).toHaveBeenCalledWith(
			expect.stringContaining('[ShellyNgDevicePlatform] Error processing property update'),
			undefined,
			expect.objectContaining({ tag: 'devices-shelly-ng-plugin' }),
		);
	});
});
