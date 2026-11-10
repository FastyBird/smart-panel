import { IServiceVector, ServerTCP } from 'modbus-serial';
import { AddressInfo, Server, Socket, createServer } from 'net';

import { ModbusFraming, ModbusRegisterType, ModbusWriteFunction } from '../devices-modbus.constants';
import { ModbusConnectionError, ModbusExceptionError, ModbusTimeoutError } from '../lib/errors';

import { createModbusSerialTransport } from './modbus-serial.transport';
import { ModbusTransport, ModbusTransportOptions } from './modbus-transport';

const crc16Modbus = (frame: Buffer): number => {
	let crc = 0xffff;

	for (const byte of frame) {
		crc ^= byte;

		for (let bit = 0; bit < 8; bit++) {
			crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
		}
	}

	return crc;
};

const withCrc = (bytes: number[]): Buffer => {
	const frame = Buffer.from(bytes);
	const crc = Buffer.alloc(2);

	crc.writeUInt16LE(crc16Modbus(frame));

	return Buffer.concat([frame, crc]);
};

interface RtuRequest {
	unitId: number;
	functionCode: number;
	address: number;
	count: number;
}

describe('ModbusSerialTransport', () => {
	let transports: ModbusTransport[] = [];
	let modbusServer: ServerTCP | null = null;
	let rawServer: Server | null = null;
	let rawSockets: Socket[] = [];

	const transport = (port: number, overrides: Partial<ModbusTransportOptions> = {}): ModbusTransport => {
		const created = createModbusSerialTransport({
			host: '127.0.0.1',
			port,
			framing: ModbusFraming.TCP,
			connectTimeoutMs: 1000,
			requestTimeoutMs: 1000,
			...overrides,
		});

		transports.push(created);

		return created;
	};

	/** A real modbus-serial Modbus TCP server on an ephemeral port, answering any unit ID. */
	const startModbusServer = async (vector: IServiceVector): Promise<number> => {
		// ServerTCP falls back to 502 for a falsy port, so the ephemeral port is passed as the string '0'.
		const server = new ServerTCP(vector, { host: '127.0.0.1', port: '0' as unknown as number, unitID: 255 });

		modbusServer = server;

		await new Promise<void>((resolve) => server.once('initialized', () => resolve()));

		const listener = (server as unknown as { _server: Server })._server;

		return (listener.address() as AddressInfo).port;
	};

	/** Destroys the server side of every connection; waits first, as the client can see `connect` before the server accepts. */
	const dropServerConnections = async (reset = false): Promise<void> => {
		const socks = (modbusServer as unknown as { socks: Map<Socket, 0> }).socks;

		while (socks.size === 0) {
			await new Promise((resolve) => setImmediate(resolve));
		}

		socks.forEach((_, socket) => (reset ? socket.resetAndDestroy() : socket.destroy()));
	};

	/** A raw TCP server speaking RTU frames (with CRC, no MBAP header); answers each 8-byte request. */
	const startRtuServer = (respond: (request: RtuRequest) => number[]): Promise<number> =>
		startRawRtuServer((request, socket) => {
			socket.write(withCrc(respond(request)));
		});

	/** Like `startRtuServer`, but the handler writes the raw answer bytes itself (or nothing). */
	const startRawRtuServer = async (answer: (request: RtuRequest, socket: Socket) => void): Promise<number> => {
		const server = createServer((socket) => {
			rawSockets.push(socket);

			let buffer = Buffer.alloc(0);

			socket.on('data', (data) => {
				buffer = Buffer.concat([buffer, data]);

				while (buffer.length >= 8) {
					const frame = buffer.subarray(0, 8);

					buffer = buffer.subarray(8);

					if (frame.readUInt16LE(6) !== crc16Modbus(frame.subarray(0, 6))) {
						socket.destroy();

						return;
					}

					answer(
						{
							unitId: frame[0],
							functionCode: frame[1],
							address: frame.readUInt16BE(2),
							count: frame.readUInt16BE(4),
						},
						socket,
					);
				}
			});
		});

		rawServer = server;

		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

		return (server.address() as AddressInfo).port;
	};

	afterEach(async () => {
		await Promise.all(transports.map((t) => t.close()));

		transports = [];

		if (modbusServer) {
			const server = modbusServer;

			modbusServer = null;

			await new Promise<void>((resolve) => server.close(() => resolve()));
		}

		if (rawServer) {
			const server = rawServer;

			rawServer = null;
			rawSockets.forEach((socket) => socket.destroy());
			rawSockets = [];

			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});

	describe('tcp framing', () => {
		it('reads holding registers', async () => {
			const port = await startModbusServer({ getHoldingRegister: (addr: number) => addr * 10 });
			const client = transport(port);

			await client.connect();

			await expect(
				client.read({ unitId: 2, registerType: ModbusRegisterType.HOLDING_REGISTER, address: 4, count: 2 }),
			).resolves.toEqual([40, 50]);
		});

		it('reads input registers and discrete inputs', async () => {
			const port = await startModbusServer({
				getInputRegister: (addr: number) => addr + 1,
				getDiscreteInput: (addr: number) => addr % 2 === 0,
			});
			const client = transport(port);

			await client.connect();

			await expect(
				client.read({ unitId: 1, registerType: ModbusRegisterType.INPUT_REGISTER, address: 7, count: 3 }),
			).resolves.toEqual([8, 9, 10]);
			await expect(
				client.read({ unitId: 1, registerType: ModbusRegisterType.DISCRETE_INPUT, address: 0, count: 5 }),
			).resolves.toEqual([true, false, true, false, true]);
		});

		it('reads coils trimmed to count', async () => {
			const port = await startModbusServer({ getCoil: (addr: number) => addr === 1 });
			const client = transport(port);

			await client.connect();

			const values = await client.read({ unitId: 1, registerType: ModbusRegisterType.COIL, address: 0, count: 3 });

			expect(values).toHaveLength(3);
			expect(values).toEqual([false, true, false]);
		});

		it('binds the unit ID per request', async () => {
			const port = await startModbusServer({
				getHoldingRegister: (addr: number, unitID: number) => unitID * 1000 + addr,
			});
			const client = transport(port);

			await client.connect();

			const [first, second] = await Promise.all([
				client.read({ unitId: 2, registerType: ModbusRegisterType.HOLDING_REGISTER, address: 1, count: 1 }),
				client.read({ unitId: 7, registerType: ModbusRegisterType.HOLDING_REGISTER, address: 1, count: 1 }),
			]);

			expect(first).toEqual([2001]);
			expect(second).toEqual([7001]);
		});

		it('writes a single register with FC06', async () => {
			const setRegister = jest.fn();
			const setRegisterArray = jest.fn();
			const port = await startModbusServer({ setRegister, setRegisterArray });
			const client = transport(port);

			await client.connect();
			await client.write({
				unitId: 3,
				registerType: ModbusRegisterType.HOLDING_REGISTER,
				address: 1,
				values: [256],
				writeFunction: ModbusWriteFunction.SINGLE,
			});

			expect(setRegister).toHaveBeenCalledWith(1, 256, 3);
			expect(setRegisterArray).not.toHaveBeenCalled();
		});

		it('writes multiple registers with FC16', async () => {
			const setRegister = jest.fn();
			const setRegisterArray = jest.fn();
			const port = await startModbusServer({ setRegister, setRegisterArray });
			const client = transport(port);

			await client.connect();
			await client.write({
				unitId: 1,
				registerType: ModbusRegisterType.HOLDING_REGISTER,
				address: 10,
				values: [1, 2],
				writeFunction: ModbusWriteFunction.MULTIPLE,
			});

			expect(setRegisterArray).toHaveBeenCalledWith(10, [1, 2], 1);
			expect(setRegister).not.toHaveBeenCalled();
		});

		it('writes a single coil with FC05 and multiple coils with FC15', async () => {
			const setCoil = jest.fn();
			const setCoilArray = jest.fn();
			const port = await startModbusServer({ setCoil, setCoilArray } as IServiceVector);
			const client = transport(port);

			await client.connect();
			await client.write({
				unitId: 1,
				registerType: ModbusRegisterType.COIL,
				address: 5,
				values: [true],
				writeFunction: ModbusWriteFunction.SINGLE,
			});

			expect(setCoil).toHaveBeenCalledWith(5, true, 1);
			expect(setCoilArray).not.toHaveBeenCalled();

			await client.write({
				unitId: 1,
				registerType: ModbusRegisterType.COIL,
				address: 8,
				values: [true, false, true],
				writeFunction: ModbusWriteFunction.MULTIPLE,
			});

			expect(setCoilArray).toHaveBeenCalledWith(8, [true, false, true], 1);
			expect(setCoil).toHaveBeenCalledTimes(1);
		});

		it('refuses a single write with more than one value', async () => {
			const port = await startModbusServer({ setRegister: jest.fn() });
			const client = transport(port);

			await client.connect();

			await expect(
				client.write({
					unitId: 1,
					registerType: ModbusRegisterType.HOLDING_REGISTER,
					address: 1,
					values: [1, 2],
					writeFunction: ModbusWriteFunction.SINGLE,
				}),
			).rejects.toThrow(RangeError);
		});

		it('maps exception responses', async () => {
			const port = await startModbusServer({
				getHoldingRegister: () => {
					throw Object.assign(new Error('illegal data address'), { modbusErrorCode: 2 });
				},
			});
			const client = transport(port);

			await client.connect();

			const error = await client
				.read({ unitId: 1, registerType: ModbusRegisterType.HOLDING_REGISTER, address: 0, count: 1 })
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ModbusExceptionError);
			expect((error as ModbusExceptionError).code).toBe(2);
			expect((error as ModbusExceptionError).isGatewayError).toBe(false);
		});

		it('maps timeouts', async () => {
			const port = await startModbusServer({ getHoldingRegister: () => new Promise<number>(() => undefined) });
			const client = transport(port, { requestTimeoutMs: 100 });

			await client.connect();

			await expect(
				client.read({ unitId: 1, registerType: ModbusRegisterType.HOLDING_REGISTER, address: 0, count: 1 }),
			).rejects.toBeInstanceOf(ModbusTimeoutError);
		});

		it('reports close', async () => {
			const port = await startModbusServer({ getHoldingRegister: () => 1 });
			const client = transport(port);
			const listener = jest.fn();

			client.onClose(listener);

			await client.connect();

			expect(client.isOpen()).toBe(true);

			const closed = new Promise<void>((resolve) => client.onClose(() => resolve()));

			await dropServerConnections();
			await closed;

			expect(listener).toHaveBeenCalledTimes(1);
			expect(client.isOpen()).toBe(false);
		});

		it('passes the socket error to close listeners', async () => {
			const port = await startModbusServer({ getHoldingRegister: () => 1 });
			const client = transport(port);

			await client.connect();

			const closed = new Promise<Error | undefined>((resolve) => client.onClose(resolve));

			await dropServerConnections(true);

			const error = await closed;

			// Node core errors come from another realm than Jest's sandbox, so `toBeInstanceOf(Error)` cannot be used.
			expect(error).toMatchObject({ code: 'ECONNRESET' });
		});

		it('reports an explicit close', async () => {
			const port = await startModbusServer({ getHoldingRegister: () => 1 });
			const client = transport(port);
			const listener = jest.fn();

			client.onClose(listener);

			await client.connect();
			await client.close();

			expect(listener).toHaveBeenCalledTimes(1);
			expect(listener).toHaveBeenCalledWith(undefined);
			expect(client.isOpen()).toBe(false);
		});

		it('rejects outstanding requests when the socket closes', async () => {
			const port = await startModbusServer({ getHoldingRegister: () => new Promise<number>(() => undefined) });
			const client = transport(port, { requestTimeoutMs: 5000 });

			await client.connect();

			const pending = client.read({
				unitId: 1,
				registerType: ModbusRegisterType.HOLDING_REGISTER,
				address: 0,
				count: 1,
			});
			const started = Date.now();

			// Let the request reach the server before the socket goes away.
			await new Promise((resolve) => setTimeout(resolve, 50));

			await dropServerConnections();

			await expect(pending).rejects.toBeInstanceOf(ModbusConnectionError);
			expect(Date.now() - started).toBeLessThan(1000);
		});

		it('rejects requests when not connected', async () => {
			const client = transport(1);

			await expect(
				client.read({ unitId: 1, registerType: ModbusRegisterType.HOLDING_REGISTER, address: 0, count: 1 }),
			).rejects.toBeInstanceOf(ModbusConnectionError);
		});

		it('closes idempotently, also when never connected', async () => {
			const neverConnected = transport(1);

			await expect(neverConnected.close()).resolves.toBeUndefined();
			await expect(neverConnected.close()).resolves.toBeUndefined();

			const port = await startModbusServer({ getHoldingRegister: () => 1 });
			const client = transport(port);

			await client.connect();
			await client.close();

			await expect(client.close()).resolves.toBeUndefined();
		});

		it('reconnects after a close', async () => {
			const port = await startModbusServer({ getHoldingRegister: () => 42 });
			const client = transport(port);

			await client.connect();
			await client.close();
			await client.connect();

			await expect(
				client.read({ unitId: 1, registerType: ModbusRegisterType.HOLDING_REGISTER, address: 0, count: 1 }),
			).resolves.toEqual([42]);
		});

		it('rejects a refused connection with ModbusConnectionError', async () => {
			const probe = createServer();

			await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));

			const port = (probe.address() as AddressInfo).port;

			await new Promise<void>((resolve) => probe.close(() => resolve()));

			const client = transport(port);

			await expect(client.connect()).rejects.toBeInstanceOf(ModbusConnectionError);
			expect(client.isOpen()).toBe(false);
		});

		it('rejects an invalid port with ModbusConnectionError', async () => {
			const client = transport(70000);

			await expect(client.connect()).rejects.toBeInstanceOf(ModbusConnectionError);
			await expect(client.close()).resolves.toBeUndefined();
		});

		it('honours the connect timeout', async () => {
			// TEST-NET-1 (RFC 5737) is never routed: the connect either hangs until our timeout or fails as unreachable.
			const client = transport(502, { host: '192.0.2.1', connectTimeoutMs: 100 });
			const started = Date.now();

			await expect(client.connect()).rejects.toBeInstanceOf(ModbusConnectionError);
			expect(Date.now() - started).toBeLessThan(1000);
			expect(client.isOpen()).toBe(false);
		});
	});

	describe('rtu_over_tcp framing', () => {
		it('speaks RTU over TCP', async () => {
			const requests: RtuRequest[] = [];
			const port = await startRtuServer((request) => {
				requests.push(request);

				return [0x02, 0x03, 0x04, 0x00, 0x01, 0x80, 0x00];
			});
			const client = transport(port, { framing: ModbusFraming.RTU_OVER_TCP });

			await client.connect();

			await expect(
				client.read({ unitId: 2, registerType: ModbusRegisterType.HOLDING_REGISTER, address: 4, count: 2 }),
			).resolves.toEqual([1, 0x8000]);
			expect(requests).toEqual([{ unitId: 2, functionCode: 3, address: 4, count: 2 }]);
		});

		it('maps gateway exceptions', async () => {
			const port = await startRtuServer((request) => [request.unitId, request.functionCode | 0x80, 0x0b]);
			const client = transport(port, { framing: ModbusFraming.RTU_OVER_TCP });

			await client.connect();

			const error = await client
				.read({ unitId: 9, registerType: ModbusRegisterType.INPUT_REGISTER, address: 0, count: 1 })
				.catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ModbusExceptionError);
			expect((error as ModbusExceptionError).code).toBe(0x0b);
			expect((error as ModbusExceptionError).isGatewayError).toBe(true);
		});

		it('refuses a second request while one is on the wire', async () => {
			const port = await startRtuServer(() => [0x01, 0x03, 0x02, 0x00, 0x05]);
			const client = transport(port, { framing: ModbusFraming.RTU_OVER_TCP });

			await client.connect();

			const first = client.read({ unitId: 1, registerType: ModbusRegisterType.HOLDING_REGISTER, address: 0, count: 1 });
			const second = client.read({
				unitId: 1,
				registerType: ModbusRegisterType.HOLDING_REGISTER,
				address: 1,
				count: 1,
			});

			await expect(second).rejects.toThrow('one request at a time');
			await expect(first).resolves.toEqual([5]);
		});

		/** FC03 answer whose registers all hold `address * 10 + index`, so every block is recognisable. */
		const holdingAnswer = (request: RtuRequest): Buffer =>
			withCrc([
				request.unitId,
				request.functionCode,
				request.count * 2,
				...Array.from({ length: request.count }, (_, index) => [0, request.address * 10 + index]).flat(),
			]);

		const readHolding = (client: ModbusTransport, address: number) =>
			client.read({ unitId: 1, registerType: ModbusRegisterType.HOLDING_REGISTER, address, count: 2 });

		it('keeps answering each request with its own reply after a duplicated reply in the same segment', async () => {
			let answered = 0;
			const port = await startRawRtuServer((request, socket) => {
				const reply = holdingAnswer(request);

				// The gateway repeats its first reply: both copies arrive in one TCP segment.
				socket.write(answered++ === 0 ? Buffer.concat([reply, reply]) : reply);
			});
			const client = transport(port, { framing: ModbusFraming.RTU_OVER_TCP });

			await client.connect();

			await expect(readHolding(client, 0)).resolves.toEqual([0, 1]);
			// Same unit, function and length as the duplicate: without discarding it, this read would get [0, 1].
			await expect(readHolding(client, 5)).resolves.toEqual([50, 51]);
			await expect(readHolding(client, 7)).resolves.toEqual([70, 71]);
		});

		it('keeps answering each request with its own reply after a late duplicated reply', async () => {
			let answered = 0;
			const port = await startRawRtuServer((request, socket) => {
				const reply = holdingAnswer(request);

				socket.write(reply);

				if (answered++ === 0) {
					setTimeout(() => socket.write(reply), 10);
				}
			});
			const client = transport(port, { framing: ModbusFraming.RTU_OVER_TCP });

			await client.connect();

			await expect(readHolding(client, 0)).resolves.toEqual([0, 1]);

			// Let the duplicate arrive while no request is outstanding.
			await new Promise((resolve) => setTimeout(resolve, 50));

			await expect(readHolding(client, 5)).resolves.toEqual([50, 51]);
		});

		it('reassembles a reply split across TCP writes', async () => {
			const port = await startRawRtuServer((request, socket) => {
				const reply = holdingAnswer(request);

				socket.write(reply.subarray(0, 3));
				setTimeout(() => socket.write(reply.subarray(3)), 20);
			});
			const client = transport(port, { framing: ModbusFraming.RTU_OVER_TCP });

			await client.connect();

			await expect(readHolding(client, 4)).resolves.toEqual([40, 41]);
		});

		it('maps a CRC error to ModbusConnectionError', async () => {
			const port = await startRawRtuServer((request, socket) => {
				const reply = holdingAnswer(request);

				reply[reply.length - 1] ^= 0xff;
				socket.write(reply);
			});
			const client = transport(port, { framing: ModbusFraming.RTU_OVER_TCP });

			await client.connect();

			await expect(readHolding(client, 0)).rejects.toBeInstanceOf(ModbusConnectionError);
		});

		it('maps a missing reply to ModbusTimeoutError', async () => {
			const port = await startRawRtuServer(() => undefined);
			const client = transport(port, { framing: ModbusFraming.RTU_OVER_TCP, requestTimeoutMs: 100 });

			await client.connect();

			await expect(readHolding(client, 0)).rejects.toBeInstanceOf(ModbusTimeoutError);
		});
	});
});
