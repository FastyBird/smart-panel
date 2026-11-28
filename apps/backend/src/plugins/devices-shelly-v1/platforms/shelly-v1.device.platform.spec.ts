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
import { RegisteredDevice, ShellyDevice } from '../interfaces/shellies.interface';
import { ShelliesAdapterService } from '../services/shellies-adapter.service';
import { ShellyV1AdoptedIdentityService } from '../services/shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from '../services/shelly-v1-http-client.service';
import { ShellyV1PropertyReportsService } from '../services/shelly-v1-property-reports.service';

import { ShellyV1DevicePlatform } from './shelly-v1.device.platform';

describe('ShellyV1DevicePlatform', () => {
	// Quiet logger noise and let us assert calls

	beforeAll(() => {});

	afterAll(() => {});

	const makeDevice = (id = 'dev-1', identifier = 'shelly1pm-ABC123', enabled = true): ShellyV1DeviceEntity =>
		Object.assign(new ShellyV1DeviceEntity(), { id, identifier, enabled, hostname: '192.168.1.100' });

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

	const makePlatform = (opts?: { getDevice?: jest.Mock; getRegisteredDevice?: jest.Mock }) => {
		const registrations = new Map<string, RegisteredDevice>();
		const getRegisteredDevice =
			opts?.getRegisteredDevice ??
			((id: string) => {
				if (!registrations.has(id)) {
					const peer = opts?.getDevice?.() as ShellyDevice | undefined;
					registrations.set(id, { type: peer?.type ?? 'SHSW-PM', id, host: '192.168.1.100', enabled: true });
				}
				return registrations.get(id);
			});
		const shelliesAdapter = {
			getDevice: opts?.getDevice ?? jest.fn(),
			getRegisteredDevice,
			getRegisteredDeviceForCatalog: (device: ShellyV1DeviceEntity) => getRegisteredDevice(device.identifier),
		} as unknown as ShelliesAdapterService;
		const identities = { findPin: jest.fn().mockResolvedValue(null), confirmHost: jest.fn().mockResolvedValue(true) };
		const http = { getDeviceInfo: jest.fn() };
		return {
			platform: new ShellyV1DevicePlatform(
				shelliesAdapter,
				{ read: jest.fn() } as unknown as ShellyV1PropertyReportsService,
				identities as unknown as ShellyV1AdoptedIdentityService,
				http as unknown as ShellyV1HttpClientService,
			),
			shelliesAdapter,
			identities,
			http,
		};
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
		expect(getDevice).toHaveBeenCalledWith('SHSW-PM', 'shelly1pm-ABC123');
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
		const originalHost = '192.168.1.100';
		const movedHost = '192.168.1.101';
		const mac = 'AABBCCABC123';
		const gate = () => {
			let release: () => void;
			const promise = new Promise<void>((resolve) => {
				release = resolve;
			});
			return { promise, release: () => release() };
		};
		const relay = (identifier = 'shelly1pm-ABC123') => {
			const device = makeDevice('catalog-relay', identifier);
			const peer = makeShellyDevice('SHSW-PM', identifier);
			const registration: RegisteredDevice = { type: peer.type, id: peer.id, host: peer.host, enabled: true };
			const getDevice = jest.fn().mockReturnValue(peer);
			const getRegisteredDevice = jest.fn().mockReturnValue(registration);
			const { platform, identities, http } = makePlatform({ getDevice, getRegisteredDevice });
			const write = (value: boolean) =>
				platform.process({ device, channel: makeChannel(), property: makeProp(), value });
			return { device, peer, registration, getDevice, getRegisteredDevice, platform, identities, http, write };
		};

		it.each(['verified', 'same suffix and different hardware', 'other host', 'missing pin', 'other catalog row'])(
			'dispatches a renamed relay command only to its verified registration (%s)',
			async (scenario) => {
				const { device, peer, registration, identities, write } = relay();
				device.identifier = 'renamed-abc123';
				registration.catalog = { deviceId: scenario === 'other catalog row' ? 'other' : device.id, mac };
				identities.findPin.mockResolvedValue(
					scenario === 'missing pin'
						? null
						: {
								mac: scenario === 'same suffix and different hardware' ? '112233ABC123' : mac,
								verifiedHost: scenario === 'other host' ? movedHost : originalHost,
							},
				);
				expect(await write(false)).toBe(scenario === 'verified');
				expect(peer.setRelay.mock.calls).toEqual(scenario === 'verified' ? [[0, false]] : []);
			},
		);

		it.each([true, false])(
			'rejects a moved short-ID peer for value %s until its full identity has been verified there',
			async (value) => {
				const { peer, registration, identities, http, write } = relay();
				peer.host = movedHost;
				registration.host = movedHost;
				identities.findPin.mockResolvedValue({ mac, verifiedHost: originalHost });
				expect(await write(value)).toBe(false);
				expect(peer.setRelay).not.toHaveBeenCalled();
				expect(http.getDeviceInfo).not.toHaveBeenCalled();
				identities.findPin.mockResolvedValue({ mac, verifiedHost: movedHost });
				expect(await write(value)).toBe(true);
				expect(peer.setRelay).toHaveBeenCalledWith(0, value);
			},
		);

		it.each(['other suffix', 'malformed MAC', 'unconfigured legacy', 'moved legacy'])(
			'rejects %s before sending a relay command',
			async (kind) => {
				const { device, peer, registration, identities, write } = relay();
				if (kind === 'other suffix')
					identities.findPin.mockResolvedValue({ mac: 'AABBCC123456', verifiedHost: originalHost });
				if (kind === 'malformed MAC')
					identities.findPin.mockResolvedValue({ mac: 'ABC123', verifiedHost: originalHost });
				if (kind === 'unconfigured legacy') device.hostname = null;
				if (kind === 'moved legacy') registration.host = peer.host = movedHost;
				expect(await write(true)).toBe(false);
				expect(peer.setRelay).not.toHaveBeenCalled();
			},
		);

		it.each(['match', 'wrong full MAC', 'wrong model', 'lost confirmation', 'unconfirmed move'])(
			'handles an upgraded pin with %s at the captured endpoint',
			async (kind) => {
				const { device, peer, registration, identities, http, write } = relay();
				identities.findPin.mockResolvedValue({ mac, verifiedHost: null, revision: 1 });
				http.getDeviceInfo.mockResolvedValue({
					type: kind === 'wrong model' ? 'SHSW-1' : peer.type,
					mac: kind === 'wrong full MAC' ? 'DDEEFFABC123' : mac,
				});
				if (kind === 'lost confirmation') identities.confirmHost.mockResolvedValue(false);
				if (kind === 'unconfirmed move') registration.host = peer.host = movedHost;
				expect(await write(true)).toBe(kind === 'match');
				expect(peer.setRelay).toHaveBeenCalledTimes(kind === 'match' ? 1 : 0);
				if (kind === 'unconfirmed move') expect(http.getDeviceInfo).not.toHaveBeenCalled();
				else expect(http.getDeviceInfo).toHaveBeenCalledWith(originalHost);
				if (kind === 'match' || kind === 'lost confirmation')
					expect(identities.confirmHost).toHaveBeenCalledWith(device.id, mac, originalHost, null, 1);
				else expect(identities.confirmHost).not.toHaveBeenCalled();
			},
		);

		it.each(['registration', 'peer', 'host', 'disabled', 'catalog binding'])(
			'rejects a %s change during the identity lookup',
			async (change) => {
				const { device, peer, registration, getRegisteredDevice, getDevice, identities, write } = relay();
				const entered = gate();
				const release = gate();
				identities.findPin.mockImplementationOnce(async () => {
					entered.release();
					await release.promise;
					return { mac, verifiedHost: originalHost };
				});
				const pending = write(false);
				await entered.promise;
				const replacement = makeShellyDevice();
				if (change === 'registration') getRegisteredDevice.mockReturnValue({ ...registration });
				if (change === 'peer') getDevice.mockReturnValue(replacement);
				if (change === 'host') registration.host = peer.host = movedHost;
				if (change === 'disabled') registration.enabled = false;
				if (change === 'catalog binding') registration.catalog = { deviceId: device.id, mac };
				release.release();
				expect(await pending).toBe(false);
				expect(peer.setRelay).not.toHaveBeenCalled();
				expect(replacement.setRelay).not.toHaveBeenCalled();
			},
		);

		it('rechecks the capture immediately before dispatch after an upgraded pin is persisted', async () => {
			const { peer, registration, getRegisteredDevice, identities, http, write } = relay();
			const entered = gate();
			const release = gate();
			identities.findPin.mockResolvedValue({ mac, verifiedHost: null });
			http.getDeviceInfo.mockResolvedValue({ type: peer.type, mac });
			identities.confirmHost.mockImplementationOnce(async () => {
				entered.release();
				await release.promise;
				return true;
			});
			const pending = write(true);
			await entered.promise;
			getRegisteredDevice.mockReturnValue({ ...registration });
			release.release();
			expect(await pending).toBe(false);
			expect(peer.setRelay).not.toHaveBeenCalled();
		});

		it('uses the full-address relay without a configured host and rejects a conflicting catalog pin', async () => {
			const { device, peer, identities, http, write } = relay('shelly1pm-' + mac);
			device.hostname = null;
			expect(await write(true)).toBe(true);
			expect(peer.setRelay).toHaveBeenCalledWith(0, true);
			identities.findPin.mockResolvedValue({ mac: '112233ABC123', verifiedHost: originalHost, revision: 1 });
			expect(await write(true)).toBe(false);
			expect(peer.setRelay).toHaveBeenCalledTimes(1);
			expect(http.getDeviceInfo).not.toHaveBeenCalled();
		});

		it('requires the verified host for a pinned full-address relay, including OFF', async () => {
			const { device, peer, identities, http, write } = relay('shelly1pm-' + mac);
			device.hostname = null;
			identities.findPin.mockResolvedValue({ mac, verifiedHost: movedHost, revision: 1 });
			expect(await write(false)).toBe(false);
			expect(peer.setRelay).not.toHaveBeenCalled();
			expect(http.getDeviceInfo).not.toHaveBeenCalled();

			identities.findPin.mockResolvedValue({ mac, verifiedHost: originalHost, revision: 2 });
			expect(await write(false)).toBe(true);
			expect(peer.setRelay).toHaveBeenCalledWith(0, false);
		});

		it.each([originalHost, null])('confirms an older full-address pin with configured host %s', async (hostname) => {
			const { device, peer, identities, http, write } = relay('shelly1pm-' + mac);
			device.hostname = hostname;
			identities.findPin.mockResolvedValue({ mac, verifiedHost: null, revision: 1 });
			http.getDeviceInfo.mockResolvedValue({ type: peer.type, mac });
			identities.confirmHost.mockResolvedValueOnce(false);
			expect(await write(true)).toBe(false);
			expect(peer.setRelay).not.toHaveBeenCalled();
			expect(await write(true)).toBe(true);
			expect(identities.confirmHost).toHaveBeenCalledWith(device.id, mac, originalHost, null, 1);
			expect(peer.setRelay).toHaveBeenCalledWith(0, true);
		});

		it('keeps one captured endpoint for every relay in a batch', async () => {
			const { platform, device, peer, registration, getRegisteredDevice } = relay();
			const entered = gate();
			const release = gate();
			peer.setRelay.mockImplementationOnce(async () => {
				entered.release();
				await release.promise;
			});
			const pending = platform.processBatch([
				{ device, channel: makeChannel('first', 'relay_0'), property: makeProp('first-state'), value: true },
				{ device, channel: makeChannel('second', 'relay_1'), property: makeProp('second-state'), value: false },
			]);
			await entered.promise;
			getRegisteredDevice.mockReturnValue({ ...registration });
			release.release();
			expect(await pending).toBe(false);
			expect(peer.setRelay.mock.calls).toEqual([[0, true]]);
		});

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
		it.each([
			{ model: 'SHDM-2', index: 0, property: 'brightness', value: 0, expected: [0, false] },
			{ model: 'SHDM-2', index: 0, property: 'state', value: true, expected: [74, true] },
			{ model: 'SH2LED-1', index: 1, property: 'brightness', value: 0, expected: [1, 0, false] },
			{ model: 'SH2LED-1', index: 1, property: 'state', value: true, expected: [1, 74, true] },
			{ model: 'SHBDUO-1', index: 0, property: 'color_temperature', value: 5100, expected: [5100, 74, false] },
			{ model: 'SHBDUO-1', index: 0, property: 'brightness', value: 0, expected: [4300, 0, false] },
		])(
			'reads live white-light defaults after identity verification for $model $property',
			async ({ model, index, property, value, expected }) => {
				const device = makeDevice('lamp', 'ABC123');
				const peer = makeShellyDevice(model, device.identifier);
				peer.setColor = undefined;
				const switchKey = model === 'SH2LED-1' ? 'switch1' : 'switch';
				const brightnessKey = model === 'SH2LED-1' ? 'brightness1' : 'brightness';
				peer[switchKey] = true;
				peer[brightnessKey] = 19;
				peer.colorTemperature = 2900;
				const mac = 'AABBCCABC123';
				const registration: RegisteredDevice = {
					type: model,
					id: peer.id,
					host: peer.host,
					enabled: true,
					catalog: { deviceId: device.id, mac },
				};
				const { platform, identities } = makePlatform({
					getDevice: jest.fn().mockReturnValue(peer),
					getRegisteredDevice: jest.fn().mockReturnValue(registration),
				});
				identities.findPin.mockImplementationOnce(async () => {
					await Promise.resolve();
					peer[switchKey] = false;
					peer[brightnessKey] = 74;
					peer.colorTemperature = 4300;
					return { mac, verifiedHost: registration.host };
				});

				const ok = await platform.process({
					device,
					channel: makeChannel('light', `light_${index}`),
					property: makeProp('property', property),
					value,
				});
				expect(ok).toBe(true);
				expect(peer.setWhite.mock.calls).toEqual([expected]);
			},
		);

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

	describe('direct actuator registrations', () => {
		const actions = [
			{ model: 'SHRGBW2', channel: 'light_0', property: 'red', value: 28, setter: 'setColor' },
			{ model: 'SH2LED-1', channel: 'light_1', property: 'brightness', value: 65, setter: 'setWhite' },
			{ model: 'SHSW-25', channel: 'roller_0', property: 'position', value: 76, setter: 'setRollerPosition' },
			{ model: 'SHSW-25', channel: 'roller_0', property: 'command', value: 'stop', setter: 'setRollerState' },
		] as const;

		const directActuator = (action: (typeof actions)[number], identifier = 'ABC123') => {
			const device = makeDevice('physical', identifier);
			const peer = makeShellyDevice(action.model, device.identifier);
			if (action.model === 'SHSW-25') peer.mode = 'roller';
			if (action.model === 'SHRGBW2') peer.mode = 'color';
			const registration: RegisteredDevice = { type: peer.type, id: peer.id, host: peer.host, enabled: true };
			const { platform, identities, http } = makePlatform({
				getDevice: jest.fn().mockReturnValue(peer),
				getRegisteredDevice: jest.fn().mockReturnValue(registration),
			});
			const write = () =>
				platform.process({
					device,
					channel: makeChannel('channel', action.channel),
					property: makeProp('property', action.property),
					value: action.value,
				});
			return { device, peer, registration, identities, http, write };
		};

		it.each(actions)('checks the catalog pin or configured host for every direct short-ID $setter', async (action) => {
			const { device, peer, registration, identities, http, write } = directActuator(action);
			expect(await write()).toBe(true);
			registration.host = peer.host = '192.168.1.101';
			expect(await write()).toBe(false);
			const mac = 'AABBCCABC123';
			identities.findPin.mockResolvedValue({ mac, verifiedHost: device.hostname });
			expect(await write()).toBe(false);
			identities.findPin.mockResolvedValue({ mac: 'AABBCC331122', verifiedHost: peer.host });
			expect(await write()).toBe(false);
			identities.findPin.mockResolvedValue({ mac, verifiedHost: peer.host });
			expect(await write()).toBe(true);
			expect(peer[action.setter]).toHaveBeenCalledTimes(2);
			expect(http.getDeviceInfo).not.toHaveBeenCalled();
		});

		it.each(actions)('rejects $setter when the peer changes while its pin is being checked', async (action) => {
			const { peer, registration, identities, write } = directActuator(action);
			identities.findPin.mockImplementationOnce(async () => {
				await Promise.resolve();
				registration.host = peer.host = '192.168.1.101';
				return null;
			});
			expect(await write()).toBe(false);
			expect(peer[action.setter]).not.toHaveBeenCalled();
		});

		it.each([actions[0], actions[3]])(
			'keeps full-address and configured legacy controls working for $setter',
			async (action) => {
				const full = directActuator(action, 'AABBCCABC123');
				full.device.hostname = null;
				expect(await full.write()).toBe(true);
				full.identities.findPin.mockResolvedValue({ mac: '112233ABC123', verifiedHost: full.peer.host });
				expect(await full.write()).toBe(false);
				expect(full.peer[action.setter]).toHaveBeenCalledTimes(1);
				const legacy = directActuator(action, 'legacy-identifier');
				expect(await legacy.write()).toBe(true);
				legacy.device.hostname = null;
				expect(await legacy.write()).toBe(false);
				expect(legacy.peer[action.setter]).toHaveBeenCalledTimes(1);
			},
		);
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

	describe('Input channels', () => {
		it('should reject command execution on read-only input channels', async () => {
			const shellyDevice = makeShellyDevice('SHIX3-1');
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shellyi3-ABC123');
			const channel = makeChannel('ch-1', 'input_0');
			const property = makeProp('p-1', 'detected');

			const ok = await platform.processBatch([{ device, channel, property, value: true }]);

			expect(ok).toBe(false);
		});

		it('should reject command execution on read-only analog voltage channels', async () => {
			const shellyDevice = makeShellyDevice('SHUNI-1');
			const getDevice = jest.fn().mockReturnValue(shellyDevice);
			const { platform } = makePlatform({ getDevice });

			const device = makeDevice('dev-1', 'shellyuni-ABC123');
			const channel = makeChannel('ch-1', 'voltage_0');
			const property = makeProp('p-1', 'value');

			const ok = await platform.processBatch([{ device, channel, property, value: 12.5 }]);

			expect(ok).toBe(false);
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
