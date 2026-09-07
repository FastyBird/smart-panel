/*
eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports,
@typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await,
@typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-argument
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Device } from 'shellies-ds9';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';

import { ChannelCategory, ConnectionState, PropertyCategory } from '../../../modules/devices/devices.constants';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { CreateShellyNgDeviceDto } from '../dto/create-device.dto';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';

import { DelegatesManagerService } from './delegates-manager.service';

const devicesService = {
	findOne: jest.fn(),
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

const deviceConnectivityService = {
	setConnectionState: jest.fn().mockResolvedValue(undefined),
};

const propertyMappingStorage = {
	store: jest.fn(),
	get: jest.fn(),
	remove: jest.fn(),
	clear: jest.fn(),
	getPropertyIdsForChannel: jest.fn().mockReturnValue([]),
};

const deviceManagerService = {
	createOrUpdate: jest.fn().mockResolvedValue({}),
};

const deviceAddressService = {
	findDeviceByCanonicalMac: jest.fn().mockResolvedValue(null),
	setCanonicalMac: jest.fn().mockResolvedValue(undefined),
	syncAddresses: jest.fn().mockResolvedValue(undefined),
	getPreferredAddress: jest.fn().mockResolvedValue('192.168.1.10'),
	getPreferredAddresses: jest.fn().mockResolvedValue(new Map()),
	upsertAddress: jest.fn().mockResolvedValue(undefined),
	getAddresses: jest.fn().mockResolvedValue([]),
};

const transformerRegistry = {
	get: jest.fn().mockReturnValue(null),
};

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

type FakePm1 = {
	id: number;
	key: string;
	apower: number;
	voltage?: number;
	current?: number;
	aenergy?: number | { total: number };
};

type FakeDevicePower = {
	id: number;
	key: string;
	battery: { percent: number };
};

// Minimal fixtures for the RC3 (PR3) electrical-wiring tests. Brightness/rgb/white are
// deliberately omitted so the loop's optional sub-blocks (which need their own property
// mocks) stay inert, keeping the mock queue focused on the electrical wiring under test.
type FakeCover = {
	id: number;
	key: string;
	state: string;
	current_pos: number;
	apower?: number;
	voltage?: number;
	current?: number;
	aenergy?: number | { total: number };
};

type FakeLight = {
	id: number;
	key: string;
	output: boolean;
	apower?: number;
	voltage?: number;
	current?: number;
	aenergy?: number | { total: number };
};

type FakeRgb = FakeLight;

type FakeRgbw = FakeLight;

// CCT never reports `aenergy` (no energy metering on this component) — no such field here.
type FakeCct = {
	id: number;
	key: string;
	output: boolean;
	apower?: number;
	voltage?: number;
	current?: number;
};

// Fields are optional (rather than `number | null`) so a test can leave everything but the
// one reading under test as `undefined` — `wireMeterProperty` skips a reading entirely (no
// findOneBy calls at all) when it is `undefined`, which keeps the mock queue setup minimal.
// A `null` value (present, but a CT clamp is not connected) still queues a lookup.
type FakeEm = {
	id: number;
	key: string;
	a_act_power?: number | null;
	a_voltage?: number | null;
	a_current?: number | null;
	a_freq?: number | null;
	b_act_power?: number | null;
	b_voltage?: number | null;
	b_current?: number | null;
	b_freq?: number | null;
	c_act_power?: number | null;
	c_voltage?: number | null;
	c_current?: number | null;
	c_freq?: number | null;
	total_act_power?: number | null;
	total_current?: number | null;
};

type FakeEmData = {
	id: number;
	key: string;
	a_total_act_energy?: number;
	a_total_act_ret_energy?: number;
	b_total_act_energy?: number;
	b_total_act_ret_energy?: number;
	c_total_act_energy?: number;
	c_total_act_ret_energy?: number;
	total_act?: number;
	total_act_ret?: number;
};

type FakeEm1 = {
	id: number;
	key: string;
	act_power?: number | null;
	voltage?: number | null;
	current?: number | null;
	freq?: number | null;
};

type FakeEm1Data = {
	id: number;
	key: string;
	total_act_energy?: number;
	total_act_ret_energy?: number;
};

type FakeDevice = {
	id: string;
	modelName: string;
	system: { config: { device: { name: string | null; mac: string } } };
	wifi?: Wifi;
	ethernet?: { key: string; ip: string | null };
	switch?: { key: string; output: boolean; aenergy?: number | { total: number } };
	pm1?: FakePm1;
	devicePower?: FakeDevicePower;
	cover?: FakeCover;
	light?: FakeLight;
	rgb?: FakeRgb;
	rgbw?: FakeRgbw;
	cct?: FakeCct;
	em?: FakeEm;
	emData?: FakeEmData;
	em1?: FakeEm1;
	em1Data?: FakeEm1Data;
};

jest.mock('../delegates/shelly-device.delegate', () => {
	const { EventEmitter } = require('events');

	class MockShellyDeviceDelegate extends EventEmitter {
		constructor(shelly) {
			super();
			this.shelly = shelly;
			this.id = shelly.id;
			this.connected = true;

			// component maps the manager iterates over
			this.switches = new Map();
			this.lights = new Map();
			this.rgb = new Map();
			this.rgbw = new Map();
			this.cct = new Map();
			this.covers = new Map();
			this.inputs = new Map();
			this.devPwr = new Map();
			this.humidity = new Map();
			this.temperature = new Map();
			this.pm1 = new Map();
			this.em = new Map();
			this.emData = new Map();
			this.em1 = new Map();
			this.em1Data = new Map();

			// simple one-switch wiring for tests
			if (shelly.switch) {
				this.switches.set(0, shelly.switch);
			}
			if (shelly.pm1) {
				this.pm1.set(0, shelly.pm1);
			}
			if (shelly.devicePower) {
				this.devPwr.set(0, shelly.devicePower);
			}
			if (shelly.cover) {
				this.covers.set(0, shelly.cover);
			}
			if (shelly.light) {
				this.lights.set(0, shelly.light);
			}
			if (shelly.rgb) {
				this.rgb.set(0, shelly.rgb);
			}
			if (shelly.rgbw) {
				this.rgbw.set(0, shelly.rgbw);
			}
			if (shelly.cct) {
				this.cct.set(0, shelly.cct);
			}
			// EM/EM1/EMData/EM1Data key on the fixture's own id (rather than hard-coded 0) so
			// tests can exercise a non-zero component id, e.g. a second em1data meter.
			if (shelly.em) {
				this.em.set(shelly.em.id, shelly.em);
			}
			if (shelly.emData) {
				this.emData.set(shelly.emData.id, shelly.emData);
			}
			if (shelly.em1) {
				this.em1.set(shelly.em1.id, shelly.em1);
			}
			if (shelly.em1Data) {
				this.em1Data.set(shelly.em1Data.id, shelly.em1Data);
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

		deviceConnectivityService.setConnectionState = jest.fn().mockResolvedValue(undefined);

		svc = new DelegatesManagerService(
			devicesService as any,
			channelsService as any,
			channelsPropertiesService as any,
			deviceConnectivityService as any,
			deviceManagerService as any,
			deviceAddressService as any,
			propertyMappingStorage as any,
			transformerRegistry as any,
		);
	});

	function arrangeBaseEntities() {
		const device = {
			id: uuid().toString(),
		} as ShellyNgDeviceEntity;

		const deviceInfoCh = {
			device: device.id,
			category: ChannelCategory.DEVICE_INFORMATION,
			identifier: 'device-information',
			name: 'Device information',
		} as ShellyNgChannelEntity;

		const statusProp = {
			channel: deviceInfoCh.id,
			category: PropertyCategory.STATUS,
			identifier: 'status',
			value: new PropertyValueState(ConnectionState.UNKNOWN),
		} as ShellyNgChannelPropertyEntity;

		const linkQProp = {
			channel: deviceInfoCh.id,
			category: PropertyCategory.LINK_QUALITY,
			identifier: 'link_quality',
			value: new PropertyValueState(0),
		} as ShellyNgChannelPropertyEntity;

		const switchCh = {
			device: device.id,
			category: ChannelCategory.SWITCHER,
			identifier: 'switch:0',
			name: 'Switch 0',
		} as ShellyNgChannelEntity;

		const switchOn = {
			channel: switchCh.id,
			category: PropertyCategory.ON,
			identifier: 'output',
			value: new PropertyValueState(false),
		} as ShellyNgChannelPropertyEntity;

		// devicesService mocks
		(devicesService.findOneBy as jest.Mock).mockResolvedValueOnce(null); // first call: device not found → create
		(devicesService.findOne as jest.Mock).mockResolvedValueOnce(device as unknown as ShellyNgDeviceEntity); // reload after createOrUpdate
		(devicesService.create as jest.Mock).mockImplementation(
			async (dto: CreateShellyNgDeviceDto): Promise<ShellyNgDeviceEntity> => {
				device.identifier = dto.identifier;
				device.name = dto.name;
				device.category = dto.category;
				return device as unknown as ShellyNgDeviceEntity;
			},
		);

		// channelsService mocks: pre-provision check (null → triggers createOrUpdate), then device info + switch
		(channelsService.findOneBy as jest.Mock)
			.mockImplementationOnce(async () => null)
			.mockImplementationOnce(async () => deviceInfoCh as unknown as ShellyNgChannelEntity)
			.mockImplementationOnce(async () => switchCh as unknown as ShellyNgChannelEntity);

		// propertiesService mocks (status, link_quality, switch output)
		(channelsPropertiesService.findOneBy as jest.Mock)
			.mockImplementationOnce(async () => statusProp as unknown as ShellyNgChannelPropertyEntity)
			.mockImplementationOnce(async () => linkQProp as unknown as ShellyNgChannelPropertyEntity)
			.mockImplementationOnce(async () => switchOn as unknown as ShellyNgChannelPropertyEntity);

		(channelsPropertiesService.update as jest.Mock).mockImplementation(
			async (_id: string, payload: unknown): Promise<unknown> => payload,
		);

		return { device, deviceInfoCh, statusProp, linkQProp, switchCh, switchOn };
	}

	test('insert() wires up initial values (wifi → link quality, switch output) and call setConnectionState', async () => {
		const { device, switchOn, linkQProp } = arrangeBaseEntities();

		const shelly: FakeDevice = {
			id: 'shelly123',
			modelName: 'Plus 1',
			system: { config: { device: { name: 'My Shelly', mac: 'AABBCCDDEEFF' } } },
			wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.10' },
			switch: { key: 'switch:0', output: false },
		};

		const delegate = (await svc.insert(shelly as unknown as Device)) as any;

		delegate.switches.set(0, {
			id: 0,
			key: 'switch:0',
			output: true,
			set: async (v: boolean) => ({ was_on: !v }),
		} as FakeSwitch);

		delegate.emitValue('switch:0', 'output', true);

		const updateCalls = (channelsPropertiesService.update as jest.Mock).mock.calls;
		const updates = updateCalls.map(([, payload]) => payload as ShellyNgChannelPropertyEntity);

		expect(
			updates.some(
				(p: any) =>
					p && p.identifier === linkQProp.identifier && typeof p.value === 'number' && p.value > 0 && p.value <= 100,
			),
		).toBe(true);

		expect(updates.some((p: any) => p && p.identifier === switchOn.identifier && p.value === true)).toBe(true);

		expect(updateCalls.map(([id]: [string]) => id)).toEqual(expect.arrayContaining([linkQProp.id, switchOn.id]));

		expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledTimes(1);
		expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith(device.id, {
			state: ConnectionState.CONNECTED,
		});
	});

	test('setPropertyValue() zavolá uložený property handler', async () => {
		arrangeBaseEntities();

		const shelly: FakeDevice = {
			id: 'shelly-set',
			modelName: 'Plus 1',
			system: { config: { device: { name: 'My Shelly', mac: 'AABBCCDDEEFF' } } },
			wifi: { key: 'wifi:0', rssi: -70, sta_ip: '192.168.1.22' },
		};

		const delegate = (await svc.insert(shelly as unknown as Device)) as any;

		const setSpy = jest.fn(async (v: boolean) => ({ was_on: !v }));
		delegate.switches.set(0, {
			id: 0,
			key: 'switch:0',
			output: false,
			set: setSpy,
		} as FakeSwitch);

		const somePropertyId = 'prop-output-1';

		svc['setPropertiesHandlers'].set(`${delegate.id}|${somePropertyId}`, async (v: unknown) => {
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

	test('setPropertyValue() return false, when handler is not defined', async () => {
		arrangeBaseEntities();

		const device = { id: 'dev-no-handler', identifier: 'dev-no-handler' } as unknown as ShellyNgDeviceEntity;
		const property = { id: 'prop-no-handler' } as unknown as ShellyNgChannelPropertyEntity;

		const ok = await svc.setPropertyValue(device, property, true);

		expect(ok).toBe(false);
	});

	test('setChannelValue() use batch handler and map results', async () => {
		const device = {
			id: 'dev-batch',
			identifier: 'dev-batch',
		} as unknown as ShellyNgDeviceEntity;

		const channel = {
			id: 'ch-batch',
		} as unknown as ShellyNgChannelEntity;

		const prop1 = { id: 'p1', identifier: 'output' } as unknown as ShellyNgChannelPropertyEntity;
		const prop2 = { id: 'p2', identifier: 'brightness' } as unknown as ShellyNgChannelPropertyEntity;

		const handlerSpy = jest.fn(async (updates: { property: ShellyNgChannelPropertyEntity; val: unknown }[]) => {
			expect(updates).toEqual([
				{ property: prop1, val: true },
				{ property: prop2, val: 50 },
			]);
			return true;
		});

		svc['identifierToDelegates'].set(device.identifier, new Set([device.identifier]));
		svc['setChannelsHandlers'].set(`${device.identifier}|${channel.id}`, handlerSpy);

		const result = await svc.setChannelValue(device, channel, [
			{ property: prop1, value: true },
			{ property: prop2, value: 50 },
		]);

		expect(result).toBe(true);
		expect(handlerSpy).toHaveBeenCalledTimes(1);
	});

	test('setChannelValue() throws DevicesShellyNgNotImplementedException when handler is not defined', async () => {
		const device = {
			id: 'dev-no-batch',
			identifier: 'dev-no-batch',
		} as unknown as ShellyNgDeviceEntity;

		const channel = {
			id: 'ch-no-batch',
		} as unknown as ShellyNgChannelEntity;

		await expect(svc.setChannelValue(device, channel, [])).rejects.toThrow(
			'Multiple property writes are not supported by the component.',
		);
	});

	test('remove() detaches device, call connection=null and clear statuses', async () => {
		const { device } = arrangeBaseEntities();

		const shelly: FakeDevice = {
			id: 'shelly-remove',
			modelName: 'Plus 1',
			system: { config: { device: { name: 'X', mac: 'AABBCCDDEEFF' } } },
			wifi: { key: 'wifi:0', rssi: -55, sta_ip: '192.168.1.30' },
		};

		const delegate = (await svc.insert(shelly as unknown as Device)) as any;

		// pendingWrites + propertiesMap
		svc['pendingWrites'].set(
			'p1',
			setTimeout(() => {}, 10),
		);
		svc['propertiesMap'].set(delegate.id, new Set(['p1']));

		// changeHandlers + setPropertiesHandlers
		svc['changeHandlers'].set(`${delegate.id}|switch:0|output`, () => {});
		svc['setPropertiesHandlers'].set(`${delegate.id}|prop-1`, async () => true);

		(deviceConnectivityService.setConnectionState as jest.Mock).mockClear();

		await svc.remove(delegate.id);

		expect(svc['changeHandlers'].size).toBe(0);
		expect(svc['setPropertiesHandlers'].size).toBe(0);
		expect(svc['propertiesMap'].has(delegate.id)).toBe(false);

		expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith(device.id, {
			state: ConnectionState.UNKNOWN,
		});

		delegate.emitValue('switch:0', 'output', false);
		delegate.emitConnected(false);
	});

	test('detach() clear all delegates and clear pending writes', async () => {
		arrangeBaseEntities();

		const shelly1: FakeDevice = {
			id: 'shelly-detach-1',
			modelName: 'Plus 1',
			system: { config: { device: { name: 'D1', mac: 'AABBCCDDEEFF' } } },
			wifi: { key: 'wifi:0', rssi: -50, sta_ip: '192.168.1.11' },
		};

		await svc.insert(shelly1 as unknown as Device);

		svc['pendingWrites'].set(
			'p-detach-1',
			setTimeout(() => {}, 10),
		);

		svc.detach();

		expect(svc['delegates'].size).toBe(0);
		expect(svc['changeHandlers'].size).toBe(0);
		expect(svc['setPropertiesHandlers'].size).toBe(0);
		expect(svc['propertiesMap'].size).toBe(0);
		expect(svc['pendingWrites'].size).toBe(0);
	});

	describe('Transformer Application', () => {
		test('setPropertyValue() applies transformer when property mapping exists', async () => {
			arrangeBaseEntities();

			const device = { id: 'dev-transformer', identifier: 'dev-transformer' } as unknown as ShellyNgDeviceEntity;
			const property = { id: 'prop-transformer' } as unknown as ShellyNgChannelPropertyEntity;

			// Mock transformer that doubles the value
			const mockTransformer = {
				write: jest.fn((value: unknown) => (typeof value === 'number' ? value * 2 : value)),
				canWrite: jest.fn(() => true),
				canRead: jest.fn(() => true),
			};

			// Mock property mapping storage
			(propertyMappingStorage.get as jest.Mock).mockReturnValueOnce({
				shellyProperty: 'output',
				direction: 'bidirectional',
				transformerName: 'test-transformer',
			});

			// Mock transformer registry
			(transformerRegistry.get as jest.Mock).mockReturnValueOnce(mockTransformer);

			const handlerSpy = jest.fn(async (v: unknown) => {
				expect(v).toBe(20); // 10 * 2
				return true;
			});

			svc['identifierToDelegates'].set(device.identifier, new Set([device.identifier]));
			svc['setPropertiesHandlers'].set(`${device.identifier}|${property.id}`, handlerSpy);

			const result = await svc.setPropertyValue(device, property, 10);

			expect(result).toBe(true);
			expect(mockTransformer.write).toHaveBeenCalledWith(10);
			expect(handlerSpy).toHaveBeenCalledWith(20);
		});

		test('setPropertyValue() skips transformer when no mapping exists', async () => {
			arrangeBaseEntities();

			const device = { id: 'dev-no-transformer', identifier: 'dev-no-transformer' } as unknown as ShellyNgDeviceEntity;
			const property = { id: 'prop-no-transformer' } as unknown as ShellyNgChannelPropertyEntity;

			// No mapping stored
			(propertyMappingStorage.get as jest.Mock).mockReturnValueOnce(undefined);

			const handlerSpy = jest.fn(async (v: unknown) => {
				expect(v).toBe(10); // Original value, no transformation
				return true;
			});

			svc['identifierToDelegates'].set(device.identifier, new Set([device.identifier]));
			svc['setPropertiesHandlers'].set(`${device.identifier}|${property.id}`, handlerSpy);

			const result = await svc.setPropertyValue(device, property, 10);

			expect(result).toBe(true);
			expect(transformerRegistry.get).not.toHaveBeenCalled();
			expect(handlerSpy).toHaveBeenCalledWith(10);
		});

		test('setChannelValue() applies transformers to all properties in batch', async () => {
			const device = {
				id: 'dev-batch-transformer',
				identifier: 'dev-batch-transformer',
			} as unknown as ShellyNgDeviceEntity;

			const channel = {
				id: 'ch-batch-transformer',
			} as unknown as ShellyNgChannelEntity;

			const prop1 = { id: 'p1' } as unknown as ShellyNgChannelPropertyEntity;
			const prop2 = { id: 'p2' } as unknown as ShellyNgChannelPropertyEntity;

			// Mock transformers
			const transformer1 = {
				write: jest.fn((v: unknown) => (typeof v === 'number' ? v * 2 : v)),
				canWrite: jest.fn(() => true),
				canRead: jest.fn(() => true),
			};

			const transformer2 = {
				write: jest.fn((v: unknown) => (typeof v === 'number' ? v + 10 : v)),
				canWrite: jest.fn(() => true),
				canRead: jest.fn(() => true),
			};

			// Mock property mappings
			(propertyMappingStorage.get as jest.Mock)
				.mockReturnValueOnce({
					shellyProperty: 'output',
					direction: 'bidirectional',
					transformerName: 'transformer1',
				})
				.mockReturnValueOnce({
					shellyProperty: 'brightness',
					direction: 'bidirectional',
					transformerName: 'transformer2',
				});

			(transformerRegistry.get as jest.Mock).mockReturnValueOnce(transformer1).mockReturnValueOnce(transformer2);

			const handlerSpy = jest.fn(async (updates: { property: ShellyNgChannelPropertyEntity; val: unknown }[]) => {
				expect(updates).toEqual([
					{ property: prop1, val: 20 }, // 10 * 2
					{ property: prop2, val: 25 }, // 15 + 10
				]);
				return true;
			});

			svc['identifierToDelegates'].set(device.identifier, new Set([device.identifier]));
			svc['setChannelsHandlers'].set(`${device.identifier}|${channel.id}`, handlerSpy);

			const result = await svc.setChannelValue(device, channel, [
				{ property: prop1, value: 10 },
				{ property: prop2, value: 15 },
			]);

			expect(result).toBe(true);
			expect(transformer1.write).toHaveBeenCalledWith(10);
			expect(transformer2.write).toHaveBeenCalledWith(15);
			expect(handlerSpy).toHaveBeenCalledTimes(1);
		});

		test('setPropertyValue() respects transformer direction (write_only)', async () => {
			arrangeBaseEntities();

			const device = { id: 'dev-write-only', identifier: 'dev-write-only' } as unknown as ShellyNgDeviceEntity;
			const property = { id: 'prop-write-only' } as unknown as ShellyNgChannelPropertyEntity;

			const mockTransformer = {
				write: jest.fn((value: unknown) => value),
				canWrite: jest.fn(() => true),
				canRead: jest.fn(() => false), // Read not supported
			};

			(propertyMappingStorage.get as jest.Mock).mockReturnValueOnce({
				shellyProperty: 'output',
				direction: 'write_only',
				transformerName: 'write-only-transformer',
			});

			(transformerRegistry.get as jest.Mock).mockReturnValueOnce(mockTransformer);

			const handlerSpy = jest.fn(async () => true);
			svc['identifierToDelegates'].set(device.identifier, new Set([device.identifier]));
			svc['setPropertiesHandlers'].set(`${device.identifier}|${property.id}`, handlerSpy);

			const result = await svc.setPropertyValue(device, property, true);

			expect(result).toBe(true);
			expect(mockTransformer.write).toHaveBeenCalled();
			expect(handlerSpy).toHaveBeenCalled();
		});

		test('setPropertyValue() skips transformer when it does not support write', async () => {
			arrangeBaseEntities();

			const device = { id: 'dev-read-only', identifier: 'dev-read-only' } as unknown as ShellyNgDeviceEntity;
			const property = { id: 'prop-read-only' } as unknown as ShellyNgChannelPropertyEntity;

			const mockTransformer = {
				write: jest.fn(),
				canWrite: jest.fn(() => false), // Write not supported
				canRead: jest.fn(() => true),
			};

			(propertyMappingStorage.get as jest.Mock).mockReturnValueOnce({
				shellyProperty: 'output',
				direction: 'read_only',
				transformerName: 'read-only-transformer',
			});

			(transformerRegistry.get as jest.Mock).mockReturnValueOnce(mockTransformer);

			const handlerSpy = jest.fn(async (v: unknown) => {
				expect(v).toBe(10); // Original value, transformer skipped
				return true;
			});

			svc['identifierToDelegates'].set(device.identifier, new Set([device.identifier]));
			svc['setPropertiesHandlers'].set(`${device.identifier}|${property.id}`, handlerSpy);

			const result = await svc.setPropertyValue(device, property, 10);

			expect(result).toBe(true);
			expect(mockTransformer.write).not.toHaveBeenCalled();
			expect(handlerSpy).toHaveBeenCalledWith(10);
		});

		test('setPropertyValue() uses inline transform when no transformer name', async () => {
			arrangeBaseEntities();

			const device = { id: 'dev-inline', identifier: 'dev-inline' } as unknown as ShellyNgDeviceEntity;
			const property = { id: 'prop-inline' } as unknown as ShellyNgChannelPropertyEntity;

			// Mock inline transform (scale transformer)
			// input_range is Shelly range, output_range is Panel range
			(propertyMappingStorage.get as jest.Mock).mockReturnValueOnce({
				shellyProperty: 'brightness',
				direction: 'bidirectional',
				inlineTransform: {
					type: 'scale',
					input_range: [0, 255], // Shelly range
					output_range: [0, 100], // Panel range
				},
			});

			const handlerSpy = jest.fn(async (v: unknown) => {
				// Panel value 50 should map to Shelly ~128 (50/100 * 255)
				expect(typeof v).toBe('number');
				expect(v).toBeGreaterThan(120);
				expect(v).toBeLessThan(135);
				return true;
			});

			svc['identifierToDelegates'].set(device.identifier, new Set([device.identifier]));
			svc['setPropertiesHandlers'].set(`${device.identifier}|${property.id}`, handlerSpy);

			const result = await svc.setPropertyValue(device, property, 50);

			expect(result).toBe(true);
			expect(handlerSpy).toHaveBeenCalled();
		});
	});

	describe('multi-interface merge path', () => {
		test('two delegates with same canonical MAC share a single device record', async () => {
			const device = {
				id: 'db-dev-multi',
				identifier: 'shellyproWifi',
			} as ShellyNgDeviceEntity;

			const deviceInfoCh = {
				device: device.id,
				category: ChannelCategory.DEVICE_INFORMATION,
				identifier: 'device-information',
				name: 'Device information',
			} as ShellyNgChannelEntity;

			const statusProp = {
				channel: deviceInfoCh.id,
				category: PropertyCategory.STATUS,
				identifier: 'status',
				value: new PropertyValueState(ConnectionState.UNKNOWN),
			} as ShellyNgChannelPropertyEntity;

			const linkQProp = {
				channel: deviceInfoCh.id,
				category: PropertyCategory.LINK_QUALITY,
				identifier: 'link_quality',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			const switchCh = {
				device: device.id,
				category: ChannelCategory.SWITCHER,
				identifier: 'switch:0',
				name: 'Switch 0',
			} as ShellyNgChannelEntity;

			const switchOn = {
				channel: switchCh.id,
				category: PropertyCategory.ON,
				identifier: 'output',
				value: new PropertyValueState(false),
			} as ShellyNgChannelPropertyEntity;

			const canonicalMac = 'A8032ABE5084';

			// First delegate (WiFi) — creates device
			(devicesService.findOneBy as jest.Mock).mockResolvedValueOnce(null); // not found by shelly.id
			(deviceAddressService.findDeviceByCanonicalMac as jest.Mock).mockResolvedValueOnce(null); // not found by MAC

			(devicesService.create as jest.Mock).mockImplementation(
				async (dto: CreateShellyNgDeviceDto): Promise<ShellyNgDeviceEntity> => {
					device.identifier = dto.identifier;
					device.name = dto.name;
					device.category = dto.category;
					return device as unknown as ShellyNgDeviceEntity;
				},
			);

			(devicesService.findOne as jest.Mock).mockResolvedValue(device as unknown as ShellyNgDeviceEntity);

			(channelsService.findOneBy as jest.Mock)
				.mockImplementation(async () => deviceInfoCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => null) // pre-provision check
				.mockImplementationOnce(async () => deviceInfoCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => switchCh as unknown as ShellyNgChannelEntity);

			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => statusProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => linkQProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => switchOn as unknown as ShellyNgChannelPropertyEntity);

			(channelsPropertiesService.update as jest.Mock).mockImplementation(
				async (_id: string, payload: unknown) => payload,
			);

			const shellyWifi: FakeDevice = {
				id: 'shellyproWifi',
				modelName: 'Pro 1',
				system: { config: { device: { name: 'Pro Device', mac: canonicalMac } } },
				wifi: { key: 'wifi:0', rssi: -50, sta_ip: '192.168.1.10' },
			};

			await svc.insert(shellyWifi as unknown as Device);

			expect(devicesService.create).toHaveBeenCalledTimes(1);
			expect(deviceAddressService.setCanonicalMac).toHaveBeenCalledWith(device.id, canonicalMac);
			expect(deviceAddressService.syncAddresses).toHaveBeenCalledWith(device.id, '192.168.1.10', null);

			// Second delegate (Ethernet) — should find existing device by canonical MAC, NOT create new
			jest.clearAllMocks();
			deviceConnectivityService.setConnectionState = jest.fn().mockResolvedValue(undefined);

			(devicesService.findOneBy as jest.Mock).mockResolvedValueOnce(null); // not found by shelly.id (different)
			(deviceAddressService.findDeviceByCanonicalMac as jest.Mock).mockResolvedValueOnce(
				device as unknown as ShellyNgDeviceEntity,
			); // found by MAC!

			(devicesService.findOne as jest.Mock).mockResolvedValue(device as unknown as ShellyNgDeviceEntity);

			(channelsService.findOneBy as jest.Mock)
				.mockImplementation(async () => deviceInfoCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => deviceInfoCh as unknown as ShellyNgChannelEntity) // pre-provision check (exists → skip)
				.mockImplementationOnce(async () => deviceInfoCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => switchCh as unknown as ShellyNgChannelEntity);

			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => statusProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => linkQProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => switchOn as unknown as ShellyNgChannelPropertyEntity);

			(channelsPropertiesService.update as jest.Mock).mockImplementation(
				async (_id: string, payload: unknown) => payload,
			);

			const shellyEth: FakeDevice = {
				id: 'shellyproEth',
				modelName: 'Pro 1',
				system: { config: { device: { name: 'Pro Device', mac: canonicalMac } } },
				ethernet: { key: 'eth:0', ip: '192.168.1.20' },
			};

			await svc.insert(shellyEth as unknown as Device);

			// Should NOT have created a new device — merged into existing
			expect(devicesService.create).not.toHaveBeenCalled();
			// Should have synced the ethernet address
			expect(deviceAddressService.syncAddresses).toHaveBeenCalledWith(device.id, null, '192.168.1.20');

			// Both delegates connected → counter should be 2
			expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith(device.id, {
				state: ConnectionState.CONNECTED,
			});
		});

		test('setPropertyValue resolves to connected delegate handler with two active delegates', async () => {
			const device = {
				id: 'db-dev-multi-write',
				identifier: 'shellyproWifi',
			} as ShellyNgDeviceEntity;

			const deviceInfoCh = {
				device: device.id,
				category: ChannelCategory.DEVICE_INFORMATION,
				identifier: 'device-information',
				name: 'Device information',
			} as ShellyNgChannelEntity;

			const statusProp = {
				channel: deviceInfoCh.id,
				category: PropertyCategory.STATUS,
				identifier: 'status',
				value: new PropertyValueState(ConnectionState.UNKNOWN),
			} as ShellyNgChannelPropertyEntity;

			const linkQProp = {
				channel: deviceInfoCh.id,
				category: PropertyCategory.LINK_QUALITY,
				identifier: 'link_quality',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			const switchCh = {
				device: device.id,
				category: ChannelCategory.SWITCHER,
				identifier: 'switch:0',
				name: 'Switch 0',
			} as ShellyNgChannelEntity;

			const switchOn = {
				channel: switchCh.id,
				category: PropertyCategory.ON,
				identifier: 'output',
				value: new PropertyValueState(false),
			} as ShellyNgChannelPropertyEntity;

			const canonicalMac = 'AABBCCDDEE00';

			// Insert WiFi delegate
			(devicesService.findOneBy as jest.Mock).mockResolvedValueOnce(null);
			(deviceAddressService.findDeviceByCanonicalMac as jest.Mock).mockResolvedValueOnce(null);
			(devicesService.create as jest.Mock).mockImplementation(async (dto: CreateShellyNgDeviceDto) => {
				device.identifier = dto.identifier;
				device.name = dto.name;
				device.category = dto.category;
				return device as unknown as ShellyNgDeviceEntity;
			});
			(devicesService.findOne as jest.Mock).mockResolvedValue(device as unknown as ShellyNgDeviceEntity);
			(channelsService.findOneBy as jest.Mock)
				.mockImplementation(async () => deviceInfoCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => null) // pre-provision check
				.mockImplementationOnce(async () => deviceInfoCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => switchCh as unknown as ShellyNgChannelEntity);
			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => statusProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => linkQProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => switchOn as unknown as ShellyNgChannelPropertyEntity);
			(channelsPropertiesService.update as jest.Mock).mockImplementation(
				async (_id: string, payload: unknown) => payload,
			);

			const wifiDelegate = (await svc.insert({
				id: 'shellyproWifiW',
				modelName: 'Pro 1',
				system: { config: { device: { name: 'Pro Write', mac: canonicalMac } } },
				wifi: { key: 'wifi:0', rssi: -50, sta_ip: '192.168.1.10' },
				switch: { key: 'switch:0', output: false },
			} as unknown as Device)) as any;

			// Insert Ethernet delegate (merges into same device)
			jest.clearAllMocks();
			deviceConnectivityService.setConnectionState = jest.fn().mockResolvedValue(undefined);
			(devicesService.findOneBy as jest.Mock).mockResolvedValueOnce(null);
			(deviceAddressService.findDeviceByCanonicalMac as jest.Mock).mockResolvedValueOnce(
				device as unknown as ShellyNgDeviceEntity,
			);
			(devicesService.findOne as jest.Mock).mockResolvedValue(device as unknown as ShellyNgDeviceEntity);
			(channelsService.findOneBy as jest.Mock)
				.mockImplementation(async () => deviceInfoCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => deviceInfoCh as unknown as ShellyNgChannelEntity) // pre-provision check (exists → skip)
				.mockImplementationOnce(async () => deviceInfoCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => switchCh as unknown as ShellyNgChannelEntity);
			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => statusProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => linkQProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => switchOn as unknown as ShellyNgChannelPropertyEntity);
			(channelsPropertiesService.update as jest.Mock).mockImplementation(
				async (_id: string, payload: unknown) => payload,
			);

			const ethDelegate = (await svc.insert({
				id: 'shellyproEthW',
				modelName: 'Pro 1',
				system: { config: { device: { name: 'Pro Write', mac: canonicalMac } } },
				ethernet: { key: 'eth:0', ip: '192.168.1.20' },
				switch: { key: 'switch:0', output: false },
			} as unknown as Device)) as any;

			// Both delegates should share the same device identifier
			const identifierDelegates = svc['identifierToDelegates'].get(device.identifier);
			expect(identifierDelegates).toBeDefined();
			expect(identifierDelegates!.size).toBe(2);

			// Wire switch handlers on both delegates
			const wifiSpy = jest.fn(async (_v?: unknown) => ({ was_on: false }));
			const ethSpy = jest.fn(async (_v?: unknown) => ({ was_on: false }));

			wifiDelegate.switches.set(0, { id: 0, key: 'switch:0', output: false, set: wifiSpy } as FakeSwitch);
			ethDelegate.switches.set(0, { id: 0, key: 'switch:0', output: false, set: ethSpy } as FakeSwitch);

			// Register handlers for both delegates using the real key scheme
			svc['setPropertiesHandlers'].set(`${wifiDelegate.id}|${switchOn.id}`, async (v: unknown) => {
				if (typeof v !== 'boolean') return false;
				await wifiSpy(v);
				return true;
			});
			svc['setPropertiesHandlers'].set(`${ethDelegate.id}|${switchOn.id}`, async (v: unknown) => {
				if (typeof v !== 'boolean') return false;
				await ethSpy(v);
				return true;
			});

			// Both are connected — setPropertyValue should prefer one of them (both valid)
			const ok = await svc.setPropertyValue(device, switchOn, true);
			expect(ok).toBe(true);
			expect(wifiSpy.mock.calls.length + ethSpy.mock.calls.length).toBe(1);

			// Disconnect WiFi delegate — setPropertyValue should route to Ethernet
			wifiSpy.mockClear();
			ethSpy.mockClear();
			wifiDelegate.emitConnected(false);

			const ok2 = await svc.setPropertyValue(device, switchOn, false);
			expect(ok2).toBe(true);
			expect(ethSpy).toHaveBeenCalledWith(false);
			expect(wifiSpy).not.toHaveBeenCalled();
		});
	});

	// RC1/RC5 regression guards (PR1): `aenergy` and `battery` are object characteristics
	// ({ total, ... } / { percent, ... }). Before this fix, coerceNumberSafe coerced the whole
	// object to 0, so every tick silently overwrote a correct consumption/battery reading.
	describe('aenergy and battery track the device on both transports (PR1)', () => {
		function arrangeDeviceInfoMocks() {
			const device = { id: uuid().toString() } as ShellyNgDeviceEntity;

			const deviceInfoCh = {
				device: device.id,
				category: ChannelCategory.DEVICE_INFORMATION,
				identifier: 'device-information',
				name: 'Device information',
			} as ShellyNgChannelEntity;

			const statusProp = {
				channel: deviceInfoCh.id,
				category: PropertyCategory.STATUS,
				identifier: 'status',
				value: new PropertyValueState(ConnectionState.UNKNOWN),
			} as ShellyNgChannelPropertyEntity;

			const linkQProp = {
				channel: deviceInfoCh.id,
				category: PropertyCategory.LINK_QUALITY,
				identifier: 'link_quality',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			(devicesService.findOneBy as jest.Mock).mockResolvedValueOnce(null);
			(devicesService.findOne as jest.Mock).mockResolvedValueOnce(device);
			(devicesService.create as jest.Mock).mockImplementation(
				async (dto: CreateShellyNgDeviceDto): Promise<ShellyNgDeviceEntity> => {
					device.identifier = dto.identifier;
					device.name = dto.name;
					device.category = dto.category;
					return device as unknown as ShellyNgDeviceEntity;
				},
			);

			(channelsService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => null)
				.mockImplementationOnce(async () => deviceInfoCh as unknown as ShellyNgChannelEntity);

			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => statusProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => linkQProp as unknown as ShellyNgChannelPropertyEntity);

			(channelsPropertiesService.update as jest.Mock).mockImplementation(
				async (_id: string, payload: unknown): Promise<unknown> => payload,
			);

			return { device };
		}

		function arrangeSwitchWithEnergyEntities() {
			const { device } = arrangeDeviceInfoMocks();

			const switchCh = {
				device: device.id,
				category: ChannelCategory.SWITCHER,
				identifier: 'switch:0',
				name: 'Switch 0',
			} as ShellyNgChannelEntity;

			const switchOn = {
				channel: switchCh.id,
				category: PropertyCategory.ON,
				identifier: 'output',
				value: new PropertyValueState(false),
			} as ShellyNgChannelPropertyEntity;

			const energyCh = {
				device: device.id,
				category: ChannelCategory.ELECTRICAL_ENERGY,
				identifier: 'energy:0',
				name: 'Energy 0',
			} as ShellyNgChannelEntity;

			const consumptionProp = {
				channel: energyCh.id,
				category: PropertyCategory.CONSUMPTION,
				identifier: 'aenergy',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			(channelsService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => switchCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => energyCh as unknown as ShellyNgChannelEntity);

			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => switchOn as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => consumptionProp as unknown as ShellyNgChannelPropertyEntity);

			return { device, consumptionProp };
		}

		function arrangePm1WithEnergyEntities() {
			const { device } = arrangeDeviceInfoMocks();

			const electricalPowerCh = {
				device: device.id,
				category: ChannelCategory.ELECTRICAL_POWER,
				identifier: 'power:0',
				name: 'Power 0',
			} as ShellyNgChannelEntity;

			const apowerProp = {
				channel: electricalPowerCh.id,
				category: PropertyCategory.POWER,
				identifier: 'apower',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			const energyCh = {
				device: device.id,
				category: ChannelCategory.ELECTRICAL_ENERGY,
				identifier: 'energy:0',
				name: 'Energy 0',
			} as ShellyNgChannelEntity;

			const consumptionProp = {
				channel: energyCh.id,
				category: PropertyCategory.CONSUMPTION,
				identifier: 'aenergy',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			// PR3 normalises PM1 onto the shared `wireElectricalChannels` helper, which checks
			// `aenergy` before `apower` (matching what the switch block has always done) — so
			// the energy channel/property are resolved first here too.
			(channelsService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => energyCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => electricalPowerCh as unknown as ShellyNgChannelEntity);

			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => consumptionProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => apowerProp as unknown as ShellyNgChannelPropertyEntity);

			return { device, consumptionProp };
		}

		function arrangeDevicePowerEntities() {
			const { device } = arrangeDeviceInfoMocks();

			const devicePowerCh = {
				device: device.id,
				category: ChannelCategory.BATTERY,
				identifier: 'devicePower:0',
				name: 'Device power 0',
			} as ShellyNgChannelEntity;

			const batteryProp = {
				channel: devicePowerCh.id,
				category: PropertyCategory.PERCENTAGE,
				identifier: 'battery',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			(channelsService.findOneBy as jest.Mock).mockImplementationOnce(
				async () => devicePowerCh as unknown as ShellyNgChannelEntity,
			);

			(channelsPropertiesService.findOneBy as jest.Mock).mockImplementationOnce(
				async () => batteryProp as unknown as ShellyNgChannelPropertyEntity,
			);

			return { device, batteryProp };
		}

		function updatesFor(identifier: string): unknown[] {
			return (channelsPropertiesService.update as jest.Mock).mock.calls
				.map(([, payload]: [string, { identifier?: string; value?: unknown }]) => payload)
				.filter((payload) => payload?.identifier === identifier);
		}

		test('switch: aenergy.total leaf writes consumption; the bare aenergy object does not', async () => {
			jest.useFakeTimers();

			try {
				const { consumptionProp } = arrangeSwitchWithEnergyEntities();

				const shelly: FakeDevice = {
					id: 'shelly-energy-switch',
					modelName: 'Plus 1PM',
					system: { config: { device: { name: 'PM Switch', mac: 'AABBCCDDEE01' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.41' },
					switch: { key: 'switch:0', output: true, aenergy: { total: 1.0 } },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				// Regression guard: a bare `aenergy` object must never be coerced to 0 and written.
				delegate.emitValue('switch:0', 'aenergy', { total: 12.345 });
				jest.advanceTimersByTime(300);

				expect(updatesFor(consumptionProp.identifier)).toHaveLength(0);

				// The flattened leaf carries the real scalar and is the only thing that writes.
				delegate.emitValue('switch:0', 'aenergy.total', 12.345);
				jest.advanceTimersByTime(300);

				const writes = updatesFor(consumptionProp.identifier) as { value: unknown }[];
				expect(writes).toHaveLength(1);
				expect(writes[0].value).toBe(12.345);
			} finally {
				jest.useRealTimers();
			}
		});

		test('pm1: aenergy.total leaf writes consumption; the bare aenergy object does not', async () => {
			jest.useFakeTimers();

			try {
				const { consumptionProp } = arrangePm1WithEnergyEntities();

				const shelly: FakeDevice = {
					id: 'shelly-energy-pm1',
					modelName: 'Plus PM Mini',
					system: { config: { device: { name: 'PM Mini', mac: 'AABBCCDDEE02' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.42' },
					pm1: { id: 0, key: 'pm1:0', apower: 0, aenergy: { total: 1.0 } },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				delegate.emitValue('pm1:0', 'aenergy', { total: 45.6 });
				jest.advanceTimersByTime(300);

				expect(updatesFor(consumptionProp.identifier)).toHaveLength(0);

				delegate.emitValue('pm1:0', 'aenergy.total', 45.6);
				jest.advanceTimersByTime(300);

				const writes = updatesFor(consumptionProp.identifier) as { value: unknown }[];
				expect(writes).toHaveLength(1);
				expect(writes[0].value).toBe(45.6);
			} finally {
				jest.useRealTimers();
			}
		});

		test('device power: battery.percent reaches the property write via the library path', async () => {
			jest.useFakeTimers();

			try {
				const { batteryProp } = arrangeDevicePowerEntities();

				const shelly: FakeDevice = {
					id: 'shelly-battery-1',
					modelName: 'Plus H&T',
					system: { config: { device: { name: 'H&T', mac: 'AABBCCDDEE03' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.43' },
					devicePower: { id: 0, key: 'devicepower:0', battery: { percent: 90 } },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				// Previously only reachable through ShellyWsServerService (sleeping-device path).
				// The shared flatten helper in ShellyDeviceDelegate.handleChange now emits this key
				// on the library WebSocket path too.
				delegate.emitValue('devicepower:0', 'battery.percent', 87);
				jest.advanceTimersByTime(300);

				const writes = updatesFor(batteryProp.identifier) as { value: unknown }[];
				expect(writes).toHaveLength(1);
				expect(writes[0].value).toBe(87);
			} finally {
				jest.useRealTimers();
			}
		});
	});

	// RC3 regression guards (PR3): cover, light, RGB, RGBW and CCT get `power:{id}` /
	// `energy:{id}` channels at adoption (DeviceManagerService.ensureElectricalPower /
	// ensureElectricalEnergy), but before this fix only switch and PM1 had live handlers
	// wired for them — the other five component types were frozen at their adoption-time
	// values forever. `wireElectricalChannels` (extracted from the switch block) is now
	// called from all seven component loops.
	describe('cover, light, RGB, RGBW and CCT electrical channels track the device (PR3)', () => {
		function arrangeDeviceInfoMocks() {
			const device = { id: uuid().toString() } as ShellyNgDeviceEntity;

			const deviceInfoCh = {
				device: device.id,
				category: ChannelCategory.DEVICE_INFORMATION,
				identifier: 'device-information',
				name: 'Device information',
			} as ShellyNgChannelEntity;

			const statusProp = {
				channel: deviceInfoCh.id,
				category: PropertyCategory.STATUS,
				identifier: 'status',
				value: new PropertyValueState(ConnectionState.UNKNOWN),
			} as ShellyNgChannelPropertyEntity;

			const linkQProp = {
				channel: deviceInfoCh.id,
				category: PropertyCategory.LINK_QUALITY,
				identifier: 'link_quality',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			(devicesService.findOneBy as jest.Mock).mockResolvedValueOnce(null);
			(devicesService.findOne as jest.Mock).mockResolvedValueOnce(device);
			(devicesService.create as jest.Mock).mockImplementation(
				async (dto: CreateShellyNgDeviceDto): Promise<ShellyNgDeviceEntity> => {
					device.identifier = dto.identifier;
					device.name = dto.name;
					device.category = dto.category;
					return device as unknown as ShellyNgDeviceEntity;
				},
			);

			(channelsService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => null)
				.mockImplementationOnce(async () => deviceInfoCh as unknown as ShellyNgChannelEntity);

			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => statusProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => linkQProp as unknown as ShellyNgChannelPropertyEntity);

			(channelsPropertiesService.update as jest.Mock).mockImplementation(
				async (_id: string, payload: unknown): Promise<unknown> => payload,
			);

			return { device };
		}

		function arrangeElectricalChannelEntities(deviceId: string) {
			const electricalPowerCh = {
				device: deviceId,
				category: ChannelCategory.ELECTRICAL_POWER,
				identifier: 'power:0',
				name: 'Power 0',
			} as ShellyNgChannelEntity;

			const apowerProp = {
				id: uuid(),
				channel: electricalPowerCh.id,
				category: PropertyCategory.POWER,
				identifier: 'apower',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			const energyCh = {
				device: deviceId,
				category: ChannelCategory.ELECTRICAL_ENERGY,
				identifier: 'energy:0',
				name: 'Energy 0',
			} as ShellyNgChannelEntity;

			const consumptionProp = {
				id: uuid(),
				channel: energyCh.id,
				category: PropertyCategory.CONSUMPTION,
				identifier: 'aenergy',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			return { electricalPowerCh, apowerProp, energyCh, consumptionProp };
		}

		function updatesFor(identifier: string): unknown[] {
			return (channelsPropertiesService.update as jest.Mock).mock.calls
				.map(([, payload]: [string, { identifier?: string; value?: unknown }]) => payload)
				.filter((payload) => payload?.identifier === identifier);
		}

		function arrangeCoverWithElectricalEntities() {
			const { device } = arrangeDeviceInfoMocks();

			const coverCh = {
				device: device.id,
				category: ChannelCategory.WINDOW_COVERING,
				identifier: 'cover:0',
				name: 'Cover 0',
			} as ShellyNgChannelEntity;

			const coverState = {
				channel: coverCh.id,
				identifier: 'state',
				value: new PropertyValueState('closed'),
			} as ShellyNgChannelPropertyEntity;

			const coverPosition = {
				channel: coverCh.id,
				identifier: 'current_pos',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			const coverCommand = {
				channel: coverCh.id,
				category: PropertyCategory.COMMAND,
				identifier: 'command',
				value: new PropertyValueState('stop'),
			} as ShellyNgChannelPropertyEntity;

			const { electricalPowerCh, apowerProp, energyCh, consumptionProp } = arrangeElectricalChannelEntities(device.id);

			(channelsService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => coverCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => energyCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => electricalPowerCh as unknown as ShellyNgChannelEntity);

			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => coverState as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => coverPosition as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => coverCommand as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => consumptionProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => apowerProp as unknown as ShellyNgChannelPropertyEntity);

			return { device, apowerProp, consumptionProp };
		}

		function arrangeOutputComponentWithElectricalEntities(channelIdentifier: string, channelCategory: ChannelCategory) {
			const { device } = arrangeDeviceInfoMocks();

			const componentCh = {
				device: device.id,
				category: channelCategory,
				identifier: channelIdentifier,
				name: channelIdentifier,
			} as ShellyNgChannelEntity;

			const componentOn = {
				channel: componentCh.id,
				category: PropertyCategory.ON,
				identifier: 'output',
				value: new PropertyValueState(false),
			} as ShellyNgChannelPropertyEntity;

			const { electricalPowerCh, apowerProp, energyCh, consumptionProp } = arrangeElectricalChannelEntities(device.id);

			(channelsService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => componentCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => energyCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => electricalPowerCh as unknown as ShellyNgChannelEntity);

			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => componentOn as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => consumptionProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => apowerProp as unknown as ShellyNgChannelPropertyEntity);

			return { device, apowerProp, consumptionProp };
		}

		function arrangeCctWithElectricalEntities() {
			const { device } = arrangeDeviceInfoMocks();

			const cctCh = {
				device: device.id,
				category: ChannelCategory.LIGHT,
				identifier: 'cct:0',
				name: 'cct:0',
			} as ShellyNgChannelEntity;

			const cctOn = {
				channel: cctCh.id,
				category: PropertyCategory.ON,
				identifier: 'output',
				value: new PropertyValueState(false),
			} as ShellyNgChannelPropertyEntity;

			const electricalPowerCh = {
				device: device.id,
				category: ChannelCategory.ELECTRICAL_POWER,
				identifier: 'power:0',
				name: 'Power 0',
			} as ShellyNgChannelEntity;

			const apowerProp = {
				channel: electricalPowerCh.id,
				category: PropertyCategory.POWER,
				identifier: 'apower',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			// CCT never reports `aenergy` — no energy channel lookup happens for it, so no
			// energy fixture is queued here (asserted implicitly: the mock queue would
			// desync and fail the test if the production code tried to read one).
			(channelsService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => cctCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => electricalPowerCh as unknown as ShellyNgChannelEntity);

			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => cctOn as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => apowerProp as unknown as ShellyNgChannelPropertyEntity);

			return { device, apowerProp };
		}

		test('cover: apower and aenergy.total reach the power:0 / energy:0 properties', async () => {
			jest.useFakeTimers();

			try {
				const { apowerProp, consumptionProp } = arrangeCoverWithElectricalEntities();

				const shelly: FakeDevice = {
					id: 'shelly-cover-electrical',
					modelName: 'Pro Dual Cover PM',
					system: { config: { device: { name: 'Cover PM', mac: 'AABBCCDDEE10' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.50' },
					cover: { id: 0, key: 'cover:0', state: 'closed', current_pos: 0, apower: 0, aenergy: { total: 1.0 } },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				delegate.emitValue('cover:0', 'apower', 42.5);
				delegate.emitValue('cover:0', 'aenergy.total', 3.21);
				jest.advanceTimersByTime(300);

				const powerWrites = updatesFor(apowerProp.identifier) as { value: unknown }[];
				expect(powerWrites).toHaveLength(1);
				expect(powerWrites[0].value).toBe(42.5);

				const energyWrites = updatesFor(consumptionProp.identifier) as { value: unknown }[];
				expect(energyWrites).toHaveLength(1);
				expect(energyWrites[0].value).toBe(3.21);
			} finally {
				jest.useRealTimers();
			}
		});

		test('light: apower and aenergy.total reach the power:0 / energy:0 properties', async () => {
			jest.useFakeTimers();

			try {
				const { apowerProp, consumptionProp } = arrangeOutputComponentWithElectricalEntities(
					'light:0',
					ChannelCategory.LIGHT,
				);

				const shelly: FakeDevice = {
					id: 'shelly-light-electrical',
					modelName: 'Pro Dimmer 2PM',
					system: { config: { device: { name: 'Dimmer PM', mac: 'AABBCCDDEE11' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.51' },
					light: { id: 0, key: 'light:0', output: true, apower: 0, aenergy: { total: 1.0 } },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				delegate.emitValue('light:0', 'apower', 12.3);
				delegate.emitValue('light:0', 'aenergy.total', 4.56);
				jest.advanceTimersByTime(300);

				expect((updatesFor(apowerProp.identifier) as { value: unknown }[])[0].value).toBe(12.3);
				expect((updatesFor(consumptionProp.identifier) as { value: unknown }[])[0].value).toBe(4.56);
			} finally {
				jest.useRealTimers();
			}
		});

		test('rgb: apower and aenergy.total reach the power:0 / energy:0 properties', async () => {
			jest.useFakeTimers();

			try {
				const { apowerProp, consumptionProp } = arrangeOutputComponentWithElectricalEntities(
					'rgb:0',
					ChannelCategory.LIGHT,
				);

				const shelly: FakeDevice = {
					id: 'shelly-rgb-electrical',
					modelName: 'Plus RGBW PM (RGB profile)',
					system: { config: { device: { name: 'RGB PM', mac: 'AABBCCDDEE12' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.52' },
					rgb: { id: 0, key: 'rgb:0', output: true, apower: 0, aenergy: { total: 1.0 } },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				delegate.emitValue('rgb:0', 'apower', 8.1);
				delegate.emitValue('rgb:0', 'aenergy.total', 2.34);
				jest.advanceTimersByTime(300);

				expect((updatesFor(apowerProp.identifier) as { value: unknown }[])[0].value).toBe(8.1);
				expect((updatesFor(consumptionProp.identifier) as { value: unknown }[])[0].value).toBe(2.34);
			} finally {
				jest.useRealTimers();
			}
		});

		test('rgbw: apower and aenergy.total reach the power:0 / energy:0 properties', async () => {
			jest.useFakeTimers();

			try {
				const { apowerProp, consumptionProp } = arrangeOutputComponentWithElectricalEntities(
					'rgbw:0',
					ChannelCategory.LIGHT,
				);

				const shelly: FakeDevice = {
					id: 'shelly-rgbw-electrical',
					modelName: 'Pro RGBW PM',
					system: { config: { device: { name: 'RGBW PM', mac: 'AABBCCDDEE13' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.53' },
					rgbw: { id: 0, key: 'rgbw:0', output: true, apower: 0, aenergy: { total: 1.0 } },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				delegate.emitValue('rgbw:0', 'apower', 15.7);
				delegate.emitValue('rgbw:0', 'aenergy.total', 6.78);
				jest.advanceTimersByTime(300);

				expect((updatesFor(apowerProp.identifier) as { value: unknown }[])[0].value).toBe(15.7);
				expect((updatesFor(consumptionProp.identifier) as { value: unknown }[])[0].value).toBe(6.78);
			} finally {
				jest.useRealTimers();
			}
		});

		test('cct: apower reaches the power:0 property; CCT has no energy channel to wire', async () => {
			jest.useFakeTimers();

			try {
				const { apowerProp } = arrangeCctWithElectricalEntities();

				const shelly: FakeDevice = {
					id: 'shelly-cct-electrical',
					modelName: 'Pro RGBW PM (CCT profile)',
					system: { config: { device: { name: 'CCT PM', mac: 'AABBCCDDEE14' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.54' },
					cct: { id: 0, key: 'cct:0', output: true, apower: 0 },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				delegate.emitValue('cct:0', 'apower', 9.9);
				jest.advanceTimersByTime(300);

				expect((updatesFor(apowerProp.identifier) as { value: unknown }[])[0].value).toBe(9.9);
			} finally {
				jest.useRealTimers();
			}
		});

		test('pm1: a missing apower property is skipped, not thrown (provisioning race)', async () => {
			const { device } = arrangeDeviceInfoMocks();

			const energyCh = {
				device: device.id,
				category: ChannelCategory.ELECTRICAL_ENERGY,
				identifier: 'energy:0',
				name: 'Energy 0',
			} as ShellyNgChannelEntity;

			const consumptionProp = {
				channel: energyCh.id,
				category: PropertyCategory.CONSUMPTION,
				identifier: 'aenergy',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			const electricalPowerCh = {
				device: device.id,
				category: ChannelCategory.ELECTRICAL_POWER,
				identifier: 'power:0',
				name: 'Power 0',
			} as ShellyNgChannelEntity;

			(channelsService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => energyCh as unknown as ShellyNgChannelEntity)
				.mockImplementationOnce(async () => electricalPowerCh as unknown as ShellyNgChannelEntity);

			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => consumptionProp as unknown as ShellyNgChannelPropertyEntity)
				// `apower` property not created yet — before PR3 this threw
				// DevicesShellyNgNotFoundException and aborted the whole insert().
				.mockImplementationOnce(async () => null);

			const shelly: FakeDevice = {
				id: 'shelly-pm1-missing-apower',
				modelName: 'Plus PM Mini',
				system: { config: { device: { name: 'PM Mini', mac: 'AABBCCDDEE15' } } },
				wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.55' },
				pm1: { id: 0, key: 'pm1:0', apower: 0, aenergy: { total: 2.0 } },
			};

			await expect(svc.insert(shelly as unknown as Device)).resolves.toBeDefined();

			const powerWrites = (channelsPropertiesService.update as jest.Mock).mock.calls
				.map(([, payload]: [string, { identifier?: string }]) => payload)
				.filter((payload) => payload?.identifier === 'apower');

			expect(powerWrites).toHaveLength(0);
		});

		test('light: voltage reaches power:0 even when apower is absent (voltage/current wire independently)', async () => {
			jest.useFakeTimers();

			try {
				const { device } = arrangeDeviceInfoMocks();

				const lightCh = {
					device: device.id,
					category: ChannelCategory.LIGHT,
					identifier: 'light:0',
					name: 'light:0',
				} as ShellyNgChannelEntity;

				const lightOn = {
					channel: lightCh.id,
					category: PropertyCategory.ON,
					identifier: 'output',
					value: new PropertyValueState(false),
				} as ShellyNgChannelPropertyEntity;

				const electricalPowerCh = {
					device: device.id,
					category: ChannelCategory.ELECTRICAL_POWER,
					identifier: 'power:0',
					name: 'Power 0',
				} as ShellyNgChannelEntity;

				const voltageProp = {
					id: uuid(),
					channel: electricalPowerCh.id,
					category: PropertyCategory.VOLTAGE,
					identifier: 'voltage',
					value: new PropertyValueState(0),
				} as ShellyNgChannelPropertyEntity;

				// No `aenergy` and no `apower` on this component — only `voltage` is reported.
				// Before the CodeRabbit fix, resolving `power:0` and registering the voltage
				// handler were both gated on `apower` being present, so this case never wired.
				(channelsService.findOneBy as jest.Mock)
					.mockImplementationOnce(async () => lightCh as unknown as ShellyNgChannelEntity)
					.mockImplementationOnce(async () => electricalPowerCh as unknown as ShellyNgChannelEntity);

				(channelsPropertiesService.findOneBy as jest.Mock)
					.mockImplementationOnce(async () => lightOn as unknown as ShellyNgChannelPropertyEntity)
					.mockImplementationOnce(async () => voltageProp as unknown as ShellyNgChannelPropertyEntity);

				const shelly: FakeDevice = {
					id: 'shelly-light-voltage-only',
					modelName: 'Pro Dimmer 2PM',
					system: { config: { device: { name: 'Dimmer PM', mac: 'AABBCCDDEE16' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.56' },
					light: { id: 0, key: 'light:0', output: true, voltage: 230 },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				delegate.emitValue('light:0', 'voltage', 231.4);
				jest.advanceTimersByTime(300);

				const writes = (channelsPropertiesService.update as jest.Mock).mock.calls
					.map(([, payload]: [string, { identifier?: string; value?: unknown }]) => payload)
					.filter((payload) => payload?.identifier === 'voltage');

				expect(writes).toHaveLength(1);
				expect(writes[0].value).toBe(231.4);
			} finally {
				jest.useRealTimers();
			}
		});
	});

	describe('EM/EM1/EMData/EM1Data energy meter channels track the device (PR4/RC4)', () => {
		function arrangeDeviceInfoMocks() {
			const device = { id: uuid().toString() } as ShellyNgDeviceEntity;

			const deviceInfoCh = {
				device: device.id,
				category: ChannelCategory.DEVICE_INFORMATION,
				identifier: 'device-information',
				name: 'Device information',
			} as ShellyNgChannelEntity;

			const statusProp = {
				channel: deviceInfoCh.id,
				category: PropertyCategory.STATUS,
				identifier: 'status',
				value: new PropertyValueState(ConnectionState.UNKNOWN),
			} as ShellyNgChannelPropertyEntity;

			const linkQProp = {
				channel: deviceInfoCh.id,
				category: PropertyCategory.LINK_QUALITY,
				identifier: 'link_quality',
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			(devicesService.findOneBy as jest.Mock).mockResolvedValueOnce(null);
			(devicesService.findOne as jest.Mock).mockResolvedValueOnce(device);
			(devicesService.create as jest.Mock).mockImplementation(
				async (dto: CreateShellyNgDeviceDto): Promise<ShellyNgDeviceEntity> => {
					device.identifier = dto.identifier;
					device.name = dto.name;
					device.category = dto.category;
					return device as unknown as ShellyNgDeviceEntity;
				},
			);

			(channelsService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => null)
				.mockImplementationOnce(async () => deviceInfoCh as unknown as ShellyNgChannelEntity);

			(channelsPropertiesService.findOneBy as jest.Mock)
				.mockImplementationOnce(async () => statusProp as unknown as ShellyNgChannelPropertyEntity)
				.mockImplementationOnce(async () => linkQProp as unknown as ShellyNgChannelPropertyEntity);

			(channelsPropertiesService.update as jest.Mock).mockImplementation(
				async (_id: string, payload: unknown): Promise<unknown> => payload,
			);

			return { device };
		}

		function meterChannelAndProperty(
			deviceId: string,
			category: ChannelCategory.ELECTRICAL_POWER | ChannelCategory.ELECTRICAL_ENERGY,
			channelIdentifier: string,
			propertyCategory: PropertyCategory,
			propertyIdentifier: string,
		) {
			const channel = {
				device: deviceId,
				category,
				identifier: channelIdentifier,
				name: channelIdentifier,
			} as ShellyNgChannelEntity;

			const property = {
				channel: channel.id,
				category: propertyCategory,
				identifier: propertyIdentifier,
				value: new PropertyValueState(0),
			} as ShellyNgChannelPropertyEntity;

			return { channel, property };
		}

		function updatesFor(identifier: string): { value: unknown }[] {
			return (channelsPropertiesService.update as jest.Mock).mock.calls
				.map(([, payload]: [string, { identifier?: string; value?: unknown }]) => payload)
				.filter((payload) => payload?.identifier === identifier) as { value: unknown }[];
		}

		test('em: a_act_power reaches power:0:a / a_act_power; a null phase reading (b_act_power) writes nothing', async () => {
			jest.useFakeTimers();

			try {
				const { device } = arrangeDeviceInfoMocks();

				const { channel: channelA, property: propA } = meterChannelAndProperty(
					device.id,
					ChannelCategory.ELECTRICAL_POWER,
					'power:0:a',
					PropertyCategory.POWER,
					'a_act_power',
				);
				const { channel: channelB, property: propB } = meterChannelAndProperty(
					device.id,
					ChannelCategory.ELECTRICAL_POWER,
					'power:0:b',
					PropertyCategory.POWER,
					'b_act_power',
				);

				// Only `a_act_power` and `b_act_power` are set on the fixture - every other
				// reading on `em:0` stays `undefined` and is skipped with no lookup at all,
				// keeping this queue in lockstep with the a → b → c → total loop order.
				(channelsService.findOneBy as jest.Mock)
					.mockImplementationOnce(async () => channelA as unknown as ShellyNgChannelEntity)
					.mockImplementationOnce(async () => channelB as unknown as ShellyNgChannelEntity);

				(channelsPropertiesService.findOneBy as jest.Mock)
					.mockImplementationOnce(async () => propA as unknown as ShellyNgChannelPropertyEntity)
					.mockImplementationOnce(async () => propB as unknown as ShellyNgChannelPropertyEntity);

				const shelly: FakeDevice = {
					id: 'shelly-em-meter',
					modelName: 'Pro 3EM',
					system: { config: { device: { name: '3EM', mac: 'AABBCCDDEE20' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.60' },
					// b_act_power: null simulates a disconnected CT clamp on phase B.
					em: { id: 0, key: 'em:0', a_act_power: 100.0, b_act_power: null },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				delegate.emitValue('em:0', 'a_act_power', 130.2);
				delegate.emitValue('em:0', 'b_act_power', null);
				jest.advanceTimersByTime(300);

				expect(updatesFor('a_act_power')).toHaveLength(1);
				expect(updatesFor('a_act_power')[0].value).toBe(130.2);

				// The allowNull path: a null phase reading must not be written at all.
				expect(updatesFor('b_act_power')).toHaveLength(0);
			} finally {
				jest.useRealTimers();
			}
		});

		test('emdata: a_total_act_energy reaches energy:0:a / a_total_act_energy', async () => {
			jest.useFakeTimers();

			try {
				const { device } = arrangeDeviceInfoMocks();

				const { channel, property } = meterChannelAndProperty(
					device.id,
					ChannelCategory.ELECTRICAL_ENERGY,
					'energy:0:a',
					PropertyCategory.CONSUMPTION,
					'a_total_act_energy',
				);

				(channelsService.findOneBy as jest.Mock).mockImplementationOnce(
					async () => channel as unknown as ShellyNgChannelEntity,
				);

				(channelsPropertiesService.findOneBy as jest.Mock).mockImplementationOnce(
					async () => property as unknown as ShellyNgChannelPropertyEntity,
				);

				const shelly: FakeDevice = {
					id: 'shelly-emdata-meter',
					modelName: 'Pro 3EM',
					system: { config: { device: { name: '3EM', mac: 'AABBCCDDEE21' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.61' },
					emData: { id: 0, key: 'emdata:0', a_total_act_energy: 111.1 },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				delegate.emitValue('emdata:0', 'a_total_act_energy', 222.2);
				jest.advanceTimersByTime(300);

				expect(updatesFor('a_total_act_energy')).toHaveLength(1);
				expect(updatesFor('a_total_act_energy')[0].value).toBe(222.2);
			} finally {
				jest.useRealTimers();
			}
		});

		test('em1: act_power reaches power:0 / act_power', async () => {
			jest.useFakeTimers();

			try {
				const { device } = arrangeDeviceInfoMocks();

				const { channel, property } = meterChannelAndProperty(
					device.id,
					ChannelCategory.ELECTRICAL_POWER,
					'power:0',
					PropertyCategory.POWER,
					'act_power',
				);

				(channelsService.findOneBy as jest.Mock).mockImplementationOnce(
					async () => channel as unknown as ShellyNgChannelEntity,
				);

				(channelsPropertiesService.findOneBy as jest.Mock).mockImplementationOnce(
					async () => property as unknown as ShellyNgChannelPropertyEntity,
				);

				const shelly: FakeDevice = {
					id: 'shelly-em1-meter',
					modelName: 'Pro EM',
					system: { config: { device: { name: 'Pro EM', mac: 'AABBCCDDEE22' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.62' },
					em1: { id: 0, key: 'em1:0', act_power: 45.6 },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				delegate.emitValue('em1:0', 'act_power', 50.0);
				jest.advanceTimersByTime(300);

				expect(updatesFor('act_power')).toHaveLength(1);
				expect(updatesFor('act_power')[0].value).toBe(50.0);
			} finally {
				jest.useRealTimers();
			}
		});

		test('em1data: total_act_energy reaches energy:1 / total_act_energy (non-zero component id)', async () => {
			jest.useFakeTimers();

			try {
				const { device } = arrangeDeviceInfoMocks();

				const { channel, property } = meterChannelAndProperty(
					device.id,
					ChannelCategory.ELECTRICAL_ENERGY,
					'energy:1',
					PropertyCategory.CONSUMPTION,
					'total_act_energy',
				);

				(channelsService.findOneBy as jest.Mock).mockImplementationOnce(
					async () => channel as unknown as ShellyNgChannelEntity,
				);

				(channelsPropertiesService.findOneBy as jest.Mock).mockImplementationOnce(
					async () => property as unknown as ShellyNgChannelPropertyEntity,
				);

				const shelly: FakeDevice = {
					id: 'shelly-em1data-meter',
					modelName: 'Pro EM',
					system: { config: { device: { name: 'Pro EM', mac: 'AABBCCDDEE23' } } },
					wifi: { key: 'wifi:0', rssi: -60, sta_ip: '192.168.1.63' },
					em1Data: { id: 1, key: 'em1data:1', total_act_energy: 555.5 },
				};

				const delegate = (await svc.insert(shelly as unknown as Device)) as any;

				(channelsPropertiesService.update as jest.Mock).mockClear();

				delegate.emitValue('em1data:1', 'total_act_energy', 600.1);
				jest.advanceTimersByTime(300);

				expect(updatesFor('total_act_energy')).toHaveLength(1);
				expect(updatesFor('total_act_energy')[0].value).toBe(600.1);
			} finally {
				jest.useRealTimers();
			}
		});
	});
});
