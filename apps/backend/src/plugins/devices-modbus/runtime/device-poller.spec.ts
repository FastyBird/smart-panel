import { ExtensionLoggerService } from '../../../common/logger/extension-logger.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { ModbusBindingRole, ModbusByteOrder, ModbusDataType, ModbusRegisterType } from '../devices-modbus.constants';
import { ModbusBindingEntity } from '../entities/modbus-binding.entity';
import { ModbusConnectionError, ModbusExceptionError, ModbusTimeoutError } from '../lib/errors';
import { ModbusReadRequest } from '../transport/modbus-transport';

import { DevicePoller, ModbusDeviceSnapshot, PollerCallbacks } from './device-poller';
import { EndpointConnection } from './endpoint-connection';

interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
}

const deferred = <T>(): Deferred<T> => {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
};

const binding = (overrides: Partial<ModbusBindingEntity> = {}): ModbusBindingEntity =>
	({
		id: `binding-${Math.random()}`,
		propertyId: 'property',
		deviceId: 'device-1',
		role: ModbusBindingRole.READ,
		registerType: ModbusRegisterType.HOLDING_REGISTER,
		address: 0,
		dataType: ModbusDataType.UINT16,
		bit: null,
		byteOrder: null,
		wordOrder: null,
		scale: 1,
		offset: 0,
		invert: false,
		valueMap: null,
		writeFunction: null,
		pollIntervalMs: null,
		...overrides,
	}) as ModbusBindingEntity;

const read = (propertyId: string, overrides: Partial<ModbusBindingEntity> = {}) => ({
	propertyId,
	binding: binding({ propertyId, ...overrides }),
});

const snapshot = (
	reads: ModbusDeviceSnapshot['reads'],
	overrides: Partial<ModbusDeviceSnapshot> = {},
): ModbusDeviceSnapshot => ({
	deviceId: 'device-1',
	endpointId: 'endpoint-1',
	unitId: 1,
	pollIntervalMs: 1000,
	byteOrder: ModbusByteOrder.BIG,
	wordOrder: ModbusByteOrder.BIG,
	limits: { maxRegisters: 125, maxBits: 2000, maxGap: 0 },
	reads,
	...overrides,
});

class FakeConnection {
	read = jest.fn<Promise<number[] | boolean[]>, [ModbusReadRequest]>();
	markOverloaded = jest.fn();
}

const makeCallbacks = () => ({
	report: jest.fn<Promise<void>, [string, unknown, Date]>().mockResolvedValue(undefined),
	setConnectionState: jest.fn<Promise<void>, [ConnectionState, string?]>().mockResolvedValue(undefined),
	isCurrent: jest.fn(() => true),
	setOverloaded: jest.fn<void, [boolean]>(),
});

describe('DevicePoller', () => {
	let connection: FakeConnection;
	let callbacks: ReturnType<typeof makeCallbacks>;
	let poller: DevicePoller | null;

	const create = (device: ModbusDeviceSnapshot): DevicePoller => {
		poller = new DevicePoller(
			device,
			connection as unknown as EndpointConnection,
			callbacks as unknown as PollerCallbacks,
		);

		return poller;
	};

	const reported = (): Map<string, unknown> =>
		new Map(callbacks.report.mock.calls.map(([propertyId, value]) => [propertyId, value]));

	beforeEach(() => {
		jest.useFakeTimers();

		connection = new FakeConnection();
		callbacks = makeCallbacks();
		poller = null;
	});

	afterEach(() => {
		poller?.stop();
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	it('reads the Qingjun board in one request', async () => {
		const reads = Array.from({ length: 32 }, (_, index) =>
			read(`DI${index + 1}`, {
				address: index < 16 ? 4 : 5,
				bit: index % 16,
				dataType: ModbusDataType.BOOL,
			}),
		);

		connection.read.mockResolvedValue([0x0001, 0x8000]);

		create(snapshot(reads)).start();
		await jest.advanceTimersByTimeAsync(0);

		expect(connection.read).toHaveBeenCalledTimes(1);
		expect(connection.read).toHaveBeenCalledWith({
			unitId: 1,
			registerType: ModbusRegisterType.HOLDING_REGISTER,
			address: 4,
			count: 2,
		});

		const values = reported();

		expect(values.size).toBe(32);
		expect(values.get('DI1')).toBe(true);
		expect(values.get('DI32')).toBe(true);
		expect([...values.entries()].filter(([, value]) => value === false)).toHaveLength(30);
	});

	it('sets init before the first poll and connected after it', async () => {
		connection.read.mockResolvedValue([7]);

		create(snapshot([read('p1')])).start();
		await jest.advanceTimersByTimeAsync(0);

		expect(callbacks.setConnectionState.mock.calls).toEqual([
			[ConnectionState.INIT, undefined],
			[ConnectionState.CONNECTED, undefined],
		]);
		expect(callbacks.report).toHaveBeenCalledWith('p1', 7, expect.any(Date));
	});

	it('reports only changes', async () => {
		connection.read.mockResolvedValue([10, 20]);

		create(snapshot([read('p1', { address: 0 }), read('p2', { address: 1 })])).start();
		await jest.advanceTimersByTimeAsync(0);

		expect(callbacks.report).toHaveBeenCalledTimes(2);

		await jest.advanceTimersByTimeAsync(1000);

		expect(connection.read).toHaveBeenCalledTimes(2);
		expect(callbacks.report).toHaveBeenCalledTimes(2);

		connection.read.mockResolvedValue([10, 21]);
		await jest.advanceTimersByTimeAsync(1000);

		expect(callbacks.report).toHaveBeenCalledTimes(3);
		expect(callbacks.report).toHaveBeenLastCalledWith('p2', 21, expect.any(Date));
	});

	it('reports null for an unmapped relay value', async () => {
		connection.read.mockResolvedValue([2]);

		create(
			snapshot([
				read('relay', {
					valueMap: [
						{ raw: 1, value: true },
						{ raw: 0, value: false },
					],
				}),
			]),
		).start();
		await jest.advanceTimersByTimeAsync(0);

		expect(callbacks.report).toHaveBeenCalledWith('relay', null, expect.any(Date));
	});

	it('applies the device byte and word order unless the binding overrides it', async () => {
		connection.read.mockResolvedValue([0x0000, 0x0001, 0x0100]);

		create(
			snapshot(
				[
					read('device-order', { address: 0, dataType: ModbusDataType.UINT32 }),
					read('binding-order', { address: 2, byteOrder: ModbusByteOrder.BIG }),
				],
				{ wordOrder: ModbusByteOrder.LITTLE, byteOrder: ModbusByteOrder.LITTLE },
			),
		).start();
		await jest.advanceTimersByTimeAsync(0);

		// [0x0000, 0x0001] little word + little byte -> words [0x0100, 0x0000] -> 0x01000000
		expect(reported().get('device-order')).toBe(0x01000000);
		expect(reported().get('binding-order')).toBe(0x0100);
	});

	it('invalidates a block on exception and splits it', async () => {
		connection.read.mockRejectedValueOnce(new ModbusExceptionError(2));
		connection.read.mockResolvedValue([5]);

		create(
			snapshot([read('p1', { address: 10 }), read('p2', { address: 12 })], {
				limits: { maxRegisters: 125, maxBits: 2000, maxGap: 2 },
			}),
		).start();
		await jest.advanceTimersByTimeAsync(0);

		expect(connection.read).toHaveBeenCalledTimes(1);
		expect(connection.read).toHaveBeenCalledWith(expect.objectContaining({ address: 10, count: 3 }));
		expect(callbacks.report).toHaveBeenCalledWith('p1', null, expect.any(Date));
		expect(callbacks.report).toHaveBeenCalledWith('p2', null, expect.any(Date));
		// The device answered: an exception is not a failed poll
		expect(callbacks.setConnectionState).toHaveBeenLastCalledWith(ConnectionState.CONNECTED, undefined);

		await jest.advanceTimersByTimeAsync(1000);

		expect(connection.read).toHaveBeenCalledTimes(3);
		expect(connection.read).toHaveBeenNthCalledWith(2, expect.objectContaining({ address: 10, count: 1 }));
		expect(connection.read).toHaveBeenNthCalledWith(3, expect.objectContaining({ address: 12, count: 1 }));
		expect(reported().get('p1')).toBe(5);
		expect(reported().get('p2')).toBe(5);
	});

	it.each([0x01, 0x03])('splits a block on request exception code %d', async (code) => {
		connection.read.mockRejectedValueOnce(new ModbusExceptionError(code));
		connection.read.mockResolvedValue([5]);

		create(snapshot([read('p1', { address: 10 }), read('p2', { address: 11 })])).start();
		await jest.advanceTimersByTimeAsync(0);

		expect(reported()).toEqual(
			new Map([
				['p1', null],
				['p2', null],
			]),
		);

		await jest.advanceTimersByTimeAsync(1000);

		expect(connection.read.mock.calls.slice(1).map(([request]) => [request.address, request.count])).toEqual([
			[10, 1],
			[11, 1],
		]);
	});

	it('treats server busy 0x06 as a failed poll without splitting or invalidating the block', async () => {
		connection.read.mockResolvedValueOnce([1, 2]);
		connection.read.mockRejectedValue(new ModbusExceptionError(0x06));

		create(snapshot([read('p1', { address: 10 }), read('p2', { address: 11 })])).start();
		await jest.advanceTimersByTimeAsync(0);

		callbacks.report.mockClear();
		await jest.advanceTimersByTimeAsync(2000);

		// Two failed polls: values kept, not lost yet, and the block is still read whole
		expect(callbacks.report).not.toHaveBeenCalled();
		expect(callbacks.setConnectionState).not.toHaveBeenCalledWith(ConnectionState.LOST, expect.anything());

		await jest.advanceTimersByTimeAsync(1000);

		// The third failed poll in a row reports lost and invalidates through the lost path
		expect(callbacks.setConnectionState).toHaveBeenLastCalledWith(ConnectionState.LOST, expect.any(String));
		expect(reported()).toEqual(
			new Map([
				['p1', null],
				['p2', null],
			]),
		);
		expect(connection.read).toHaveBeenCalledTimes(4);

		for (const [request] of connection.read.mock.calls) {
			expect(request).toMatchObject({ address: 10, count: 2 });
		}
	});

	it('resets the failed-poll count when a poll succeeds between busy replies', async () => {
		const busy = new ModbusExceptionError(0x06);

		connection.read
			.mockRejectedValueOnce(busy)
			.mockRejectedValueOnce(busy)
			.mockResolvedValueOnce([1])
			.mockRejectedValueOnce(busy)
			.mockRejectedValueOnce(busy)
			.mockResolvedValue([1]);

		create(snapshot([read('p1')])).start();
		await jest.advanceTimersByTimeAsync(0);
		await jest.advanceTimersByTimeAsync(5000);

		expect(callbacks.setConnectionState).not.toHaveBeenCalledWith(ConnectionState.LOST, expect.anything());
	});

	it.each([0x04, 0x05, 0x08, 0x7f])(
		'does not split or invalidate a block on transient exception code %d',
		async (code) => {
			connection.read.mockRejectedValueOnce(new ModbusExceptionError(code));
			connection.read.mockResolvedValue([5, 6]);

			create(snapshot([read('p1', { address: 10 }), read('p2', { address: 11 })])).start();
			await jest.advanceTimersByTimeAsync(0);

			expect(callbacks.report).not.toHaveBeenCalled();
			expect(callbacks.setConnectionState).not.toHaveBeenCalledWith(ConnectionState.CONNECTED, undefined);

			await jest.advanceTimersByTimeAsync(1000);

			expect(connection.read).toHaveBeenCalledTimes(2);
			expect(connection.read).toHaveBeenLastCalledWith(expect.objectContaining({ address: 10, count: 2 }));
			expect(reported()).toEqual(
				new Map([
					['p1', 5],
					['p2', 6],
				]),
			);
		},
	);

	it('treats gateway exception 0x0B as a failed poll', async () => {
		connection.read.mockRejectedValue(new ModbusExceptionError(0x0b));

		create(
			snapshot([read('p1', { address: 10 }), read('p2', { address: 11 })], {
				pollIntervalMs: 1000,
			}),
		).start();
		await jest.advanceTimersByTimeAsync(0);
		await jest.advanceTimersByTimeAsync(1000);

		expect(callbacks.setConnectionState).not.toHaveBeenCalledWith(ConnectionState.LOST, expect.anything());

		await jest.advanceTimersByTimeAsync(1000);

		expect(callbacks.setConnectionState).toHaveBeenCalledWith(ConnectionState.LOST, expect.any(String));
		expect(connection.read).toHaveBeenCalledTimes(3);

		for (const [request] of connection.read.mock.calls) {
			expect(request).toMatchObject({ address: 10, count: 2 });
		}
	});

	it('marks lost after three failed polls and recovers', async () => {
		connection.read.mockResolvedValueOnce([1, 2]);
		connection.read.mockRejectedValueOnce(new ModbusTimeoutError());
		connection.read.mockRejectedValueOnce(new ModbusConnectionError('socket closed'));
		connection.read.mockRejectedValueOnce(new ModbusTimeoutError());
		connection.read.mockResolvedValue([1, 2]);

		create(snapshot([read('p1', { address: 0 }), read('p2', { address: 1 })])).start();
		await jest.advanceTimersByTimeAsync(0);

		expect(reported()).toEqual(
			new Map([
				['p1', 1],
				['p2', 2],
			]),
		);

		await jest.advanceTimersByTimeAsync(2000);

		expect(callbacks.setConnectionState).not.toHaveBeenCalledWith(ConnectionState.LOST, expect.anything());
		expect(callbacks.report).toHaveBeenCalledTimes(2);

		await jest.advanceTimersByTimeAsync(1000);

		expect(callbacks.setConnectionState).toHaveBeenLastCalledWith(ConnectionState.LOST, expect.any(String));
		expect(reported()).toEqual(
			new Map([
				['p1', null],
				['p2', null],
			]),
		);
		expect(callbacks.report).toHaveBeenCalledTimes(4);

		await jest.advanceTimersByTimeAsync(1000);

		expect(callbacks.setConnectionState).toHaveBeenLastCalledWith(ConnectionState.CONNECTED, undefined);
		expect(reported()).toEqual(
			new Map([
				['p1', 1],
				['p2', 2],
			]),
		);
	});

	it('does not report null again while staying lost', async () => {
		connection.read.mockRejectedValue(new ModbusTimeoutError());

		create(snapshot([read('p1')])).start();
		await jest.advanceTimersByTimeAsync(0);
		await jest.advanceTimersByTimeAsync(5000);

		expect(callbacks.report).toHaveBeenCalledTimes(1);
		expect(callbacks.report).toHaveBeenCalledWith('p1', null, expect.any(Date));
		// Lost at the third of six failed polls, then re-asserted by each later one (the runtime deduplicates).
		expect(callbacks.setConnectionState.mock.calls.filter(([state]) => state === ConnectionState.LOST)).toHaveLength(4);
	});

	it('re-asserts connected after every successful poll, so a state the store missed is stored later', async () => {
		connection.read.mockResolvedValue([7]);

		create(snapshot([read('p1')])).start();
		await jest.advanceTimersByTimeAsync(0);
		await jest.advanceTimersByTimeAsync(2000);

		expect(callbacks.setConnectionState.mock.calls).toEqual([
			[ConnectionState.INIT, undefined],
			[ConnectionState.CONNECTED, undefined],
			[ConnectionState.CONNECTED, undefined],
			[ConnectionState.CONNECTED, undefined],
		]);
	});

	it('skips ticks while a poll is running and flags overload', async () => {
		const slow = deferred<number[]>();

		connection.read.mockReturnValueOnce(slow.promise);
		connection.read.mockResolvedValue([1]);

		create(snapshot([read('p1')])).start();
		await jest.advanceTimersByTimeAsync(0);
		await jest.advanceTimersByTimeAsync(2500);

		expect(connection.read).toHaveBeenCalledTimes(1);
		expect(callbacks.setOverloaded).toHaveBeenCalledWith(true);
		expect(poller?.isOverloaded()).toBe(true);

		slow.resolve([1]);
		await jest.advanceTimersByTimeAsync(0);

		// The slow poll took longer than its interval, so the flag stays up
		expect(poller?.isOverloaded()).toBe(true);

		await jest.advanceTimersByTimeAsync(500);

		expect(connection.read).toHaveBeenCalledTimes(2);
		expect(poller?.isOverloaded()).toBe(false);
		expect(callbacks.setOverloaded).toHaveBeenLastCalledWith(false);
	});

	it('discards results after stop', async () => {
		const slow = deferred<number[]>();

		connection.read.mockReturnValueOnce(slow.promise);

		create(snapshot([read('p1')])).start();
		await jest.advanceTimersByTimeAsync(0);

		poller?.stop();
		slow.resolve([42]);
		await jest.advanceTimersByTimeAsync(5000);

		expect(callbacks.report).not.toHaveBeenCalled();
		expect(callbacks.setConnectionState).not.toHaveBeenCalledWith(ConnectionState.CONNECTED, undefined);
		expect(connection.read).toHaveBeenCalledTimes(1);
	});

	it('discards results when the callbacks are no longer current', async () => {
		const slow = deferred<number[]>();

		connection.read.mockReturnValueOnce(slow.promise);

		create(snapshot([read('p1')])).start();
		await jest.advanceTimersByTimeAsync(0);

		callbacks.isCurrent.mockReturnValue(false);
		slow.resolve([42]);
		await jest.advanceTimersByTimeAsync(0);

		expect(callbacks.report).not.toHaveBeenCalled();
	});

	it('keeps polling after a report fails and retries the value', async () => {
		connection.read.mockResolvedValue([3]);
		callbacks.report.mockRejectedValueOnce(new Error('property was deleted'));

		create(snapshot([read('p1')])).start();
		await jest.advanceTimersByTimeAsync(0);

		expect(callbacks.report).toHaveBeenCalledTimes(1);

		await jest.advanceTimersByTimeAsync(1000);

		expect(connection.read).toHaveBeenCalledTimes(2);
		expect(callbacks.report).toHaveBeenCalledTimes(2);

		await jest.advanceTimersByTimeAsync(1000);

		expect(callbacks.report).toHaveBeenCalledTimes(2);
	});

	it('keeps polling after a connection state update fails', async () => {
		connection.read.mockResolvedValue([3]);
		callbacks.setConnectionState.mockRejectedValue(new Error('device was deleted'));

		create(snapshot([read('p1')])).start();
		await jest.advanceTimersByTimeAsync(0);
		await jest.advanceTimersByTimeAsync(1000);

		expect(connection.read).toHaveBeenCalledTimes(2);
	});

	it('gives points with their own interval their own schedule', async () => {
		connection.read.mockImplementation((request) => Promise.resolve(Array(request.count).fill(1) as number[]));

		create(snapshot([read('fast', { address: 0 }), read('slow', { address: 1, pollIntervalMs: 5000 })])).start();
		await jest.advanceTimersByTimeAsync(0);

		expect(connection.read).toHaveBeenCalledTimes(2);

		await jest.advanceTimersByTimeAsync(4000);

		expect(connection.read.mock.calls.filter(([request]) => request.address === 0)).toHaveLength(5);
		expect(connection.read.mock.calls.filter(([request]) => request.address === 1)).toHaveLength(1);

		await jest.advanceTimersByTimeAsync(1000);

		expect(connection.read.mock.calls.filter(([request]) => request.address === 1)).toHaveLength(2);
	});

	it('reads coils as bits', async () => {
		connection.read.mockResolvedValue([true, false]);

		create(
			snapshot([
				read('c0', { registerType: ModbusRegisterType.COIL, address: 0, dataType: ModbusDataType.BOOL }),
				read('c1', {
					registerType: ModbusRegisterType.COIL,
					address: 1,
					dataType: ModbusDataType.BOOL,
					invert: true,
				}),
			]),
		).start();
		await jest.advanceTimersByTimeAsync(0);

		expect(connection.read).toHaveBeenCalledWith(
			expect.objectContaining({ registerType: ModbusRegisterType.COIL, address: 0, count: 2 }),
		);
		expect(reported()).toEqual(
			new Map([
				['c0', true],
				['c1', true],
			]),
		);
	});

	it('reads back the requested properties on demand and reports them even when unchanged', async () => {
		connection.read.mockImplementation((request) => Promise.resolve(Array(request.count).fill(4) as number[]));

		create(snapshot([read('p1', { address: 0 }), read('p2', { address: 20 })])).start();
		await jest.advanceTimersByTimeAsync(0);

		connection.read.mockClear();
		callbacks.report.mockClear();

		await poller?.pollNow(['p2']);

		expect(connection.read).toHaveBeenCalledTimes(1);
		expect(connection.read).toHaveBeenCalledWith(expect.objectContaining({ address: 20, count: 1 }));
		expect(callbacks.report).toHaveBeenCalledWith('p2', 4, expect.any(Date));
	});

	it('rejects a read-back when the endpoint does not answer', async () => {
		connection.read.mockResolvedValueOnce([1]);
		connection.read.mockRejectedValue(new ModbusTimeoutError());

		create(snapshot([read('p1')])).start();
		await jest.advanceTimersByTimeAsync(0);

		await expect(poller?.pollNow(['p1'])).rejects.toBeInstanceOf(ModbusTimeoutError);
	});

	describe('warnings', () => {
		let warn: jest.SpyInstance;

		beforeEach(() => {
			warn = jest.spyOn(ExtensionLoggerService.prototype, 'warn').mockImplementation(() => undefined);
		});

		afterEach(() => {
			warn.mockRestore();
		});

		const warnings = (text: string): number =>
			warn.mock.calls.filter(([message]) => String(message).includes(text)).length;

		it('logs a permanently illegal address once until it answers again', async () => {
			connection.read.mockRejectedValue(new ModbusExceptionError(0x02));

			create(snapshot([read('p1', { address: 10 })])).start();
			await jest.advanceTimersByTimeAsync(0);
			await jest.advanceTimersByTimeAsync(4000);

			expect(connection.read).toHaveBeenCalledTimes(5);
			expect(warnings('Modbus exception 2')).toBe(1);

			connection.read.mockResolvedValueOnce([1]);
			await jest.advanceTimersByTimeAsync(1000);
			await jest.advanceTimersByTimeAsync(2000);

			// Answered once in between, so the second outage is a new condition.
			expect(warnings('Modbus exception 2')).toBe(2);
		});

		it('logs again when the exception code of a point changes', async () => {
			connection.read.mockRejectedValueOnce(new ModbusExceptionError(0x02));
			connection.read.mockRejectedValue(new ModbusExceptionError(0x03));

			create(snapshot([read('p1', { address: 10 })])).start();
			await jest.advanceTimersByTimeAsync(0);
			await jest.advanceTimersByTimeAsync(3000);

			expect(warnings('Modbus exception 2')).toBe(1);
			expect(warnings('Modbus exception 3')).toBe(1);
		});

		it('logs a decode failure once per property until it decodes again', async () => {
			// A uint32 needs two registers; a short answer cannot be decoded.
			connection.read.mockResolvedValue([1]);

			create(snapshot([read('p1', { dataType: ModbusDataType.UINT32 })])).start();
			await jest.advanceTimersByTimeAsync(0);
			await jest.advanceTimersByTimeAsync(3000);

			expect(warnings('Failed to decode property id=p1')).toBe(1);

			connection.read.mockResolvedValueOnce([0, 1]);
			await jest.advanceTimersByTimeAsync(1000);
			await jest.advanceTimersByTimeAsync(1000);

			expect(warnings('Failed to decode property id=p1')).toBe(2);
		});
	});

	describe('non-finite readings', () => {
		let warn: jest.SpyInstance;

		beforeEach(() => {
			warn = jest.spyOn(ExtensionLoggerService.prototype, 'warn').mockImplementation(() => undefined);
		});

		afterEach(() => {
			warn.mockRestore();
		});

		it('reports a NaN float once as null and warns once', async () => {
			// 0x7fc00000 is a quiet NaN.
			connection.read.mockResolvedValue([0x7fc0, 0x0000]);

			create(snapshot([read('p1', { dataType: ModbusDataType.FLOAT32 })])).start();
			await jest.advanceTimersByTimeAsync(0);
			await jest.advanceTimersByTimeAsync(1000);

			expect(connection.read).toHaveBeenCalledTimes(2);
			expect(callbacks.report).toHaveBeenCalledTimes(1);
			expect(callbacks.report).toHaveBeenCalledWith('p1', null, expect.any(Date));
			expect(
				warn.mock.calls.filter(([message]) => String(message).includes('does not decode to a finite number')),
			).toHaveLength(1);
		});
	});

	it('does not keep the process alive with its poll timers', () => {
		const setIntervalSpy = jest.spyOn(global, 'setInterval');

		connection.read.mockResolvedValue([1]);

		create(snapshot([read('p1'), read('p2', { address: 4, pollIntervalMs: 3000 })])).start();

		expect(setIntervalSpy).toHaveBeenCalledTimes(2);

		for (const { value } of setIntervalSpy.mock.results as Array<{ value: NodeJS.Timeout }>) {
			expect(value.hasRef()).toBe(false);
		}

		setIntervalSpy.mockRestore();
	});

	it('leaves no timers behind after stop', () => {
		connection.read.mockResolvedValue([1]);

		create(snapshot([read('p1'), read('p2', { address: 4, pollIntervalMs: 3000 })])).start();
		poller?.stop();

		expect(jest.getTimerCount()).toBe(0);
	});
});
