/*
eslint-disable  @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports,
@typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await,
@typescript-eslint/no-unnecessary-type-assertion
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { EventEmitter } from 'events';
import { Device } from 'shellies-ds9';

import { Logger } from '@nestjs/common';

import {
	ChannelCategory,
	ConnectionState,
	DeviceCategory,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { CreateShellyNgDeviceDto } from '../dto/create-device.dto';
import { ShellyNgChannelPropertyEntity, ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';

import { DelegatesManagerService } from './delegates-manager.service';

type Id = string;

const mkId = (() => {
	let n = 1;
	return () => String(n++);
})();

class MockShellyNgDeviceEntity {
	id: Id = mkId();
	type = DEVICES_SHELLY_NG_TYPE;
	category = DeviceCategory.SWITCHER;
	identifier!: string;
	hostname!: string | null;
	name!: string;
}

class MockShellyNgChannelEntity {
	id: Id = mkId();
	type = DEVICES_SHELLY_NG_TYPE;
	device: Id | MockShellyNgDeviceEntity;
	category!: ChannelCategory;
	identifier!: string | null;
	name!: string;
	constructor(init: Partial<MockShellyNgChannelEntity>) {
		Object.assign(this, init);
	}
}

class MockShellyNgChannelPropertyEntity {
	id: Id = mkId();
	channel: Id | MockShellyNgChannelEntity;
	category!: PropertyCategory;
	identifier!: string | null;
	value: string | number | boolean | null = null;
	constructor(init: Partial<MockShellyNgChannelPropertyEntity>) {
		Object.assign(this, init);
	}
}

// --- Mock dependent services
const devicesService = {
	findOneBy: jest.fn(),
	create: jest.fn(),
	update: jest.fn(),
};

const channelsService = {
	findOneBy: jest.fn(),
};

const channelsPropertiesService = {
	findOneBy: jest.fn(),
	update: jest.fn(),
};

// --- Fake Shelly Device + Delegate plumbing
type Wifi = { key: string; rssi: number; sta_ip?: string | null };

type FakeSwitch = {
	id: number;
	key: string;
	output: boolean;
	apower?: number;
	voltage?: number;
	current?: number;
	aenergy?: number | { total: number };
	set: (v: boolean) => Promise<{ was_on: boolean }>;
};

type FakeLight = FakeSwitch & { brightness?: number };

type FakeCover = {
	id: number;
	key: string;
	state: string;
	current_pos: number;
	open: () => Promise<void>;
	close: () => Promise<void>;
	stop: () => Promise<void>;
	goToPosition: (p: number) => Promise<void>;
};

type FakeDevice = {
	id: string;
	modelName: string;
	system: { config: { device: { name: string | null } } };
	wifi?: Wifi;
	ethernet?: { key: string; ip: string | null };
	switch?: { key: string; output: boolean };
};

// Lightweight mock delegate that mirrors the signals the manager listens to.
class MockShellyDeviceDelegate extends EventEmitter {
	constructor(public readonly shelly: FakeDevice) {
		super();
		this.id = shelly.id;
	}
	id: string;

	// component maps the manager iterates
	switches: Map<number, FakeSwitch> = new Map();
	lights: Map<number, FakeLight> = new Map();
	covers: Map<number, FakeCover> = new Map();
	inputs = new Map();
	devPwr = new Map();
	hums = new Map();
	temps = new Map();
	powerMeter = new Map();

	// helpers to simulate device emitting updates
	emitValue(compKey: string, attr: string, value: unknown) {
		this.emit('value', compKey, attr, value);
	}
	emitConnected(state: boolean | null) {
		this.emit('connected', state);
	}
}

jest.mock('../delegates/shelly-device.delegate', () => {
	const { EventEmitter } = require('events');

	class MockShellyDeviceDelegate extends EventEmitter {
		constructor(shelly) {
			super();
			this.shelly = shelly;
			this.id = shelly.id;
			// component maps the manager iterates over
			this.switches = new Map();
			this.lights = new Map();
			this.covers = new Map();
			this.inputs = new Map();
			this.devPwr = new Map();
			this.hums = new Map();
			this.temps = new Map();
			this.powerMeter = new Map();

			if (shelly.switch) {
				this.switches.set(0, shelly.switch);
			}
		}
		emitValue(compKey, attr, value) {
			this.emit('value', compKey, attr, value);
		}
		emitConnected(state) {
			this.emit('connected', state);
		}
	}

	return { ShellyDeviceDelegate: MockShellyDeviceDelegate };
});

// Silence Nest logger in tests
jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

describe('DelegatesManagerService', () => {
	let svc: DelegatesManagerService;

	beforeEach(() => {
		jest.resetAllMocks();

		svc = new DelegatesManagerService(
			// @ts-expect-error bare mock
			devicesService,
			channelsService,
			channelsPropertiesService,
		);
	});

	function arrangeBaseEntities() {
		const device = new MockShellyNgDeviceEntity();
		const deviceInfoCh = new MockShellyNgChannelEntity({
			device: device.id,
			category: ChannelCategory.DEVICE_INFORMATION,
			identifier: 'device-information',
			name: 'Device information',
		});

		const statusProp = new MockShellyNgChannelPropertyEntity({
			channel: deviceInfoCh.id,
			category: PropertyCategory.STATUS,
			identifier: 'status',
			value: ConnectionState.UNKNOWN,
		});

		const linkQProp = new MockShellyNgChannelPropertyEntity({
			channel: deviceInfoCh.id,
			category: PropertyCategory.LINK_QUALITY,
			identifier: 'link_quality',
			value: 0,
		});

		// Per-switch channels/props for switch:0
		const switchCh = new MockShellyNgChannelEntity({
			device: device.id,
			category: ChannelCategory.SWITCHER,
			identifier: 'switch:0',
			name: 'Switch 0',
		});

		const switchOn = new MockShellyNgChannelPropertyEntity({
			channel: switchCh.id,
			category: PropertyCategory.ON,
			identifier: 'output',
			value: false,
		});

		// wire mocks
		(devicesService.findOneBy as jest.Mock).mockResolvedValueOnce(null);
		(devicesService.create as jest.Mock).mockImplementation(async (dto: CreateShellyNgDeviceDto) => {
			device.identifier = dto.identifier;
			device.hostname = dto.hostname;
			device.name = dto.name;
			device.category = dto.category;
			return device;
		});

		(channelsService.findOneBy as jest.Mock).mockImplementationOnce(async () => deviceInfoCh);
		(channelsService.findOneBy as jest.Mock).mockImplementationOnce(async () => switchCh);

		(channelsPropertiesService.findOneBy as jest.Mock).mockImplementationOnce(async () => statusProp);
		(channelsPropertiesService.findOneBy as jest.Mock).mockImplementationOnce(async () => linkQProp);
		(channelsPropertiesService.findOneBy as jest.Mock).mockImplementationOnce(async () => switchOn);

		(channelsPropertiesService.update as jest.Mock).mockImplementation(async (_id, payload: unknown) => payload);

		return { device, deviceInfoCh, statusProp, linkQProp, switchCh, switchOn };
	}

	test('insert() wires up and writes initial values (wifi → link quality, switch output)', async () => {
		const { switchOn, linkQProp } = arrangeBaseEntities();

		// Fake Shelly device + one switch
		const shelly: FakeDevice = {
			id: 'shelly123',
			modelName: 'Plus 1',
			system: { config: { device: { name: 'My Shelly' } } },
			wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.10' },
			switch: { key: 'switch:0', output: false },
		};

		const delegate = (await svc.insert(shelly as unknown as Device)) as unknown as MockShellyDeviceDelegate;

		// add one switch AFTER construction (test doesn’t need full descriptor path)
		delegate.switches.set(0, {
			id: 0,
			key: 'switch:0',
			output: true,
			set: async (v: boolean) => ({ was_on: !v }),
		});

		// Simulate the delegate emitting initial events:
		delegate.emitValue('switch:0', 'output', true);

		const updates = (channelsPropertiesService.update as jest.Mock).mock.calls.map(([, payload]): unknown => payload);

		expect(updates.some((p: MockShellyNgChannelPropertyEntity) => p.value === 80)).toBe(true);
		expect(updates.some((p: MockShellyNgChannelPropertyEntity) => p.value === true)).toBe(true);

		expect((channelsPropertiesService.update as jest.Mock).mock.calls.map(([id]: string[]): string => id)).toEqual(
			expect.arrayContaining([linkQProp.id, switchOn.id]),
		);
	});

	test('setPropertyValue() calls stored set handler', async () => {
		arrangeBaseEntities();

		const shelly: FakeDevice = {
			id: 'shelly-set',
			modelName: 'Plus 1',
			system: { config: { device: { name: 'My Shelly' } } },
			wifi: { key: 'wifi:0', rssi: -70, sta_ip: '192.168.1.22' },
		};

		const delegate = (await svc.insert(shelly as unknown as Device)) as unknown as MockShellyDeviceDelegate;

		// create a switch with a set() we can observe
		const setSpy = jest.fn(async (v: boolean) => ({ was_on: !v }));
		delegate.switches.set(0, {
			id: 0,
			key: 'switch:0',
			output: false,
			set: setSpy,
		});

		// we need the ON property id that the manager computed & stored a handler for.
		// Simplify: the handler key format is `${delegate.id}|${switchOn.id}`
		// We'll grab a property id by faking what insert() would have found earlier:
		const somePropertyId = 'prop-output-1';
		// Pretend the set handler is there:
		svc['setHandlers'].set(`${delegate.id}|${somePropertyId}`, async (v: unknown) => {
			if (typeof v !== 'boolean') return false;
			await setSpy(v);
			return true;
		});

		const ok = await svc.setPropertyValue(
			{ id: 'dev1', identifier: delegate.id } as unknown as ShellyNgDeviceEntity,
			{ id: somePropertyId } as unknown as ShellyNgChannelPropertyEntity,
			true,
		);

		expect(ok).toBe(true);
		expect(setSpy).toHaveBeenCalledWith(true);
	});

	test('remove() detaches and clears internal state', async () => {
		arrangeBaseEntities();

		const shelly: FakeDevice = {
			id: 'shelly-remove',
			modelName: 'Plus 1',
			system: { config: { device: { name: 'X' } } },
			wifi: { key: 'wifi:0', rssi: -55, sta_ip: '192.168.1.30' },
		};

		const delegate = (await svc.insert(shelly as Device)) as unknown as MockShellyDeviceDelegate;

		// store a timer
		svc['pendingWrites'].set(
			'p1',
			setTimeout(() => {}, 10),
		);

		// store handler maps entries
		svc['changeHandlers'].set(`${delegate.id}|switch:0|output`, () => {});
		svc['setHandlers'].set(`${delegate.id}|prop-1`, async () => true);
		svc['propertiesMap'].set(delegate.id, new Set(['p1']));

		svc.remove(delegate.id);

		// listeners should be gone (emitting now should do nothing but not throw)
		delegate.emitValue('switch:0', 'output', false);
		delegate.emitConnected(false);

		// internals cleared
		expect(svc['changeHandlers'].size).toBe(0);
		expect(svc['setHandlers'].size).toBe(0);
		expect(svc['propertiesMap'].has(delegate.id)).toBe(false);
	});
});
