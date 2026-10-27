/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';

import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DelegatesManagerService } from '../delegates/delegates-manager.service';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { DevicesShellyNgNotImplementedException } from '../devices-shelly-ng.exceptions';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';
import { ShellyGuardFenceReadback } from '../services/shelly-guard-rpc-session';

import { ShellyNgDevicePlatform } from './shelly-ng.device.platform';

describe('ShellyNgDevicePlatform', () => {
	// Quiet logger noise and let us assert calls

	beforeAll(() => {});

	afterAll(() => {});

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

	// Actual platform -> manager admission, with only final sample publication observed.
	// These forwarding controls establish neither a native fence nor hardware qualification.
	const ownedFixture = () => {
		const reportSample = jest.fn().mockResolvedValue(undefined);
		const manager = new DelegatesManagerService(
			{} as never,
			{} as never,
			{ reportSample } as unknown as ConstructorParameters<typeof DelegatesManagerService>[2],
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
		);
		return { manager, reportSample, platform: new ShellyNgDevicePlatform(manager) };
	};
	const fenceReadback = (isCurrent = () => true): ShellyGuardFenceReadback => ({
		proofId: 'original-proof',
		connectionIdentity: 'original-connection',
		output: false,
		epoch: 1,
		wasOn: false,
		isCurrent,
		evidence: {
			sampledAt: new Date(1000),
			receivedAt: new Date(1000),
			observedAt: new Date(1000),
			provenance: 'live',
			isCurrent,
		},
	});
	it.each(['manager method', 'platform dependency', 'target property', 'expired readback'] as const)(
		'owned fence delivery retains the original forwarding destination across %s replacement',
		async (change) => {
			const { platform, manager, reportSample } = ownedFixture();
			const replacement = ownedFixture();
			const original = jest.spyOn(manager, 'admitGuardFenceSample');
			const successor = jest.fn().mockResolvedValue(undefined);
			const property = makeProp('original-property');
			const target = { device: makeDevice(), channel: makeChannel(), property, value: false };
			const deliver = platform.captureOwnedGuardFenceSample(target);
			let current = true;
			const readback = fenceReadback(() => current);
			let release!: (value: ShellyGuardFenceReadback) => void;
			const held = new Promise<ShellyGuardFenceReadback>((resolve) => {
				release = resolve;
			});
			const completion = held.then(deliver);
			try {
				if (change === 'manager method') manager.admitGuardFenceSample = successor;
				if (change === 'platform dependency') Reflect.set(platform, 'delegatesManagerService', replacement.manager);
				if (change === 'target property') target.property = makeProp('successor-property');
				if (change === 'expired readback') current = false;
				expect(original).not.toHaveBeenCalled();
				release(readback);
				await completion;
				expect(original).toHaveBeenCalledTimes(1);
				expect(original.mock.contexts[0]).toBe(manager);
				expect(original).toHaveBeenCalledWith(property, readback);
				expect(successor).not.toHaveBeenCalled();
				expect(replacement.reportSample).not.toHaveBeenCalled();
				expect(reportSample).toHaveBeenCalledTimes(current ? 1 : 0);
				if (current)
					expect(reportSample).toHaveBeenCalledWith(
						'original-property',
						expect.objectContaining({ value: false }),
						readback.evidence,
					);
			} finally {
				release(readback);
				await completion;
				original.mockRestore();
			}
		},
	);
	it('demonstrates why retaining only the ordinary outer forwarding method does not retain its destination', async () => {
		const { platform, manager } = ownedFixture();
		const original = jest.spyOn(manager, 'admitGuardFenceSample');
		const successor = jest.fn().mockResolvedValue(undefined);
		const forward = platform.admitGuardFenceSample;
		const target = { device: makeDevice(), channel: makeChannel(), property: makeProp(), value: false };
		let release!: (value: ShellyGuardFenceReadback) => void;
		const held = new Promise<ShellyGuardFenceReadback>((resolve) => {
			release = resolve;
		});
		const completion = held.then(async (readback) => {
			await forward.call(platform, target, readback);
		});
		try {
			manager.admitGuardFenceSample = successor;
			release(fenceReadback());
			await completion;
			expect(original).not.toHaveBeenCalled();
			expect(successor).toHaveBeenCalledTimes(1);
			expect(successor.mock.contexts[0]).toBe(manager);
		} finally {
			release(fenceReadback());
			await completion;
			original.mockRestore();
		}
	});
	it.each([undefined, null, false, 0, ''])('retains exact owned callback failure %s', async (cause) => {
		for (const asynchronous of [false, true]) {
			const { platform, manager } = ownedFixture();
			const original = jest.spyOn(manager, 'admitGuardFenceSample').mockImplementation(() => {
				// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- Test exact non-Error provider failures.
				if (asynchronous) return Promise.reject(cause);
				throw cause as unknown;
			});
			const target = { device: makeDevice(), channel: makeChannel(), property: makeProp(), value: false };
			const deliver = platform.captureOwnedGuardFenceSample(target);
			try {
				await expect(deliver(fenceReadback())).rejects.toBe(cause);
				expect(original).toHaveBeenCalledTimes(1);
			} finally {
				original.mockRestore();
			}
		}
	});
	it('awaits the original sample completion and permits independent later captures', async () => {
		const { platform, manager, reportSample } = ownedFixture();
		let enter!: () => void, release!: () => void;
		const entered = new Promise<void>((resolve) => {
			enter = resolve;
		});
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		reportSample.mockImplementationOnce(() => {
			enter();
			return held;
		});
		const target = { device: makeDevice(), channel: makeChannel(), property: makeProp(), value: false };
		let settled = false;
		const completion = platform
			.captureOwnedGuardFenceSample(target)(fenceReadback())
			.then(() => {
				settled = true;
			});
		try {
			await entered;
			expect(settled).toBe(false);
			release();
			await completion;
			await platform.captureOwnedGuardFenceSample(target)(fenceReadback());
			expect(reportSample).toHaveBeenCalledTimes(2);
			expect(manager).toBeInstanceOf(DelegatesManagerService);
		} finally {
			release();
			await completion;
		}
	});
	it('keeps non-Shelly property delivery a no-op without consulting the manager callback', async () => {
		const { platform, manager } = ownedFixture();
		const getter = jest.fn(() => {
			throw new Error('must not consult delegate');
		});
		Object.defineProperty(manager, 'admitGuardFenceSample', { get: getter, configurable: true });
		const property = { id: 'foreign-property' } as ShellyNgChannelPropertyEntity;
		const deliver = platform.captureOwnedGuardFenceSample({
			device: makeDevice(),
			channel: makeChannel(),
			property,
			value: false,
		});
		await expect(deliver(fenceReadback())).resolves.toBeUndefined();
		expect(getter).not.toHaveBeenCalled();
	});
	it('normalizes numeric component identity for shared motor generations across logical spellings', () => {
		const { platform } = makePlatform();
		const device = Object.assign(makeDevice(), { canonicalMac: 'aabbccddeeff' });
		const channel = Object.assign(makeChannel(), { category: ChannelCategory.WINDOW_COVERING, identifier: 'cover:0' });
		const update = { device, channel, property: makeProp(), value: 'stop' };
		expect(platform.getCoverEffectScope(update)).toBe('shelly-ng:AABBCCDDEEFF|cover:0');
		channel.identifier = 'cover:00';
		expect(platform.getCoverEffectScope(update)).toBe('shelly-ng:AABBCCDDEEFF|cover:0');
	});

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
	it('routes only the canonical readable/writable boolean switch leaf through the protective adapter', async () => {
		const device = Object.assign(makeDevice(), { identifier: 'shellyplus1pm-fixture' });
		const channel = Object.assign(makeChannel(), { identifier: 'switch:0', device });
		const property: ShellyNgChannelPropertyEntity = Object.assign(makeProp(), {
			identifier: 'output',
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
			channel,
		});
		const protectiveSwitch = jest
			.fn()
			.mockResolvedValue({ outcome: 'accepted', outputConfirmed: false, pendingOnDrained: false });
		const platform = new ShellyNgDevicePlatform({
			protectiveSwitch,
			hasGuardedTransport: () => false,
		} as unknown as DelegatesManagerService);
		expect((await platform.processProtectiveCommand({ device, channel, property }, { on: false }, 1000)).outcome).toBe(
			'accepted',
		);
		expect(protectiveSwitch).toHaveBeenCalledWith(device.identifier, 0, { on: false }, 1000, undefined);
		property.channel = makeChannel('another');
		expect((await platform.processProtectiveCommand({ device, channel, property }, { on: false }, 1000)).outcome).toBe(
			'refused',
		);
		expect(protectiveSwitch).toHaveBeenCalledTimes(1);
		expect(
			platform.getProtectiveReadiness({ deviceId: 'unknown', model: 'SNSW-001P16EU', firmware: 'unknown' }, 0)
				.supported,
		).toBe(false);
	});
	it('strict lighting requires explicit ON with brightness and passes the owned guard to exact prepared effects', async () => {
		const device = Object.assign(makeDevice(), { identifier: 'dimmer', enabled: true });
		const channel = Object.assign(makeChannel(), { identifier: 'light:0', device });
		const on = Object.assign(makeProp('on'), {
			identifier: 'output',
			channel,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		const brightness = Object.assign(makeProp('brightness'), {
			identifier: 'brightness',
			channel,
			category: PropertyCategory.BRIGHTNESS,
			dataType: DataTypeType.UCHAR,
			permissions: [PermissionType.READ_WRITE],
		});
		const dispatch = jest.fn((guard: () => boolean) => Promise.resolve(guard()));
		const prepareLightingCommand = jest.fn().mockResolvedValue({ isCurrent: () => true, dispatch });
		const platform = new ShellyNgDevicePlatform({ prepareLightingCommand } as unknown as DelegatesManagerService);
		expect(await platform.prepareCompositeBatch([{ device, channel, property: brightness, value: 42 }])).toBeNull();
		expect(prepareLightingCommand).not.toHaveBeenCalled();
		const updates = [
			{ device, channel, property: on, value: true },
			{ device, channel, property: brightness, value: 42 },
		];
		const prepared = await platform.prepareCompositeBatch(updates);
		expect(prepared.updates).toEqual(updates);
		expect(prepareLightingCommand).toHaveBeenCalledWith(device, 'light:0', true, 42, [on, brightness]);
		expect(await prepared.dispatch(() => false)).toBe(false);
		expect(dispatch).not.toHaveBeenCalled();
		expect(await prepared.dispatch(() => true)).toBe(true);
		expect(dispatch).toHaveBeenCalledTimes(1);
	});
});
