import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, snakeToCamel, useBackend } from '../../../common';
import type {
	DevicesModbusPluginByteOrder,
	DevicesModbusPluginFraming,
	DevicesModbusPluginProbeReadRequestSchema,
	DevicesModbusPluginRegisterType,
} from '../../../openapi.constants';
import { DEVICES_MODBUS_PLUGIN_PREFIX } from '../devices-modbus.constants';
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
	/** Backend kinds (timeout, connection, unavailable, exception, encode) plus `busy` (HTTP 429) and `request` (any other HTTP failure). */
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
		orders: IModbusProbeOrders
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
		const {
			data: responseData,
			error,
			response,
		} = await (
			backend.client.POST as unknown as (
				path: string,
				options: { body: unknown }
			) => Promise<{ data?: { data: unknown }; error?: unknown; response: Response }>
		)(`${BASE}/${path}`, { body: { data } });

		if (responseData) {
			return snakeToCamel(responseData.data as Record<string, unknown>) as T;
		}

		if (response.status === 429) {
			return onFailure('busy', BUSY_MESSAGE);
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

	const readPoints: IUseModbusProbe['readPoints'] = (target, unitId, points, orders) =>
		post<IModbusProbePointsResult>(
			'points',
			{
				...target,
				unit_id: unitId,
				byte_order: orders.byteOrder,
				word_order: orders.wordOrder,
				points: points.map((point) => ({ key: point.key, binding: toRequestBinding(point.read) })),
			},
			'The probe request failed.',
			(kind, message) => ({ ...failure(kind, message), points: [] })
		);

	const write: IUseModbusProbe['write'] = (target, unitId, binding, value, orders) =>
		post<IModbusProbeWriteResult>(
			'write',
			{ ...target, unit_id: unitId, binding: toRequestBinding(binding), value, byte_order: orders.byteOrder, word_order: orders.wordOrder },
			'The probe request failed.',
			failure
		);

	return { read, readPoints, write };
};
