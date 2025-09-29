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
		constructor(
			public id: string,
			public model: string,
			private compMap: Map<string, typeof Component>,
			connected = false,
		) {
			this.rpcHandler = new MockRpcHandler(connected);
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
		Device,
		MultiProfileDevice,
	};
});

jest.mock('../devices-shelly-ng.constants', () => {
	const { Switch, Light, Cover, Input, DevicePower, Humidity, Temperature, Pm1 } = require('shellies-ds9');

	const DESCRIPTORS = {
		FAKE_GROUP: {
			models: ['FAKE_MODEL'],
			components: [
				{ type: 'switch', cls: Switch, ids: [0, 1] },
				{ type: 'light', cls: Light, ids: [0] },
				{ type: 'cover', cls: Cover, ids: [0] },
				{ type: 'input', cls: Input, ids: [0] },
				{ type: 'devicePower', cls: DevicePower, ids: [0] },
				{ type: 'humidity', cls: Humidity, ids: [0] },
				{ type: 'temperature', cls: Temperature, ids: [0] },
				{ type: 'pm', cls: Pm1, ids: [0] },
			],
		},
	};

	return {
		DESCRIPTORS,
		ComponentType: {
			SWITCH: 'switch',
			LIGHT: 'light',
			COVER: 'cover',
			PM: 'pm',
			INPUT: 'input',
			DEVICE_POWER: 'devicePower',
			HUMIDITY: 'humidity',
			TEMPERATURE: 'temperature',
		},
		DeviceProfile: {
			COVER: 'cover',
		},
	};
});

describe('ShellyDeviceDelegate', () => {
	test('constructs for supported model and wires components', () => {
		const comps = new Map<string, typeof Component>([
			['switch:0', new (require('shellies-ds9').Switch)('switch:0')],
			['switch:1', new (require('shellies-ds9').Switch)('switch:1')],
			['light:0', new (require('shellies-ds9').Light)('light:0')],
			['cover:0', new (require('shellies-ds9').Cover)('cover:0')],
			['input:0', new (require('shellies-ds9').Input)('input:0')],
			['devicePower:0', new (require('shellies-ds9').DevicePower)('devicePower:0')],
			['humidity:0', new (require('shellies-ds9').Humidity)('humidity:0')],
			['temperature:0', new (require('shellies-ds9').Temperature)('temperature:0')],
			['pm:0', new (require('shellies-ds9').Pm1)('pm:0')],
		]);

		const dev = new (require('shellies-ds9').Device)('dev-1', 'FAKE_MODEL', comps, true);
		const delegate = new ShellyDeviceDelegate(dev);

		expect(delegate.connected).toBe(true);
		expect(delegate.switches.size).toBe(2);
		expect(delegate.lights.size).toBe(1);
		expect(delegate.covers.size).toBe(1);
		expect(delegate.inputs.size).toBe(1);
		expect(delegate.devPwr.size).toBe(1);
		expect(delegate.hums.size).toBe(1);
		expect(delegate.temps.size).toBe(1);
		expect(delegate.powerMeter.size).toBe(1);
		expect(delegate.components.has('switch:0')).toBe(true);
		expect(delegate.components.has('light:0')).toBe(true);
	});

	test('propagates component "change" into delegate "value"', (done) => {
		const sw = new (require('shellies-ds9').Switch)('switch:0');
		const comps = new Map<string, typeof Component>([['switch:0', sw]]);
		const dev = new (require('shellies-ds9').Device)('dev-2', 'FAKE_MODEL', comps, true);

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

	test('emits connected events on rpc connect/disconnect', () => {
		const sw = new (require('shellies-ds9').Switch)('switch:0');
		const comps = new Map<string, typeof Component>([['switch:0', sw]]);
		const dev = new (require('shellies-ds9').Device)('dev-3', 'FAKE_MODEL', comps, false);

		const delegate = new ShellyDeviceDelegate(dev);
		const states: boolean[] = [];
		delegate.on('connected', (st: boolean) => states.push(st));

		dev.rpcHandler.triggerConnect();
		dev.rpcHandler.triggerDisconnect(1000, 'bye', 5000);

		expect(states).toEqual([true, false]);
		expect(delegate.connected).toBe(false);
	});

	test('detach removes listeners and stops forwarding changes', () => {
		const sw = new (require('shellies-ds9').Switch)('switch:0');
		const comps = new Map<string, typeof Component>([['switch:0', sw]]);
		const dev = new (require('shellies-ds9').Device)('dev-4', 'FAKE_MODEL', comps, true);

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
		const sw = new (require('shellies-ds9').Switch)('switch:0');
		const cov = new (require('shellies-ds9').Cover)('cover:0');
		const comps = new Map<string, typeof Component>([
			['switch:0', sw],
			['cover:0', cov],
		]);
		const dev = new (require('shellies-ds9').MultiProfileDevice)('dev-5', 'FAKE_MODEL', comps, 'cover', true);

		const delegate = new ShellyDeviceDelegate(dev);

		expect(delegate.covers.size).toBe(1);
		expect(delegate.switches.size).toBe(0);
	});

	test('multi-profile: profile!=cover → covers skipped, switches included', () => {
		const sw = new (require('shellies-ds9').Switch)('switch:0');
		const cov = new (require('shellies-ds9').Cover)('cover:0');
		const comps = new Map<string, typeof Component>([
			['switch:0', sw],
			['cover:0', cov],
		]);
		const dev = new (require('shellies-ds9').MultiProfileDevice)('dev-6', 'FAKE_MODEL', comps, 'switch', true);

		const delegate = new ShellyDeviceDelegate(dev);

		expect(delegate.covers.size).toBe(0);
		expect(delegate.switches.size).toBe(1);
	});

	test('unsupported model throws', () => {
		const comps = new Map<string, typeof Component>();
		const dev = new (require('shellies-ds9').Device)('dev-7', 'UNKNOWN', comps, true);

		expect(() => new ShellyDeviceDelegate(dev)).toThrow('Device is not supported.');
	});
});
