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

type FakeDevice = {
	id: string;
	modelName: string;
	system: { config: { device: { name: string | null } } };
	wifi?: Wifi;
	ethernet?: { key: string; ip: string | null };
	switch?: { key: string; output: boolean };
};

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
			this.rgb = new Map();
			this.rgbw = new Map();
			this.cct = new Map();
			this.covers = new Map();
			this.inputs = new Map();
			this.devPwr = new Map();
			this.humidity = new Map();
			this.temperature = new Map();
			this.pm1 = new Map();

			// simple one-switch wiring for tests
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

		deviceConnectivityService.setConnectionState = jest.fn().mockResolvedValue(undefined);

		svc = new DelegatesManagerService(
			devicesService as any,
			channelsService as any,
			channelsPropertiesService as any,
			deviceConnectivityService as any,
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
		(devicesService.findOneBy as jest.Mock).mockResolvedValueOnce(null);
		(devicesService.create as jest.Mock).mockImplementation(
			async (dto: CreateShellyNgDeviceDto): Promise<ShellyNgDeviceEntity> => {
				device.identifier = dto.identifier;
				device.hostname = dto.hostname;
				device.name = dto.name;
				device.category = dto.category;
				return device as unknown as ShellyNgDeviceEntity;
			},
		);

		// channelsService mocks (device information + switch)
		(channelsService.findOneBy as jest.Mock)
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
			system: { config: { device: { name: 'My Shelly' } } },
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
			system: { config: { device: { name: 'My Shelly' } } },
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

		await expect(svc.setChannelValue(device, channel, [])).rejects.toThrowError(
			'Multiple property writes are not supported by the component.',
		);
	});

	test('remove() detaches device, call connection=null and clear statuses', async () => {
		const { device } = arrangeBaseEntities();

		const shelly: FakeDevice = {
			id: 'shelly-remove',
			modelName: 'Plus 1',
			system: { config: { device: { name: 'X' } } },
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

		svc.remove(delegate.id);

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
			system: { config: { device: { name: 'D1' } } },
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

			svc['setPropertiesHandlers'].set(`${device.identifier}|${property.id}`, handlerSpy);

			const result = await svc.setPropertyValue(device, property, 50);

			expect(result).toBe(true);
			expect(handlerSpy).toHaveBeenCalled();
		});
	});
});
