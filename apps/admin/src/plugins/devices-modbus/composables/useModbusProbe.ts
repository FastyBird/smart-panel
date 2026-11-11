import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, snakeToCamel, useBackend } from '../../../common';
import type {
	DevicesModbusPluginByteOrder,
	DevicesModbusPluginFraming,
	DevicesModbusPluginProbeReadRequestSchema,
	DevicesModbusPluginRegisterType,
} from '../../../openapi.constants';
import { DEVICES_MODBUS_PLUGIN_PREFIX, MODBUS_PROBE_MAX_POINTS } from '../devices-modbus.constants';
import { type ModbusPointBinding, toRequestBinding } from '../lib/points';

const BASE = `/${PLUGINS_PREFIX}/${DEVICES_MODBUS_PLUGIN_PREFIX}/probe` as const;

/** A saved endpoint, or the connection details of one that is not saved yet (wire format, snake_case). */
export type ModbusProbeTarget =
	| { endpoint_id: string }
	| {
			host: string;
			port: number;
			framing: DevicesModbusPluginFraming;
			connect_timeout_ms: number;
			request_timeout_ms: number;
	  };

export interface IModbusProbeError {
	/**
	 * Backend kinds (timeout, connection, unavailable, exception, encode) plus `busy` (the single-flight 429), `rate_limited`
	 * (the throttler's 429) and `request` (any other HTTP or network failure).
	 */
	kind: string;
	exceptionCode: number | null;
	message: string;
}

export interface IModbusProbeReadResult {
	ok: boolean;
	values: (number | boolean)[] | null;
	error: IModbusProbeError | null;
	durationMs: number;
}

export interface IModbusProbePointResult {
	key: string;
	raw: (number | boolean)[] | null;
	value: string | number | boolean | null;
	error: IModbusProbeError | null;
}

export interface IModbusProbePointsResult {
	ok: boolean;
	points: IModbusProbePointResult[];
	error: IModbusProbeError | null;
	durationMs: number;
}

export interface IModbusProbeWriteResult {
	ok: boolean;
	error: IModbusProbeError | null;
	durationMs: number;
}

export interface IModbusProbeOrders {
	byteOrder: DevicesModbusPluginByteOrder;
	wordOrder: DevicesModbusPluginByteOrder;
}

/** Read batching limits; a null or missing value leaves the backend default in place. */
export interface IModbusProbeReadLimits {
	maxReadRegisters?: number | null;
	maxReadBits?: number | null;
	maxReadGap?: number | null;
}

export interface IModbusProbePointInput {
	key: string;
	read: ModbusPointBinding;
}

export interface IUseModbusProbe {
	read: (
		target: ModbusProbeTarget,
		unitId: number,
		registerType: DevicesModbusPluginRegisterType,
		address: number,
		count: number
	) => Promise<IModbusProbeReadResult>;
	readPoints: (
		target: ModbusProbeTarget,
		unitId: number,
		points: IModbusProbePointInput[],
		orders: IModbusProbeOrders,
		limits?: IModbusProbeReadLimits
	) => Promise<IModbusProbePointsResult>;
	write: (
		target: ModbusProbeTarget,
		unitId: number,
		binding: ModbusPointBinding,
		value: string | number | boolean,
		orders: IModbusProbeOrders
	) => Promise<IModbusProbeWriteResult>;
}

const BUSY_MESSAGE = 'Another probe to this endpoint is still running.';
const RATE_LIMITED_MESSAGE = 'Too many probe requests.';

const failure = (kind: string, message: string): { ok: false; error: IModbusProbeError; durationMs: number } => ({
	ok: false,
	error: { kind, exceptionCode: null, message },
	durationMs: 0,
});

export const useModbusProbe = (): IUseModbusProbe => {
	const backend = useBackend();

	// Posts a probe. A valid request always answers 200 with the outcome in the body; a 429 means another probe
	// to the same target is running, any other HTTP failure means the request itself was refused.
	const post = async <T>(
		path: string,
		data: Record<string, unknown>,
		fallback: string,
		onFailure: (kind: string, message: string) => T
	): Promise<T> => {
		let outcome: { data?: { data: unknown }; error?: unknown; response: Response };

		try {
			outcome = await (
				backend.client.POST as unknown as (
					path: string,
					options: { body: unknown }
				) => Promise<{ data?: { data: unknown }; error?: unknown; response: Response }>
			)(`${BASE}/${path}`, { body: { data } });
		} catch (caught: unknown) {
			// A network failure must not escape: an unhandled rejection would leave the caller without a result.
			return onFailure('request', caught instanceof Error && caught.message !== '' ? caught.message : fallback);
		}

		const { data: responseData, error, response } = outcome;

		if (responseData) {
			return snakeToCamel(responseData.data as Record<string, unknown>) as T;
		}

		if (response.status === 429) {
			// The single-flight guard names itself in the body; any other 429 comes from the rate limiter.
			return JSON.stringify(error ?? '').includes(BUSY_MESSAGE) ? onFailure('busy', BUSY_MESSAGE) : onFailure('rate_limited', RATE_LIMITED_MESSAGE);
		}

		return onFailure('request', getErrorReason(error as never, fallback));
	};

	const read: IUseModbusProbe['read'] = (target, unitId, registerType, address, count) =>
		post<IModbusProbeReadResult>(
			'read',
			{ ...target, unit_id: unitId, register_type: registerType, address, count } satisfies Partial<DevicesModbusPluginProbeReadRequestSchema>,
			'The probe request failed.',
			(kind, message) => ({ ...failure(kind, message), values: null })
		);

	const readBatch: IUseModbusProbe['readPoints'] = (target, unitId, points, orders, limits) =>
		post<IModbusProbePointsResult>(
			'points',
			{
				...target,
				unit_id: unitId,
				byte_order: orders.byteOrder,
				word_order: orders.wordOrder,
				...(limits?.maxReadRegisters != null ? { max_read_registers: limits.maxReadRegisters } : {}),
				...(limits?.maxReadBits != null ? { max_read_bits: limits.maxReadBits } : {}),
				...(limits?.maxReadGap != null ? { max_read_gap: limits.maxReadGap } : {}),
				points: points.map((point) => ({ key: point.key, binding: toRequestBinding(point.read) })),
			},
			'The probe request failed.',
			(kind, message) => ({ ...failure(kind, message), points: [] })
		);

	// The backend reads at most MODBUS_PROBE_MAX_POINTS points per request, and a template can define more. Batches
	// run one after another (the backend allows one probe per target at a time) and stop at the first batch that fails
	// as a whole; points of the batches not read get no result.
	const readPoints: IUseModbusProbe['readPoints'] = async (target, unitId, points, orders, limits) => {
		if (points.length <= MODBUS_PROBE_MAX_POINTS) {
			return readBatch(target, unitId, points, orders, limits);
		}

		const combined: IModbusProbePointsResult = { ok: false, points: [], error: null, durationMs: 0 };

		for (let start = 0; start < points.length; start += MODBUS_PROBE_MAX_POINTS) {
			const result = await readBatch(target, unitId, points.slice(start, start + MODBUS_PROBE_MAX_POINTS), orders, limits);

			combined.ok ||= result.ok;
			combined.points.push(...result.points);
			combined.durationMs += result.durationMs;

			if (result.error !== null) {
				combined.error = result.error;

				break;
			}
		}

		return combined;
	};

	const write: IUseModbusProbe['write'] = (target, unitId, binding, value, orders) =>
		post<IModbusProbeWriteResult>(
			'write',
			{ ...target, unit_id: unitId, binding: toRequestBinding(binding), value, byte_order: orders.byteOrder, word_order: orders.wordOrder },
			'The probe request failed.',
			failure
		);

	return { read, readPoints, write };
};
