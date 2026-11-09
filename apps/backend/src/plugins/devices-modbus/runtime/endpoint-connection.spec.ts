import { ModbusFraming, ModbusRegisterType, ModbusWriteFunction } from '../devices-modbus.constants';
import {
	ModbusConnectionError,
	ModbusEndpointUnavailableError,
	ModbusExceptionError,
	ModbusTimeoutError,
} from '../lib/errors';
import { ModbusReadRequest, ModbusTransport, ModbusWriteRequest } from '../transport/modbus-transport';

import { EndpointConnection, EndpointConnectionConfig, EndpointConnectionState } from './endpoint-connection';

type ConnectMode = 'succeed' | 'fail' | 'manual';

interface SentRequest {
	kind: 'read' | 'write';
	address: number;
	resolve: (value: boolean[] | number[]) => void;
	reject: (error: Error) => void;
	settled: boolean;
}

class FakeTransport implements ModbusTransport {
	readonly sent: SentRequest[] = [];
	connectCalls = 0;
	closeCalls = 0;
	private open = false;
	private connectHandlers: { resolve: () => void; reject: (error: Error) => void } | null = null;
	private readonly listeners: ((error?: Error) => void)[] = [];

	constructor(private readonly connectMode: ConnectMode) {}

	connect(): Promise<void> {
		this.connectCalls++;

		if (this.connectMode === 'succeed') {
			this.open = true;

			return Promise.resolve();
		}

		if (this.connectMode === 'fail') {
			return Promise.reject(new ModbusConnectionError('Connection refused'));
		}

		return new Promise<void>((resolve, reject) => {
			this.connectHandlers = {
				resolve: () => {
					this.open = true;
					resolve();
				},
				reject,
			};
		});
	}

	resolveConnect(): void {
		this.connectHandlers?.resolve();
	}

	rejectConnect(error: Error = new ModbusConnectionError('Connection refused')): void {
		this.connectHandlers?.reject(error);
	}

	close(): Promise<void> {
		this.closeCalls++;

		if (this.open) {
			this.drop();
		}

		return Promise.resolve();
	}

	isOpen(): boolean {
		return this.open;
	}

	read(request: ModbusReadRequest): Promise<boolean[] | number[]> {
		return this.push('read', request.address);
	}

	write(request: ModbusWriteRequest): Promise<void> {
		return this.push('write', request.address).then(() => undefined);
	}

	onClose(listener: (error?: Error) => void): void {
		this.listeners.push(listener);
	}

	/** Remote side closes the socket. */
	remoteClose(error?: Error): void {
		this.drop(error);
	}

	/** Fire close listeners regardless of state (a late callback from a replaced transport). */
	emitClose(error?: Error): void {
		for (const listener of this.listeners) {
			listener(error);
		}
	}

	addresses(): number[] {
		return this.sent.map((request) => request.address);
	}

	outstanding(): SentRequest[] {
		return this.sent.filter((request) => !request.settled);
	}

	private drop(error?: Error): void {
		this.open = false;

		for (const request of this.outstanding()) {
			request.reject(new ModbusConnectionError('Modbus connection closed'));
		}

		this.emitClose(error);
	}

	private push(kind: 'read' | 'write', address: number): Promise<boolean[] | number[]> {
		return new Promise((resolve, reject) => {
			const entry: SentRequest = {
				kind,
				address,
				settled: false,
				resolve: (value) => {
					entry.settled = true;
					resolve(value);
				},
				reject: (error) => {
					entry.settled = true;
					reject(error);
				},
			};

			this.sent.push(entry);
		});
	}
}

const readRequest = (address: number): ModbusReadRequest => ({
	unitId: 1,
	registerType: ModbusRegisterType.HOLDING_REGISTER,
	address,
	count: 1,
});

const writeRequest = (address: number): ModbusWriteRequest => ({
	unitId: 1,
	registerType: ModbusRegisterType.HOLDING_REGISTER,
	address,
	values: [1],
	writeFunction: ModbusWriteFunction.SINGLE,
});

const flush = async (): Promise<void> => {
	await jest.advanceTimersByTimeAsync(0);
};

/** Attach a no-op catch so a promise rejected before the assertion does not count as unhandled. */
const settle = <T>(promise: Promise<T>): Promise<T> => {
	promise.catch(() => undefined);

	return promise;
};

/** Send one read on the current socket and let the device answer it, proving the link works. */
const answerOnce = async (connection: EndpointConnection, transport: FakeTransport): Promise<void> => {
	const pending = connection.read(readRequest(0));

	await flush();
	transport.outstanding()[0].resolve([0]);
	await pending;
	await flush();
};

describe('EndpointConnection', () => {
	let connections: EndpointConnection[] = [];

	const setup = (
		overrides: Partial<EndpointConnectionConfig> = {},
		random: () => number = () => 0.5,
	): {
		connection: EndpointConnection;
		transports: FakeTransport[];
		modes: ConnectMode[];
		states: EndpointConnectionState[];
	} => {
		const transports: FakeTransport[] = [];
		const modes: ConnectMode[] = [];
		const states: EndpointConnectionState[] = [];

		const connection = new EndpointConnection(
			{
				endpointId: 'endpoint-1',
				framing: ModbusFraming.TCP,
				maxInFlight: 1,
				interRequestDelayMs: 0,
				...overrides,
			},
			() => {
				const transport = new FakeTransport(modes.shift() ?? 'succeed');

				transports.push(transport);

				return transport;
			},
			random,
		);

		connection.onStateChange((state) => states.push(state));
		connections.push(connection);

		return { connection, transports, modes, states };
	};

	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(async () => {
		for (const connection of connections) {
			await connection.stop();
		}

		connections = [];
		jest.useRealTimers();
	});

	it('serialises requests on rtu_over_tcp even when maxInFlight is 4', async () => {
		const { connection, transports } = setup({ framing: ModbusFraming.RTU_OVER_TCP, maxInFlight: 4 });

		connection.start();
		await flush();

		const first = connection.read(readRequest(1));
		const second = connection.read(readRequest(2));

		await flush();

		expect(transports[0].addresses()).toEqual([1]);

		transports[0].sent[0].resolve([11]);
		await flush();

		await expect(first).resolves.toEqual([11]);
		expect(transports[0].addresses()).toEqual([1, 2]);

		transports[0].sent[1].resolve([22]);

		await expect(second).resolves.toEqual([22]);
	});

	it('allows maxInFlight requests on tcp', async () => {
		const { connection, transports } = setup({ maxInFlight: 2 });

		connection.start();
		await flush();

		void settle(connection.read(readRequest(1)));
		void settle(connection.read(readRequest(2)));
		void settle(connection.read(readRequest(3)));
		await flush();

		expect(transports[0].addresses()).toEqual([1, 2]);

		transports[0].sent[0].resolve([1]);
		await flush();

		expect(transports[0].addresses()).toEqual([1, 2, 3]);
	});

	it('puts writes ahead of queued reads', async () => {
		const { connection, transports } = setup();

		connection.start();
		await flush();

		const a = connection.read(readRequest(1));
		const b = connection.read(readRequest(2));
		const c = connection.read(readRequest(3));
		const w = connection.write(writeRequest(100));

		await flush();

		expect(transports[0].addresses()).toEqual([1]);

		for (let index = 0; index < 4; index++) {
			transports[0].sent[index].resolve([0]);
			await flush();
		}

		await expect(Promise.all([a, b, c, w])).resolves.toEqual([[0], [0], [0], undefined]);
		expect(transports[0].addresses()).toEqual([1, 100, 2, 3]);
		expect(transports[0].sent[1].kind).toBe('write');
	});

	it('waits interRequestDelayMs between requests', async () => {
		const { connection, transports } = setup({ interRequestDelayMs: 20 });

		connection.start();
		await flush();

		void settle(connection.read(readRequest(1)));
		void settle(connection.read(readRequest(2)));
		await flush();

		expect(transports[0].addresses()).toEqual([1]);

		transports[0].sent[0].resolve([1]);
		await flush();
		await jest.advanceTimersByTimeAsync(19);

		expect(transports[0].addresses()).toEqual([1]);

		await jest.advanceTimersByTimeAsync(1);

		expect(transports[0].addresses()).toEqual([1, 2]);
	});

	it('resets the socket after a timeout on rtu_over_tcp', async () => {
		const { connection, transports } = setup({ framing: ModbusFraming.RTU_OVER_TCP });

		connection.start();
		await flush();

		const first = settle(connection.read(readRequest(1)));
		const second = connection.read(readRequest(2));

		await flush();

		transports[0].sent[0].reject(new ModbusTimeoutError());
		await flush();

		await expect(first).rejects.toBeInstanceOf(ModbusTimeoutError);
		expect(transports[0].closeCalls).toBe(1);
		expect(transports).toHaveLength(2);
		expect(transports[0].addresses()).toEqual([1]);
		expect(transports[1].addresses()).toEqual([2]);
		expect(connection.getHealth().state).toBe('connected');

		transports[1].sent[0].resolve([2]);

		await expect(second).resolves.toEqual([2]);
	});

	it('resets the socket after three consecutive timeouts on tcp', async () => {
		const { connection, transports } = setup();

		connection.start();
		await flush();

		const timeOut = async (): Promise<void> => {
			const pending = settle(connection.read(readRequest(1)));

			await flush();
			transports[transports.length - 1].outstanding()[0].reject(new ModbusTimeoutError());
			await flush();
			await expect(pending).rejects.toBeInstanceOf(ModbusTimeoutError);
		};

		await timeOut();
		await timeOut();

		expect(transports).toHaveLength(1);

		const success = connection.read(readRequest(2));

		await flush();
		transports[0].outstanding()[0].resolve([2]);
		await expect(success).resolves.toEqual([2]);

		await timeOut();
		await timeOut();

		expect(transports).toHaveLength(1);
		expect(transports[0].closeCalls).toBe(0);

		await timeOut();

		expect(transports[0].closeCalls).toBe(1);
		expect(transports).toHaveLength(2);
		expect(connection.getHealth().state).toBe('connected');
	});

	it('rejects pending requests when the socket closes', async () => {
		const { connection, transports } = setup();

		connection.start();
		await flush();

		const inFlight = settle(connection.read(readRequest(1)));
		const queued = settle(connection.read(readRequest(2)));
		const queuedWrite = settle(connection.write(writeRequest(3)));

		await flush();

		transports[0].remoteClose(new Error('read ECONNRESET'));
		await flush();

		await expect(inFlight).rejects.toBeInstanceOf(ModbusConnectionError);
		await expect(queued).rejects.toBeInstanceOf(ModbusConnectionError);
		await expect(queuedWrite).rejects.toBeInstanceOf(ModbusConnectionError);
		expect(transports[0].addresses()).toEqual([1]);
		expect(connection.getHealth().lastError).toContain('ECONNRESET');
	});

	it('backs off after the socket closes unexpectedly and reconnects', async () => {
		const { connection, transports } = setup();

		connection.start();
		await flush();

		transports[0].remoteClose();
		await flush();

		expect(connection.getHealth().state).toBe('backoff');

		await jest.advanceTimersByTimeAsync(999);

		expect(transports).toHaveLength(1);

		await jest.advanceTimersByTimeAsync(1);

		expect(transports).toHaveLength(2);
		expect(connection.getHealth().state).toBe('connected');
	});

	it('fails fast while in backoff', async () => {
		const { connection, transports, modes } = setup();

		modes.push('fail');
		connection.start();
		await flush();

		expect(connection.getHealth().state).toBe('backoff');

		await expect(connection.read(readRequest(1))).rejects.toBeInstanceOf(ModbusEndpointUnavailableError);
		await expect(connection.write(writeRequest(1))).rejects.toBeInstanceOf(ModbusEndpointUnavailableError);
		expect(transports).toHaveLength(1);
		expect(transports[0].sent).toHaveLength(0);
	});

	it('backs off exponentially with jitter and a 60 s cap', async () => {
		const { connection, transports, modes } = setup();

		modes.push(...Array<ConnectMode>(12).fill('fail'));
		connection.start();
		await flush();

		expect(transports).toHaveLength(1);

		const expected = [1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000];

		for (const [index, delay] of expected.entries()) {
			await jest.advanceTimersByTimeAsync(delay - 1);

			expect(transports).toHaveLength(index + 1);

			await jest.advanceTimersByTimeAsync(1);

			expect(transports).toHaveLength(index + 2);
		}
	});

	it('scales each backoff delay by 0.8 + 0.4 * random()', async () => {
		const low = setup({}, () => 0);

		low.modes.push('fail');
		low.connection.start();
		await flush();
		await jest.advanceTimersByTimeAsync(799);

		expect(low.transports).toHaveLength(1);

		await jest.advanceTimersByTimeAsync(1);

		expect(low.transports).toHaveLength(2);

		const high = setup({}, () => 1);

		high.modes.push('fail');
		high.connection.start();
		await flush();
		await jest.advanceTimersByTimeAsync(1199);

		expect(high.transports).toHaveLength(1);

		await jest.advanceTimersByTimeAsync(1);

		expect(high.transports).toHaveLength(2);
	});

	it('restarts the backoff sequence after the first answer on a socket', async () => {
		const { connection, transports, modes } = setup();

		modes.push('fail', 'fail', 'succeed');
		connection.start();
		await flush();
		await jest.advanceTimersByTimeAsync(1000);
		await jest.advanceTimersByTimeAsync(2000);

		expect(transports).toHaveLength(3);
		expect(connection.getHealth().state).toBe('connected');

		await answerOnce(connection, transports[2]);

		transports[2].remoteClose();
		await flush();
		await jest.advanceTimersByTimeAsync(999);

		expect(transports).toHaveLength(3);

		await jest.advanceTimersByTimeAsync(1);

		expect(transports).toHaveLength(4);
	});

	it('does not restart the backoff sequence on a connect alone', async () => {
		const { connection, transports, modes } = setup();

		modes.push('fail', 'fail', 'succeed');
		connection.start();
		await flush();
		await jest.advanceTimersByTimeAsync(1000);
		await jest.advanceTimersByTimeAsync(2000);

		expect(connection.getHealth().state).toBe('connected');

		transports[2].remoteClose();
		await flush();
		await jest.advanceTimersByTimeAsync(3999);

		expect(transports).toHaveLength(3);

		await jest.advanceTimersByTimeAsync(1);

		expect(transports).toHaveLength(4);
	});

	it('backs off exponentially when a gateway accepts and immediately drops', async () => {
		const { connection, transports } = setup();

		connection.start();
		await flush();

		for (const [index, delay] of [1000, 2000, 4000, 8000, 16000].entries()) {
			expect(connection.getHealth().state).toBe('connected');

			transports[index].remoteClose();
			await flush();

			expect(connection.getHealth().state).toBe('backoff');

			await jest.advanceTimersByTimeAsync(delay - 1);

			expect(transports).toHaveLength(index + 1);

			await jest.advanceTimersByTimeAsync(1);

			expect(transports).toHaveLength(index + 2);
		}
	});

	it('backs off exponentially on connection errors before any answer', async () => {
		const { connection, transports, states } = setup({ framing: ModbusFraming.RTU_OVER_TCP });

		connection.start();
		await flush();

		for (const [index, delay] of [1000, 2000, 4000, 8000].entries()) {
			const failed = settle(connection.read(readRequest(1)));
			const queued = settle(connection.read(readRequest(2)));

			await flush();
			transports[index].sent[0].reject(new ModbusConnectionError('Modbus request failed: CRC error'));
			await flush();

			await expect(failed).rejects.toBeInstanceOf(ModbusConnectionError);
			await expect(queued).rejects.toBeInstanceOf(ModbusEndpointUnavailableError);
			expect(transports[index].closeCalls).toBe(1);
			expect(transports[index].addresses()).toEqual([1]);
			expect(connection.getHealth().state).toBe('backoff');
			await expect(connection.read(readRequest(3))).rejects.toBeInstanceOf(ModbusEndpointUnavailableError);

			await jest.advanceTimersByTimeAsync(delay - 1);

			expect(transports).toHaveLength(index + 1);

			await jest.advanceTimersByTimeAsync(1);

			expect(transports).toHaveLength(index + 2);
		}

		expect(states.filter((state) => state === 'backoff')).toHaveLength(4);
	});

	it('treats a Modbus exception as an answer that proves the link', async () => {
		const { connection, transports, states } = setup();

		connection.start();
		await flush();

		const exception = settle(connection.read(readRequest(1)));

		await flush();
		transports[0].sent[0].reject(new ModbusExceptionError(0x02));
		await expect(exception).rejects.toBeInstanceOf(ModbusExceptionError);

		const failed = settle(connection.read(readRequest(2)));

		await flush();
		transports[0].sent[1].reject(new ModbusConnectionError('Modbus request failed: CRC error'));
		await flush();

		await expect(failed).rejects.toBeInstanceOf(ModbusConnectionError);
		expect(transports).toHaveLength(2);
		expect(states).not.toContain('backoff');
		expect(connection.getHealth().state).toBe('connected');
	});

	it('waits interRequestDelayMs before the first request on a socket opened by a reset', async () => {
		const { connection, transports } = setup({ framing: ModbusFraming.RTU_OVER_TCP, interRequestDelayMs: 20 });

		connection.start();
		await flush();

		void settle(connection.read(readRequest(1)));
		void settle(connection.read(readRequest(2)));
		await flush();

		transports[0].sent[0].reject(new ModbusTimeoutError());
		await flush();

		expect(transports).toHaveLength(2);
		expect(connection.getHealth().state).toBe('connected');
		expect(transports[1].sent).toHaveLength(0);

		await jest.advanceTimersByTimeAsync(19);

		expect(transports[1].sent).toHaveLength(0);

		await jest.advanceTimersByTimeAsync(1);

		expect(transports[1].addresses()).toEqual([2]);
	});

	it('sends at once on the first socket after start', async () => {
		const { connection, transports } = setup({ framing: ModbusFraming.RTU_OVER_TCP, interRequestDelayMs: 20 });

		connection.start();
		await flush();

		void settle(connection.read(readRequest(1)));
		await flush();

		expect(transports[0].addresses()).toEqual([1]);
	});

	it('reports health', async () => {
		const { connection, transports } = setup();

		connection.start();
		await flush();

		const ok = connection.read(readRequest(1));

		await flush();
		await jest.advanceTimersByTimeAsync(30);
		transports[0].sent[0].resolve([1]);
		await ok;

		const failed = settle(connection.read(readRequest(2)));

		await flush();
		transports[0].sent[1].reject(new ModbusTimeoutError());
		await expect(failed).rejects.toBeInstanceOf(ModbusTimeoutError);

		const { lastErrorAt, ...health } = connection.getHealth();

		expect(health).toEqual({
			state: 'connected',
			lastError: 'Modbus request timed out',
			averageLatencyMs: 30,
			requests: 2,
			timeouts: 1,
			overloaded: false,
		});
		expect(lastErrorAt).toBeInstanceOf(Date);
	});

	it('sets the overloaded flag on request', () => {
		const { connection } = setup();

		connection.markOverloaded(true);

		expect(connection.getHealth().overloaded).toBe(true);

		connection.markOverloaded(false);

		expect(connection.getHealth().overloaded).toBe(false);
	});

	it('does not reset the socket on a Modbus exception and counts it as an answer', async () => {
		const { connection, transports } = setup();

		connection.start();
		await flush();

		const answer = async (error: Error): Promise<void> => {
			const pending = settle(connection.read(readRequest(1)));

			await flush();
			transports[0].outstanding()[0].reject(error);
			await expect(pending).rejects.toBe(error);
		};

		await answer(new ModbusTimeoutError());
		await answer(new ModbusTimeoutError());
		await answer(new ModbusExceptionError(0x02));
		await answer(new ModbusTimeoutError());
		await answer(new ModbusTimeoutError());

		expect(transports).toHaveLength(1);
		expect(transports[0].closeCalls).toBe(0);
		expect(connection.getHealth().timeouts).toBe(4);
	});

	it('does not reset the socket on a Modbus exception on rtu_over_tcp', async () => {
		const { connection, transports } = setup({ framing: ModbusFraming.RTU_OVER_TCP });

		connection.start();
		await flush();

		const failed = settle(connection.read(readRequest(1)));
		const next = connection.read(readRequest(2));

		await flush();
		transports[0].sent[0].reject(new ModbusExceptionError(0x0b));
		await expect(failed).rejects.toBeInstanceOf(ModbusExceptionError);
		await flush();

		expect(transports).toHaveLength(1);
		expect(transports[0].addresses()).toEqual([1, 2]);

		transports[0].sent[1].resolve([2]);

		await expect(next).resolves.toEqual([2]);
	});

	it.each([ModbusFraming.TCP, ModbusFraming.RTU_OVER_TCP])(
		'resets the socket immediately after a connection error on %s once the socket has answered',
		async (framing) => {
			const { connection, transports, states } = setup({ framing });

			connection.start();
			await flush();
			await answerOnce(connection, transports[0]);

			const failed = settle(connection.read(readRequest(1)));
			const next = connection.read(readRequest(2));

			await flush();
			transports[0].sent[1].reject(new ModbusConnectionError('Modbus request failed: CRC error'));
			await flush();

			await expect(failed).rejects.toBeInstanceOf(ModbusConnectionError);
			expect(transports[0].closeCalls).toBe(1);
			expect(transports).toHaveLength(2);
			expect(transports[1].addresses()).toEqual([2]);
			expect(states).not.toContain('backoff');
			expect(connection.getHealth().lastError).toContain('CRC');

			transports[1].sent[0].resolve([2]);

			await expect(next).resolves.toEqual([2]);
		},
	);

	it('rejects the other in-flight requests on a reset and sends queued ones on the new socket', async () => {
		const { connection, transports } = setup({ maxInFlight: 2 });

		connection.start();
		await flush();
		await answerOnce(connection, transports[0]);

		const failed = settle(connection.read(readRequest(1)));
		const sibling = settle(connection.read(readRequest(2)));
		const queued = connection.read(readRequest(3));

		await flush();
		transports[0].sent[1].reject(new ModbusConnectionError('Modbus request failed: length mismatch'));
		await flush();

		await expect(failed).rejects.toBeInstanceOf(ModbusConnectionError);
		await expect(sibling).rejects.toBeInstanceOf(ModbusConnectionError);
		expect(transports[0].addresses()).toEqual([0, 1, 2]);
		expect(transports[1].addresses()).toEqual([3]);

		transports[1].sent[0].resolve([3]);

		await expect(queued).resolves.toEqual([3]);
	});

	it('ignores late close callbacks from a replaced transport', async () => {
		const { connection, transports } = setup({ framing: ModbusFraming.RTU_OVER_TCP });

		connection.start();
		await flush();

		void settle(connection.read(readRequest(1)));
		await flush();
		transports[0].sent[0].reject(new ModbusTimeoutError());
		await flush();

		expect(transports).toHaveLength(2);

		const pending = connection.read(readRequest(2));

		await flush();

		transports[0].emitClose(new Error('late close'));
		await flush();

		expect(connection.getHealth().state).toBe('connected');
		expect(transports).toHaveLength(2);
		expect(transports[1].closeCalls).toBe(0);

		transports[1].sent[0].resolve([2]);

		await expect(pending).resolves.toEqual([2]);
	});

	it('rejects requests while stopped', async () => {
		const { connection, transports } = setup();

		await expect(connection.read(readRequest(1))).rejects.toBeInstanceOf(ModbusEndpointUnavailableError);
		expect(transports).toHaveLength(0);
		expect(connection.getHealth().state).toBe('stopped');

		connection.start();
		await flush();
		await connection.stop();

		await expect(connection.write(writeRequest(1))).rejects.toBeInstanceOf(ModbusEndpointUnavailableError);
		expect(transports[0].sent).toHaveLength(0);
	});

	it('stop() rejects everything and closes the transport', async () => {
		const { connection, transports, states } = setup();

		connection.start();
		await flush();

		const inFlight = settle(connection.read(readRequest(1)));
		const queued = settle(connection.read(readRequest(2)));

		await flush();
		await connection.stop();

		await expect(inFlight).rejects.toBeInstanceOf(ModbusConnectionError);
		await expect(queued).rejects.toBeInstanceOf(ModbusEndpointUnavailableError);
		expect(transports[0].closeCalls).toBe(1);
		expect(states[states.length - 1]).toBe('stopped');

		await jest.advanceTimersByTimeAsync(120000);

		expect(transports).toHaveLength(1);
	});

	it('stop() during backoff cancels the reconnect', async () => {
		const { connection, transports, modes } = setup();

		modes.push('fail');
		connection.start();
		await flush();
		await connection.stop();
		await jest.advanceTimersByTimeAsync(120000);

		expect(transports).toHaveLength(1);
		expect(connection.getHealth().state).toBe('stopped');
	});

	it('sends requests queued while connecting once connected', async () => {
		const { connection, transports, modes } = setup();

		modes.push('manual');
		connection.start();
		await flush();

		expect(connection.getHealth().state).toBe('connecting');

		const pending = connection.read(readRequest(1));

		await flush();

		expect(transports[0].sent).toHaveLength(0);

		transports[0].resolveConnect();
		await flush();

		expect(transports[0].addresses()).toEqual([1]);

		transports[0].sent[0].resolve([1]);

		await expect(pending).resolves.toEqual([1]);
	});

	it('rejects requests queued while connecting when the connect fails', async () => {
		const { connection, transports, modes } = setup();

		modes.push('manual');
		connection.start();
		await flush();

		const read = settle(connection.read(readRequest(1)));
		const write = settle(connection.write(writeRequest(2)));

		await flush();
		transports[0].rejectConnect();
		await flush();

		await expect(read).rejects.toBeInstanceOf(ModbusEndpointUnavailableError);
		await expect(write).rejects.toBeInstanceOf(ModbusEndpointUnavailableError);
		expect(transports[0].sent).toHaveLength(0);
		expect(connection.getHealth().state).toBe('backoff');
		expect(connection.getHealth().lastError).toContain('refused');
	});

	it('rejects requests queued during a reset when the reconnect fails', async () => {
		const { connection, transports, modes } = setup({ framing: ModbusFraming.RTU_OVER_TCP });

		connection.start();
		await flush();

		modes.push('manual');

		void settle(connection.read(readRequest(1)));
		const queued = settle(connection.read(readRequest(2)));

		await flush();
		transports[0].sent[0].reject(new ModbusTimeoutError());
		await flush();

		expect(connection.getHealth().state).toBe('connecting');

		transports[1].rejectConnect();
		await flush();

		await expect(queued).rejects.toBeInstanceOf(ModbusEndpointUnavailableError);
		expect(connection.getHealth().state).toBe('backoff');
	});

	it('keeps working when a state listener throws', async () => {
		const { connection, states } = setup();
		const later: EndpointConnectionState[] = [];

		connection.onStateChange(() => {
			throw new Error('listener failure');
		});
		const unsubscribe = connection.onStateChange((state) => later.push(state));

		connection.start();
		await flush();

		expect(connection.getHealth().state).toBe('connected');
		expect(states).toEqual(['connecting', 'connected']);
		expect(later).toEqual(['connecting', 'connected']);

		unsubscribe();
		await connection.stop();

		expect(later).toEqual(['connecting', 'connected']);
		expect(states).toEqual(['connecting', 'connected', 'stopped']);
	});
});
