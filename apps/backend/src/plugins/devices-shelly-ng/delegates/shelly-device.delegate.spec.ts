/*
eslint-disable  @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports,
@typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { EventEmitter } from 'events';
import type { Component } from 'shellies-ds9';

import { ShellyDeviceDelegate } from './shelly-device.delegate';

jest.mock('shellies-ds9', () => {
	class BaseComponent extends EventEmitter {
		constructor(public key: string) {
			super();
		}
		update(values: Record<string, unknown>): void {
			for (const [key, value] of Object.entries(values)) {
				if ((this as Record<string, unknown>)[key] === value) continue;
				(this as Record<string, unknown>)[key] = value;
				this.emit('change', key, value);
			}
		}
		on(event: string, listener: (...args: unknown[]) => void): this {
			return super.on(event, listener);
		}
		off(event: string, listener: (...args: unknown[]) => void): this {
			return super.off(event, listener);
		}
	}

	class Switch extends BaseComponent {}
	class Light extends BaseComponent {}
	class Cover extends BaseComponent {}
	class Input extends BaseComponent {}
	class DevicePower extends BaseComponent {}
	class Humidity extends BaseComponent {}
	class Temperature extends BaseComponent {}
	class Pm1 extends BaseComponent {}
	class Em extends BaseComponent {}
	class EmData extends BaseComponent {}
	class Em1 extends BaseComponent {}
	class Em1Data extends BaseComponent {}

	class MockRpcHandler extends EventEmitter {
		constructor(public connected: boolean) {
			super();
		}
		triggerConnect() {
			this.connected = true;
			this.emit('connect');
		}
		triggerDisconnect(code = 1000, reason = 'bye', reconnectIn: number | null = null) {
			this.connected = false;
			this.emit('disconnect', code, reason, reconnectIn);
		}
		triggerRequest(method: string) {
			this.emit('request', method);
		}
	}

	class Device {
		public rpcHandler: MockRpcHandler;
		public shelly: { getStatus: jest.Mock };
		constructor(
			public id: string,
			public model: string,
			private compMap: Map<string, typeof Component>,
			connected = false,
		) {
			this.rpcHandler = new MockRpcHandler(connected);
			this.shelly = { getStatus: jest.fn().mockResolvedValue({}) };
		}
		hasComponent(key: string) {
			return this.compMap.has(key);
		}
		getComponent(key: string) {
			return this.compMap.get(key);
		}
	}

	class MultiProfileDevice extends Device {
		constructor(
			id: string,
			model: string,
			compMap: Map<string, typeof Component>,
			public profile: string,
			connected = false,
		) {
			super(id, model, compMap, connected);
		}
	}

	return {
		Switch,
		Light,
		Cover,
		Input,
		DevicePower,
		Humidity,
		Temperature,
		Pm1,
		Em,
		EmData,
		Em1,
		Em1Data,
		Device,
		MultiProfileDevice,
	};
});

jest.mock('../devices-shelly-ng.constants', () => {
	const {
		Switch,
		Light,
		Cover,
		Input,
		DevicePower,
		Humidity,
		Temperature,
		Pm1,
		Em,
		EmData,
		Em1,
		Em1Data,
	} = require('shellies-ds9');

	const DESCRIPTORS = {
		FAKE_GROUP: {
			models: ['FAKE_MODEL'],
			components: [
				{ type: 'switch', cls: Switch, ids: [0, 1] },
				{ type: 'light', cls: Light, ids: [0] },
				{ type: 'cover', cls: Cover, ids: [0] },
				{ type: 'input', cls: Input, ids: [0] },
				{ type: 'devicepower', cls: DevicePower, ids: [0] },
				{ type: 'humidity', cls: Humidity, ids: [0] },
				{ type: 'temperature', cls: Temperature, ids: [0] },
				// POZOR: typ pro PM1 musí odpovídat ComponentType.PM1 v implementaci
				{ type: 'pm1', cls: Pm1, ids: [0] },
				{ type: 'em', cls: Em, ids: [0] },
				{ type: 'emdata', cls: EmData, ids: [0] },
				{ type: 'em1', cls: Em1, ids: [0] },
				{ type: 'em1data', cls: Em1Data, ids: [0] },
			],
		},
	};

	return {
		DESCRIPTORS,
		ComponentType: {
			SWITCH: 'switch',
			LIGHT: 'light',
			COVER: 'cover',
			PM1: 'pm1',
			EM: 'em',
			EM_DATA: 'emdata',
			EM1: 'em1',
			EM1_DATA: 'em1data',
			INPUT: 'input',
			DEVICE_POWER: 'devicepower',
			HUMIDITY: 'humidity',
			TEMPERATURE: 'temperature',
		},
		DeviceProfile: {
			COVER: 'cover',
			SWITCH: 'switch',
		},
	};
});

describe('ShellyDeviceDelegate', () => {
	test('constructs for supported model and wires components', () => {
		const {
			Switch,
			Light,
			Cover,
			Input,
			DevicePower,
			Humidity,
			Temperature,
			Pm1,
			Em,
			EmData,
			Em1,
			Em1Data,
		} = require('shellies-ds9');

		const comps = new Map<string, typeof Component>([
			['switch:0', new Switch('switch:0')],
			['switch:1', new Switch('switch:1')],
			['light:0', new Light('light:0')],
			['cover:0', new Cover('cover:0')],
			['input:0', new Input('input:0')],
			['devicepower:0', new DevicePower('devicepower:0')],
			['humidity:0', new Humidity('humidity:0')],
			['temperature:0', new Temperature('temperature:0')],
			// PM1 – klíč musí odpovídat type 'pm1'
			['pm1:0', new Pm1('pm1:0')],
			['em:0', new Em('em:0')],
			['emdata:0', new EmData('emdata:0')],
			['em1:0', new Em1('em1:0')],
			['em1data:0', new Em1Data('em1data:0')],
		]);

		const { Device } = require('shellies-ds9');
		const dev = new Device('dev-1', 'FAKE_MODEL', comps, true);
		const delegate = new ShellyDeviceDelegate(dev);

		expect(delegate.connected).toBe(true);
		expect(delegate.switches.size).toBe(2);
		expect(delegate.lights.size).toBe(1);
		expect(delegate.covers.size).toBe(1);
		expect(delegate.inputs.size).toBe(1);
		expect(delegate.devPwr.size).toBe(1);
		expect(delegate.humidity.size).toBe(1);
		expect(delegate.temperature.size).toBe(1);
		expect(delegate.pm1.size).toBe(1);
		expect(delegate.em.size).toBe(1);
		expect(delegate.emData.size).toBe(1);
		expect(delegate.em1.size).toBe(1);
		expect(delegate.em1Data.size).toBe(1);
		expect(delegate.components.has('switch:0')).toBe(true);
		expect(delegate.components.has('light:0')).toBe(true);
		expect(delegate.components.has('em:0')).toBe(true);
		expect(delegate.components.has('em1data:0')).toBe(true);
	});

	test('typed em/emData/em1/em1Data maps hold the right component instances', () => {
		const { Em, EmData, Em1, Em1Data, Device } = require('shellies-ds9');

		const em = new Em('em:0');
		const emData = new EmData('emdata:0');
		const em1 = new Em1('em1:0');
		const em1Data = new Em1Data('em1data:0');

		const comps = new Map<string, typeof Component>([
			['em:0', em],
			['emdata:0', emData],
			['em1:0', em1],
			['em1data:0', em1Data],
		]);

		const dev = new Device('dev-1b', 'FAKE_MODEL', comps, true);
		const delegate = new ShellyDeviceDelegate(dev);

		expect(delegate.em.get(0)).toBe(em);
		expect(delegate.emData.get(0)).toBe(emData);
		expect(delegate.em1.get(0)).toBe(em1);
		expect(delegate.em1Data.get(0)).toBe(em1Data);
	});

	test('propagates component "change" into delegate "value"', (done) => {
		const { Switch, Device } = require('shellies-ds9');

		const sw = new Switch('switch:0');
		const comps = new Map<string, typeof Component>([['switch:0', sw]]);
		const dev = new Device('dev-2', 'FAKE_MODEL', comps, true);

		const delegate = new ShellyDeviceDelegate(dev);

		delegate.on('value', (compKey: string, char: string, val: unknown) => {
			try {
				expect(compKey).toBe('switch:0');
				expect(char).toBe('output');
				expect(val).toBe(true);
				done();
			} catch (e) {
				done(e);
			}
		});

		sw.emit('change', 'output', true);
	});

	test('propagates an object change as both the parent key and its flattened leaves', () => {
		const { Switch, Device } = require('shellies-ds9');

		const sw = new Switch('switch:0');
		const comps = new Map<string, typeof Component>([['switch:0', sw]]);
		const dev = new Device('dev-2b', 'FAKE_MODEL', comps, true);

		const delegate = new ShellyDeviceDelegate(dev);

		const received: [string, string, unknown][] = [];
		delegate.on('value', (compKey: string, char: string, val: unknown) => {
			received.push([compKey, char, val]);
		});

		sw.emit('change', 'aenergy', { total: 12.345, by_minute: [0, 0, 0], minute_ts: 111 });

		const keys = received.map(([, char]) => char);

		expect(keys).toEqual(
			expect.arrayContaining(['aenergy', 'aenergy.total', 'aenergy.by_minute', 'aenergy.minute_ts']),
		);

		const parent = received.find(([, char]) => char === 'aenergy');
		expect(parent?.[2]).toEqual({ total: 12.345, by_minute: [0, 0, 0], minute_ts: 111 });

		const total = received.find(([, char]) => char === 'aenergy.total');
		expect(total?.[2]).toBe(12.345);

		// by_minute is an array - it must be emitted as a leaf, not recursed into.
		const byMinute = received.find(([, char]) => char === 'aenergy.by_minute');
		expect(byMinute?.[2]).toEqual([0, 0, 0]);
	});

	test('emits connected events on rpc connect/disconnect', () => {
		const { Switch, Device } = require('shellies-ds9');

		const sw = new Switch('switch:0');
		const comps = new Map<string, typeof Component>([['switch:0', sw]]);
		const dev = new Device('dev-3', 'FAKE_MODEL', comps, false);

		const delegate = new ShellyDeviceDelegate(dev);
		const states: boolean[] = [];
		delegate.on('connected', (st: boolean) => states.push(st));

		dev.rpcHandler.triggerConnect();
		dev.rpcHandler.triggerDisconnect(1000, 'bye', 5000);

		expect(states).toEqual([true, false]);
		expect(delegate.connected).toBe(false);
	});

	test('detach removes listeners and stops forwarding changes', () => {
		const { Switch, Device } = require('shellies-ds9');

		const sw = new Switch('switch:0');
		const comps = new Map<string, typeof Component>([['switch:0', sw]]);
		const dev = new Device('dev-4', 'FAKE_MODEL', comps, true);

		const delegate = new ShellyDeviceDelegate(dev);
		const spy = jest.fn();
		delegate.on('value', spy);

		sw.emit('change', 'output', true);
		expect(spy).toHaveBeenCalledTimes(1);

		delegate.detach();
		sw.emit('change', 'output', false);
		expect(spy).toHaveBeenCalledTimes(1);
	});

	test('multi-profile: profile=cover → switches skipped, covers included', () => {
		const { Switch, Cover, MultiProfileDevice } = require('shellies-ds9');

		const sw = new Switch('switch:0');
		const cov = new Cover('cover:0');
		const comps = new Map<string, typeof Component>([
			['switch:0', sw],
			['cover:0', cov],
		]);

		const dev = new MultiProfileDevice('dev-5', 'FAKE_MODEL', comps, 'cover', true);

		const delegate = new ShellyDeviceDelegate(dev);

		expect(delegate.covers.size).toBe(1);
		expect(delegate.switches.size).toBe(0);
	});

	test('multi-profile: profile!=cover → covers skipped, switches included', () => {
		const { Switch, Cover, MultiProfileDevice } = require('shellies-ds9');

		const sw = new Switch('switch:0');
		const cov = new Cover('cover:0');
		const comps = new Map<string, typeof Component>([
			['switch:0', sw],
			['cover:0', cov],
		]);

		// Profile "switch" – teď odpovídá DeviceProfile.SWITCH v mocku
		const dev = new MultiProfileDevice('dev-6', 'FAKE_MODEL', comps, 'switch', true);

		const delegate = new ShellyDeviceDelegate(dev);

		expect(delegate.covers.size).toBe(0);
		expect(delegate.switches.size).toBe(1);
	});

	test('does not overwrite a notification received while a poll is in flight', async () => {
		const { Switch, Device } = require('shellies-ds9');
		const sw = new Switch('switch:0');
		sw.output = false;
		const dev = new Device('dev-poll-notify', 'FAKE_MODEL', new Map([['switch:0', sw]]), true);
		let resolveStatus!: (status: Record<string, unknown>) => void;
		dev.shelly.getStatus.mockImplementation(
			() => new Promise((resolve: (status: Record<string, unknown>) => void) => (resolveStatus = resolve)),
		);
		const delegate = new ShellyDeviceDelegate(dev);
		const values = jest.fn();
		delegate.on('value', values);

		const poll = delegate.pollStatus();
		sw.update({ output: true });
		resolveStatus({ 'switch:0': { output: false } });

		await expect(poll).resolves.toBe(true);
		expect(sw.output).toBe(true);
		expect(values).toHaveBeenCalledWith('switch:0', 'output', true, 'notify');
		expect(values).not.toHaveBeenCalledWith('switch:0', 'output', false, 'poll');
	});

	test('marks synchronous status application as a poll', async () => {
		const { Switch, Device } = require('shellies-ds9');
		const sw = new Switch('switch:0');
		sw.output = false;
		const dev = new Device('dev-poll', 'FAKE_MODEL', new Map([['switch:0', sw]]), true);
		dev.shelly.getStatus.mockResolvedValue({ 'switch:0': { output: true } });
		const delegate = new ShellyDeviceDelegate(dev);
		const values = jest.fn();
		delegate.on('value', values);

		await expect(delegate.pollStatus()).resolves.toBe(true);
		expect(values).toHaveBeenCalledWith('switch:0', 'output', true, 'poll');
	});

	test('unsupported model throws', () => {
		const { Device } = require('shellies-ds9');

		const comps = new Map<string, typeof Component>();
		const dev = new Device('dev-7', 'UNKNOWN', comps, true);

		expect(() => new ShellyDeviceDelegate(dev)).toThrow('Device is not supported.');
	});
});
