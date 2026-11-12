import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	DevicesModbusPluginByteOrder,
	DevicesModbusPluginDataType,
	DevicesModbusPluginFraming,
	DevicesModbusPluginRegisterType,
} from '../../../openapi.constants';
import type { ModbusPointBinding } from '../lib/points';

import { useModbusProbe } from './useModbusProbe';

const post = vi.fn();

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { POST: post } }),
		getErrorReason: (_error: unknown, fallback: string) => fallback,
	};
});

const readOk = {
	data: {
		data: { ok: true, values: [10, 11], error: null, duration_ms: 12.5 },
	},
	response: { status: 200 },
};

const coil = (address: number): ModbusPointBinding => ({
	registerType: DevicesModbusPluginRegisterType.coil,
	address,
	dataType: DevicesModbusPluginDataType.bool,
	bit: null,
	byteOrder: null,
	wordOrder: null,
	scale: 1,
	offset: 0,
	invert: false,
	valueMap: null,
	writeFunction: null,
	pollIntervalMs: null,
	longPressMs: null,
});

const orders = { byteOrder: DevicesModbusPluginByteOrder.big, wordOrder: DevicesModbusPluginByteOrder.big };

describe('useModbusProbe', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('maps the single-flight 429 to a busy result', async () => {
		post.mockResolvedValue({
			data: undefined,
			error: { error: { message: 'Another probe to this endpoint is still running.' } },
			response: { status: 429 },
		});

		const result = await useModbusProbe().read({ endpoint_id: 'e1' }, 1, DevicesModbusPluginRegisterType.holding_register, 0, 1);

		expect(result.ok).toBe(false);
		expect(result.error?.kind).toBe('busy');
	});

	it('maps the throttler 429 to a rate_limited result', async () => {
		post.mockResolvedValue({ data: undefined, error: { message: 'ThrottlerException: Too Many Requests' }, response: { status: 429 } });

		const result = await useModbusProbe().read({ endpoint_id: 'e1' }, 1, DevicesModbusPluginRegisterType.holding_register, 0, 1);

		expect(result.error?.kind).toBe('rate_limited');
	});

	it('maps a network error during a write to a failed request result', async () => {
		post.mockRejectedValue(new Error('Network down'));

		const binding = {
			registerType: DevicesModbusPluginRegisterType.coil,
			address: 1,
			dataType: DevicesModbusPluginDataType.bool,
			bit: null,
			byteOrder: null,
			wordOrder: null,
			scale: 1,
			offset: 0,
			invert: false,
			valueMap: null,
			writeFunction: null,
			pollIntervalMs: null,
			longPressMs: null,
		} satisfies ModbusPointBinding;

		const result = await useModbusProbe().write({ endpoint_id: 'e1' }, 1, binding, true, {
			byteOrder: DevicesModbusPluginByteOrder.big,
			wordOrder: DevicesModbusPluginByteOrder.big,
		});

		expect(result).toMatchObject({ ok: false, error: { kind: 'request', message: 'Network down' } });
	});

	it('passes the read limits to the points probe only when set', async () => {
		post.mockResolvedValue({ data: { data: { ok: true, points: [], error: null, duration_ms: 1 } }, response: { status: 200 } });

		await useModbusProbe().readPoints(
			{ endpoint_id: 'e1' },
			1,
			[],
			{ byteOrder: DevicesModbusPluginByteOrder.big, wordOrder: DevicesModbusPluginByteOrder.big },
			{ maxReadRegisters: 60, maxReadBits: null, maxReadGap: 0 }
		);

		const body = post.mock.calls[0][1].body.data;

		expect(body).toMatchObject({ max_read_registers: 60, max_read_gap: 0 });
		expect(body).not.toHaveProperty('max_read_bits');
	});

	it('sends endpoint_id for a saved endpoint and details for an unsaved one', async () => {
		post.mockResolvedValue(readOk);

		const probe = useModbusProbe();

		await probe.read({ endpoint_id: 'e1' }, 3, DevicesModbusPluginRegisterType.holding_register, 7, 2);

		expect(post).toHaveBeenLastCalledWith('/plugins/devices-modbus/probe/read', {
			body: { data: { endpoint_id: 'e1', unit_id: 3, register_type: 'holding_register', address: 7, count: 2 } },
		});

		const unsaved = {
			host: '10.0.0.5',
			port: 502,
			framing: DevicesModbusPluginFraming.tcp,
			connect_timeout_ms: 2000,
			request_timeout_ms: 1000,
		};

		await probe.read(unsaved, 1, DevicesModbusPluginRegisterType.coil, 0, 1);

		expect(post).toHaveBeenLastCalledWith('/plugins/devices-modbus/probe/read', {
			body: { data: { ...unsaved, unit_id: 1, register_type: 'coil', address: 0, count: 1 } },
		});
	});

	it('camel-cases the result', async () => {
		post.mockResolvedValue({
			data: {
				data: { ok: false, values: null, error: { kind: 'exception', exception_code: 2, message: 'Illegal data address' }, duration_ms: 4 },
			},
			response: { status: 200 },
		});

		const result = await useModbusProbe().read({ endpoint_id: 'e1' }, 1, DevicesModbusPluginRegisterType.holding_register, 0, 1);

		expect(result).toEqual({
			ok: false,
			values: null,
			error: { kind: 'exception', exceptionCode: 2, message: 'Illegal data address' },
			durationMs: 4,
		});
	});

	it('turns other HTTP failures into a failed result', async () => {
		post.mockResolvedValue({ data: undefined, error: {}, response: { status: 400 } });

		const result = await useModbusProbe().read({ endpoint_id: 'e1' }, 1, DevicesModbusPluginRegisterType.holding_register, 0, 1);

		expect(result.ok).toBe(false);
		expect(result.error?.kind).toBe('request');
	});

	it('sends points with their bindings and the device orders', async () => {
		post.mockResolvedValue({
			data: {
				data: { ok: true, points: [{ key: 'k1', raw: [1], value: 1, error: null }], error: null, duration_ms: 3 },
			},
			response: { status: 200 },
		});

		const binding: ModbusPointBinding = {
			registerType: DevicesModbusPluginRegisterType.holding_register,
			address: 4,
			dataType: DevicesModbusPluginDataType.uint16,
			bit: null,
			byteOrder: null,
			wordOrder: null,
			scale: 1,
			offset: 0,
			invert: false,
			valueMap: null,
			writeFunction: null,
			pollIntervalMs: null,
			longPressMs: null,
		};

		const result = await useModbusProbe().readPoints({ endpoint_id: 'e1' }, 1, [{ key: 'k1', read: binding }], {
			byteOrder: DevicesModbusPluginByteOrder.big,
			wordOrder: DevicesModbusPluginByteOrder.little,
		});

		expect(post).toHaveBeenLastCalledWith('/plugins/devices-modbus/probe/points', {
			body: {
				data: {
					endpoint_id: 'e1',
					unit_id: 1,
					byte_order: 'big',
					word_order: 'little',
					points: [{ key: 'k1', binding: { register_type: 'holding_register', address: 4, data_type: 'uint16' } }],
				},
			},
		});
		expect(result.points[0]).toEqual({ key: 'k1', raw: [1], value: 1, error: null });
	});

	it('splits more than 256 points into batches and combines their results', async () => {
		post.mockImplementation((_path: string, options: { body: { data: { points: { key: string }[] } } }) =>
			Promise.resolve({
				data: {
					data: {
						ok: true,
						points: options.body.data.points.map((point) => ({ key: point.key, raw: [1], value: 1, error: null })),
						error: null,
						duration_ms: 2,
					},
				},
				response: { status: 200 },
			})
		);

		const points = Array.from({ length: 300 }, (_, index) => ({ key: `p${index}`, read: coil(index) }));
		const result = await useModbusProbe().readPoints({ endpoint_id: 'e1' }, 1, points, orders);

		expect(post).toHaveBeenCalledTimes(2);
		expect(post.mock.calls.map((call) => call[1].body.data.points.length)).toEqual([256, 44]);
		expect(result.points.map((point) => point.key)).toEqual(points.map((point) => point.key));
		expect(result).toMatchObject({ ok: true, error: null, durationMs: 4 });
	});

	it('stops at the first batch that fails as a whole', async () => {
		post.mockResolvedValueOnce({
			data: { data: { ok: false, points: [], error: { kind: 'timeout', exception_code: null, message: 'x' }, duration_ms: 1 } },
			response: { status: 200 },
		});

		const points = Array.from({ length: 300 }, (_, index) => ({ key: `p${index}`, read: coil(index) }));
		const result = await useModbusProbe().readPoints({ endpoint_id: 'e1' }, 1, points, orders);

		expect(post).toHaveBeenCalledTimes(1);
		expect(result).toMatchObject({ ok: false, error: { kind: 'timeout' } });
	});

	it('sends a write with the binding and the confirmed value', async () => {
		post.mockResolvedValue({ data: { data: { ok: true, error: null, duration_ms: 2 } }, response: { status: 200 } });

		const binding: ModbusPointBinding = {
			registerType: DevicesModbusPluginRegisterType.coil,
			address: 1,
			dataType: DevicesModbusPluginDataType.bool,
			bit: null,
			byteOrder: null,
			wordOrder: null,
			scale: 1,
			offset: 0,
			invert: false,
			valueMap: null,
			writeFunction: null,
			pollIntervalMs: null,
			longPressMs: null,
		};

		const result = await useModbusProbe().write({ endpoint_id: 'e1' }, 2, binding, true, {
			byteOrder: DevicesModbusPluginByteOrder.big,
			wordOrder: DevicesModbusPluginByteOrder.big,
		});

		expect(post).toHaveBeenLastCalledWith('/plugins/devices-modbus/probe/write', {
			body: {
				data: {
					endpoint_id: 'e1',
					unit_id: 2,
					binding: { register_type: 'coil', address: 1, data_type: 'bool' },
					value: true,
					byte_order: 'big',
					word_order: 'big',
				},
			},
		});
		expect(result).toEqual({ ok: true, error: null, durationMs: 2 });
	});
});
