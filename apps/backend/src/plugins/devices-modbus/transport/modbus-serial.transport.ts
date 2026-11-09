import ModbusRTU from 'modbus-serial';
import { Socket } from 'net';

import { createExtensionLogger } from '../../../common/logger';
import {
	DEVICES_MODBUS_PLUGIN_NAME,
	ModbusFraming,
	ModbusRegisterType,
	ModbusWriteFunction,
} from '../devices-modbus.constants';
import { ModbusConnectionError, ModbusExceptionError, ModbusTimeoutError } from '../lib/errors';

import { ModbusReadRequest, ModbusTransport, ModbusTransportOptions, ModbusWriteRequest } from './modbus-transport';
import { telnetReceiveBuffer } from './telnet-receive-buffer';

type LibraryCallback<T> = (error: unknown, result: T) => void;

interface PendingRequest {
	reject: (error: Error) => void;
}

/**
 * `modbus-serial` adapter, used only for framing.
 *
 * - We own the `net.Socket`: we connect it (with our own connect timeout) and hand it to the library with `linkTCP`
 *   (Modbus TCP, MBAP header) or `linkTelnet` (raw RTU frames with CRC, no header). The library's
 *   `connectTcpRTUBuffered` is not used: despite its name it speaks MBAP-framed Modbus TCP.
 * - Owning the socket gives a reliable close signal; the library's own `close` event is skipped when a socket error
 *   precedes the close, and it never rejects the requests still waiting for an answer, so we track and reject them.
 * - Requests go through the `writeFC*` callback API, which takes the unit ID as an argument, so no shared `setID`
 *   state can be changed by a concurrent request in between.
 * - On `rtu_over_tcp` every byte still buffered when a request is sent is discarded first (see
 *   `telnetReceiveBuffer`): a duplicated or late reply would otherwise be taken as the answer to the next request.
 */
class ModbusSerialTransport implements ModbusTransport {
	private readonly logger = createExtensionLogger(DEVICES_MODBUS_PLUGIN_NAME, 'ModbusSerialTransport');

	private client: ModbusRTU | null = null;
	/** Receive buffer of the RTU-over-TCP port; `null` on `tcp` framing, whose MBAP header carries a transaction ID. */
	private rtuReceiveBuffer: { discard(): number } | null = null;
	private socket: Socket | null = null;
	private connecting: Promise<void> | null = null;
	private abortConnect: ((error: Error) => Promise<void>) | null = null;
	private readonly pending = new Set<PendingRequest>();
	private readonly closeListeners: ((error?: Error) => void)[] = [];

	constructor(private readonly options: ModbusTransportOptions) {}

	connect(): Promise<void> {
		if (this.connecting !== null) {
			return this.connecting;
		}

		if (this.isOpen()) {
			return Promise.resolve();
		}

		const { host, port, connectTimeoutMs } = this.options;
		const socket = new Socket();

		const attempt = new Promise<void>((resolve, reject) => {
			const cleanup = (): void => {
				clearTimeout(timer);
				socket.removeListener('error', onError);
				socket.removeListener('connect', onConnect);
				this.abortConnect = null;
			};

			const fail = (error: Error): Promise<void> => {
				cleanup();
				reject(error);

				return destroySocket(socket);
			};

			const onError = (error: Error): void => {
				void fail(
					new ModbusConnectionError(`Failed to connect to ${host}:${port}: ${error.message}`, { cause: error }),
				);
			};

			const onConnect = (): void => {
				cleanup();

				try {
					this.attach(socket);
					resolve();
				} catch (error) {
					socket.destroy();
					reject(toModbusError(error));
				}
			};

			const timer = setTimeout(() => {
				void fail(new ModbusConnectionError(`Connecting to ${host}:${port} timed out after ${connectTimeoutMs} ms`));
			}, connectTimeoutMs);

			this.abortConnect = fail;

			socket.once('error', onError);
			socket.once('connect', onConnect);

			try {
				socket.connect({ host, port });
			} catch (error) {
				// e.g. ERR_SOCKET_BAD_PORT is thrown synchronously, not emitted
				onError(toError(error));
			}
		});

		this.connecting = attempt.finally(() => {
			this.connecting = null;
		});

		return this.connecting;
	}

	async close(): Promise<void> {
		if (this.abortConnect) {
			await this.abortConnect(new ModbusConnectionError('Connection closed before it was established'));

			return;
		}

		const socket = this.socket;

		if (!socket) {
			return;
		}

		// The close handler registered in attach() runs first: it rejects pending requests and notifies listeners.
		await destroySocket(socket);
	}

	isOpen(): boolean {
		return this.socket !== null && this.client !== null && this.connecting === null;
	}

	onClose(listener: (error?: Error) => void): void {
		this.closeListeners.push(listener);
	}

	async read(request: ModbusReadRequest): Promise<boolean[] | number[]> {
		const { unitId, registerType, address, count } = request;

		const result = await this.request<{ data: boolean[] | number[] }>((client, callback) => {
			switch (registerType) {
				case ModbusRegisterType.COIL:
					return client.writeFC1(unitId, address, count, callback);
				case ModbusRegisterType.DISCRETE_INPUT:
					return client.writeFC2(unitId, address, count, callback);
				case ModbusRegisterType.HOLDING_REGISTER:
					return client.writeFC3(unitId, address, count, callback);
				case ModbusRegisterType.INPUT_REGISTER:
					return client.writeFC4(unitId, address, count, callback);
				default:
					throw new RangeError(`Unsupported register type for read: ${String(registerType)}`);
			}
		});

		// Bit reads are decoded a whole byte at a time, so the library pads them to a multiple of 8.
		return result.data.slice(0, count);
	}

	async write(request: ModbusWriteRequest): Promise<void> {
		const { unitId, registerType, address, values, writeFunction } = request;

		if (values.length === 0) {
			throw new RangeError('A Modbus write needs at least one value');
		}

		if (writeFunction === ModbusWriteFunction.SINGLE && values.length !== 1) {
			throw new RangeError(`A single Modbus write takes exactly one value, got ${values.length}`);
		}

		const single = writeFunction === ModbusWriteFunction.SINGLE;

		if (registerType === ModbusRegisterType.COIL) {
			if (!values.every((value) => typeof value === 'boolean')) {
				throw new RangeError('Coil writes take boolean values');
			}

			await this.request((client, callback) =>
				single
					? client.writeFC5(unitId, address, values[0], callback)
					: client.writeFC15(unitId, address, values, callback),
			);

			return;
		}

		if (registerType === ModbusRegisterType.HOLDING_REGISTER) {
			if (!values.every((value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 0xffff)) {
				throw new RangeError('Register writes take integer values between 0 and 65535');
			}

			const words = values as number[];

			await this.request((client, callback) =>
				single
					? client.writeFC6(unitId, address, words[0], callback)
					: client.writeFC16(unitId, address, words, callback),
			);

			return;
		}

		throw new RangeError(`Unsupported register type for write: ${String(registerType)}`);
	}

	private attach(socket: Socket): void {
		const client = new ModbusRTU();
		let socketError: Error | undefined;

		// Both link* calls complete synchronously for an already connected socket; the promise form is not needed.
		const linked = (error?: Error): void => {
			if (error) {
				throw error;
			}
		};

		let rtuReceiveBuffer: { discard(): number } | null = null;

		if (this.options.framing === ModbusFraming.RTU_OVER_TCP) {
			client.linkTelnet(socket, {}, linked);
			rtuReceiveBuffer = telnetReceiveBuffer(client);
		} else {
			client.linkTCP(socket, { port: this.options.port }, linked);
		}

		// The library has no default request timeout. Set after linking so it does not become a socket idle timeout.
		client.setTimeout(this.options.requestTimeoutMs);
		// The library re-emits port errors as `error` events; an unhandled one would crash the process.
		client.on('error', (error) => {
			socketError = toError(error);
		});

		socket.setNoDelay(true);
		socket.on('error', (error) => {
			socketError = error;
		});
		socket.once('close', () => this.handleClosed(socket, client, socketError));

		this.socket = socket;
		this.client = client;
		this.rtuReceiveBuffer = rtuReceiveBuffer;
	}

	private handleClosed(socket: Socket, client: ModbusRTU, error?: Error): void {
		if (this.socket !== socket) {
			return;
		}

		this.socket = null;
		this.client = null;
		this.rtuReceiveBuffer = null;

		// Cancels the library's request timers; their callbacks would otherwise fire long after the socket is gone.
		client.destroy(() => undefined);

		const closed = new ModbusConnectionError(
			error ? `Modbus connection closed: ${error.message}` : 'Modbus connection closed',
			error ? { cause: error } : undefined,
		);

		for (const request of [...this.pending]) {
			request.reject(closed);
		}

		for (const listener of this.closeListeners) {
			listener(error);
		}
	}

	private request<T>(issue: (client: ModbusRTU, callback: LibraryCallback<T>) => void): Promise<T> {
		const client = this.client;

		if (!client || !this.isOpen()) {
			return Promise.reject(new ModbusConnectionError('Modbus transport is not connected'));
		}

		// RTU frames carry no transaction ID; the library's telnet port tracks a single expected answer.
		if (this.options.framing === ModbusFraming.RTU_OVER_TCP && this.pending.size > 0) {
			return Promise.reject(new Error('RTU over TCP carries one request at a time; serialise requests'));
		}

		const stale = this.rtuReceiveBuffer?.discard() ?? 0;

		if (stale > 0) {
			this.logger.debug(
				`Discarded ${stale} unsolicited byte(s) from ${this.options.host}:${this.options.port} before an RTU request`,
			);
		}

		return new Promise<T>((resolve, reject) => {
			let settled = false;

			const settle = (finish: () => void): void => {
				if (settled) {
					return;
				}

				settled = true;
				this.pending.delete(entry);
				finish();
			};

			const entry: PendingRequest = { reject: (error) => settle(() => reject(error)) };

			this.pending.add(entry);

			try {
				issue(client, (error, result) => {
					if (error) {
						settle(() => reject(toModbusError(error)));
					} else {
						settle(() => resolve(result));
					}
				});
			} catch (error) {
				settle(() => reject(toModbusError(error)));
			}
		});
	}
}

const destroySocket = (socket: Socket): Promise<void> => {
	if (socket.closed) {
		return Promise.resolve();
	}

	return new Promise<void>((resolve) => {
		socket.once('close', () => resolve());
		socket.destroy();
	});
};

const toError = (error: unknown): Error => {
	if (error instanceof Error) {
		return error;
	}

	const message = (error as { message?: unknown } | null)?.message;

	return new Error(typeof message === 'string' ? message : 'Unknown Modbus library error');
};

/**
 * Library errors are not always `Error` instances (its timeout error is a plain object), so they are matched by shape:
 * `modbusCode` for exception responses, `errno: 'ETIMEDOUT'` / "Timed out" for request timeouts. Programming errors
 * (`RangeError`, `TypeError`, e.g. a unit ID out of range) pass through; everything else is a broken connection.
 */
const toModbusError = (error: unknown): Error => {
	if (
		error instanceof ModbusExceptionError ||
		error instanceof ModbusTimeoutError ||
		error instanceof ModbusConnectionError ||
		error instanceof RangeError ||
		error instanceof TypeError
	) {
		return error;
	}

	const shape = (error ?? {}) as { modbusCode?: unknown; errno?: unknown; message?: unknown };

	if (typeof shape.modbusCode === 'number') {
		return new ModbusExceptionError(shape.modbusCode);
	}

	if (shape.errno === 'ETIMEDOUT' || shape.message === 'Timed out') {
		return new ModbusTimeoutError();
	}

	const cause = toError(error);

	return new ModbusConnectionError(`Modbus request failed: ${cause.message}`, { cause });
};

export function createModbusSerialTransport(options: ModbusTransportOptions): ModbusTransport {
	return new ModbusSerialTransport(options);
}
