import { ModbusByteOrder, ModbusDataType, ModbusRegisterType, ModbusWriteFunction } from '../devices-modbus.constants';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';
import { ModbusEndpointUnavailableError, ModbusExceptionError } from '../lib/errors';
import { ModbusBindingsService } from '../services/modbus-bindings.service';
import { ModbusConnectionsService } from '../services/modbus-connections.service';
import { ModbusRuntimeService } from '../services/modbus-runtime.service';

import { ModbusDevicePlatform } from './modbus.device.platform';

const binding = (overrides: Partial<ModbusBindingEntity> = {}): ModbusBindingEntity =>
	({
		role: 'write',
		registerType: ModbusRegisterType.HOLDING_REGISTER,
		address: 3,
		dataType: ModbusDataType.UINT16,
		bit: null,
		byteOrder: null,
		wordOrder: null,
		scale: 1,
		offset: 0,
		invert: false,
		valueMap: null,
		writeFunction: ModbusWriteFunction.SINGLE,
		...overrides,
	}) as unknown as ModbusBindingEntity;

const update = (propertyId: string, value: string | number | boolean, deviceId = 'dev-1') => ({
	device: { id: deviceId, unitId: 7, byteOrder: null, wordOrder: null },
	channel: { id: 'ch' },
	property: { id: propertyId },
	value,
});

describe('ModbusDevicePlatform', () => {
	let write: jest.Mock;
	let writes: Map<string, ModbusBindingEntity | null>;
	let reads: Map<string, ModbusBindingEntity | null>;
	let readBack: jest.Mock;
	let getConnection: jest.Mock;
	let envelope: jest.Mock;
	let platform: ModbusDevicePlatform;

	beforeEach(() => {
		write = jest.fn().mockResolvedValue(undefined);
		writes = new Map();
		reads = new Map();
		readBack = jest.fn().mockResolvedValue(undefined);
		getConnection = jest.fn().mockReturnValue({ write });
		envelope = jest.fn().mockReturnValue(null);

		const bindings = {
			findByProperty: jest.fn((id: string) =>
				Promise.resolve({ read: reads.get(id) ?? null, write: writes.get(id) ?? null }),
			),
		} as unknown as ModbusBindingsService;
		const runtime = { getConnection, readBack } as unknown as ModbusRuntimeService;
		const connections = { getTimingEnvelope: envelope } as unknown as ModbusConnectionsService;

		platform = new ModbusDevicePlatform(bindings, runtime, connections);
	});

	it('reports its type', () => {
		expect(platform.getType()).toBe('devices-modbus');
	});

	it('writes N4D8B08 on as 256 with FC06', async () => {
		writes.set(
			'p1',
			binding({
				valueMap: [
					{ raw: 256, value: true },
					{ raw: 512, value: false },
				],
			}),
		);
		reads.set('p1', binding({ role: 'read' as never }));

		await expect(platform.process(update('p1', true) as never)).resolves.toBe(true);

		expect(write).toHaveBeenCalledWith({
			unitId: 7,
			registerType: ModbusRegisterType.HOLDING_REGISTER,
			address: 3,
			values: [256],
			writeFunction: ModbusWriteFunction.SINGLE,
		});
		expect(readBack).toHaveBeenCalledWith('dev-1', ['p1']);
	});

	it('writes a coil with FC05', async () => {
		writes.set('p1', binding({ registerType: ModbusRegisterType.COIL, dataType: ModbusDataType.BOOL, address: 5 }));

		await expect(platform.process(update('p1', false) as never)).resolves.toBe(true);

		expect(write).toHaveBeenCalledWith({
			unitId: 7,
			registerType: ModbusRegisterType.COIL,
			address: 5,
			values: [false],
			writeFunction: ModbusWriteFunction.SINGLE,
		});
		expect(readBack).not.toHaveBeenCalled();
	});

	it('uses FC16 for a two-word value even when write_function is single', async () => {
		writes.set('p1', binding({ dataType: ModbusDataType.UINT32 }));

		await platform.process(update('p1', 65536) as never);

		expect(write).toHaveBeenCalledWith(
			expect.objectContaining({ values: [1, 0], writeFunction: ModbusWriteFunction.MULTIPLE }),
		);
	});

	it('applies the device word order unless the binding overrides it', async () => {
		writes.set('p1', binding({ dataType: ModbusDataType.UINT32, writeFunction: ModbusWriteFunction.MULTIPLE }));
		const u = update('p1', 65536);
		(u.device as { wordOrder: ModbusByteOrder | null }).wordOrder = ModbusByteOrder.LITTLE;

		await platform.process(u as never);

		expect(write).toHaveBeenCalledWith(expect.objectContaining({ values: [0, 1] }));

		write.mockClear();
		writes.set(
			'p1',
			binding({
				dataType: ModbusDataType.UINT32,
				writeFunction: ModbusWriteFunction.MULTIPLE,
				wordOrder: ModbusByteOrder.BIG,
			}),
		);

		await platform.process(u as never);

		expect(write).toHaveBeenCalledWith(expect.objectContaining({ values: [1, 0] }));
	});

	it('merges adjacent multiple-function writes', async () => {
		const multiple = ModbusWriteFunction.MULTIPLE;

		writes.set('a', binding({ address: 10, writeFunction: multiple }));
		writes.set('b', binding({ address: 11, writeFunction: multiple }));

		await expect(platform.processBatch([update('a', 1), update('b', 2)] as never)).resolves.toBe(true);

		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith({
			unitId: 7,
			registerType: ModbusRegisterType.HOLDING_REGISTER,
			address: 10,
			values: [1, 2],
			writeFunction: multiple,
		});
	});

	it('merges adjacent coils into one multiple write', async () => {
		const coil = { registerType: ModbusRegisterType.COIL, dataType: ModbusDataType.BOOL };

		writes.set('a', binding({ ...coil, address: 0, writeFunction: ModbusWriteFunction.MULTIPLE }));
		writes.set('b', binding({ ...coil, address: 1, writeFunction: ModbusWriteFunction.MULTIPLE }));

		await platform.processBatch([update('a', true), update('b', false)] as never);

		expect(write).toHaveBeenCalledTimes(1);
		expect(write).toHaveBeenCalledWith(expect.objectContaining({ address: 0, values: [true, false] }));
	});

	it('does not merge single-function writes', async () => {
		writes.set('a', binding({ address: 10 }));
		writes.set('b', binding({ address: 11 }));

		await expect(platform.processBatch([update('a', 1), update('b', 2)] as never)).resolves.toBe(true);

		expect(write).toHaveBeenCalledTimes(2);
		expect((write.mock.calls as Array<[{ address: number }]>).map(([r]) => r.address)).toEqual([10, 11]);
	});

	it('does not merge when only one member is multiple, and keeps the caller order', async () => {
		writes.set('a', binding({ address: 11, writeFunction: ModbusWriteFunction.MULTIPLE }));
		writes.set('b', binding({ address: 10 }));

		await platform.processBatch([update('a', 1), update('b', 2)] as never);

		expect((write.mock.calls as Array<[{ address: number }]>).map(([r]) => r.address)).toEqual([11, 10]);
	});

	it('does not merge non-adjacent or different register types', async () => {
		const multiple = ModbusWriteFunction.MULTIPLE;

		writes.set('a', binding({ address: 10, writeFunction: multiple }));
		writes.set('b', binding({ address: 12, writeFunction: multiple }));
		writes.set(
			'c',
			binding({
				address: 13,
				writeFunction: multiple,
				registerType: ModbusRegisterType.COIL,
				dataType: ModbusDataType.BOOL,
			}),
		);

		await platform.processBatch([update('a', 1), update('b', 2), update('c', true)] as never);

		expect(write).toHaveBeenCalledTimes(3);
	});

	it('processes a mixed-device batch per device and never merges across devices', async () => {
		const multiple = ModbusWriteFunction.MULTIPLE;
		const connections: Record<string, { write: jest.Mock }> = {
			d1: { write: jest.fn().mockResolvedValue(undefined) },
			d2: { write: jest.fn().mockResolvedValue(undefined) },
		};

		getConnection.mockImplementation((id: string) => connections[id]);
		writes.set('a', binding({ address: 10, writeFunction: multiple }));
		writes.set('b', binding({ address: 11, writeFunction: multiple }));
		writes.set('c', binding({ address: 12, writeFunction: multiple }));

		await expect(
			platform.processBatch([update('a', 1, 'd1'), update('b', 2, 'd2'), update('c', 3, 'd1')] as never),
		).resolves.toBe(true);

		expect(connections.d1.write).toHaveBeenCalledTimes(2);
		expect(connections.d2.write).toHaveBeenCalledTimes(1);
		expect(readBack).not.toHaveBeenCalled();
	});

	it('fails fast when the endpoint is in backoff', async () => {
		writes.set('p1', binding());
		reads.set('p1', binding({ role: 'read' as never }));
		write.mockRejectedValue(new ModbusEndpointUnavailableError());

		await expect(platform.process(update('p1', 1) as never)).resolves.toBe(false);

		expect(readBack).not.toHaveBeenCalled();
	});

	it('returns false for a Modbus exception', async () => {
		writes.set('p1', binding());
		write.mockRejectedValue(new ModbusExceptionError(2));

		await expect(platform.process(update('p1', 1) as never)).resolves.toBe(false);
	});

	it('returns false when the device is not commandable', async () => {
		writes.set('p1', binding());
		getConnection.mockReturnValue(null);

		await expect(platform.process(update('p1', 1) as never)).resolves.toBe(false);
	});

	it('refuses out-of-range values', async () => {
		writes.set('p1', binding());

		await expect(platform.process(update('p1', 70000) as never)).resolves.toBe(false);

		expect(write).not.toHaveBeenCalled();
	});

	it('sends nothing for a device when any of its values cannot be encoded', async () => {
		writes.set('a', binding({ address: 1 }));
		writes.set('b', binding({ address: 2 }));

		await expect(platform.processBatch([update('a', 1), update('b', 70000)] as never)).resolves.toBe(false);

		expect(write).not.toHaveBeenCalled();
	});

	it('returns false without a write binding', async () => {
		await expect(platform.process(update('p1', 1) as never)).resolves.toBe(false);

		expect(write).not.toHaveBeenCalled();
	});

	it('catches a rejected read-back and still returns true', async () => {
		const unhandled = jest.fn();

		process.on('unhandledRejection', unhandled);

		writes.set('p1', binding());
		reads.set('p1', binding({ role: 'read' as never }));
		readBack.mockRejectedValue(new ModbusEndpointUnavailableError('not polled'));

		await expect(platform.process(update('p1', 1) as never)).resolves.toBe(true);
		await new Promise((resolve) => setImmediate(resolve));

		process.off('unhandledRejection', unhandled);

		expect(readBack).toHaveBeenCalled();
		expect(unhandled).not.toHaveBeenCalled();
	});

	it('does not wait for the read-back', async () => {
		writes.set('p1', binding());
		reads.set('p1', binding({ role: 'read' as never }));
		readBack.mockReturnValue(new Promise(() => undefined));

		await expect(platform.process(update('p1', 1) as never)).resolves.toBe(true);
	});

	describe('getCommandTimeoutMs', () => {
		it('uses the slowest loaded endpoint', () => {
			envelope.mockReturnValue({ requestTimeoutMs: 1500, interRequestDelayMs: 20 });

			expect(platform.getCommandTimeoutMs(3)).toBe(3 * (1500 + 20) + 1000);
		});

		it('falls back to the defaults when no endpoint is loaded', () => {
			expect(platform.getCommandTimeoutMs(2)).toBe(2 * (1000 + 0) + 1000);
		});
	});
});
