import ModbusRTU from 'modbus-serial';
import { AddressInfo, Server, Socket, createServer } from 'net';

import { TELNET_PORT_VERIFIED_VERSION, telnetReceiveBuffer } from './telnet-receive-buffer';

describe('telnetReceiveBuffer', () => {
	let server: Server;
	let peer: Socket | null = null;
	let socket: Socket;

	beforeEach(async () => {
		const accepted = new Promise<Socket>((resolve) => {
			server = createServer(resolve);
		});

		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

		socket = new Socket();

		await new Promise<void>((resolve) =>
			socket.connect({ host: '127.0.0.1', port: (server.address() as AddressInfo).port }, resolve),
		);

		peer = await accepted;
	});

	afterEach(async () => {
		socket.destroy();
		peer?.destroy();

		await new Promise<void>((resolve) => server.close(() => resolve()));
	});

	it('runs against the modbus-serial release its private access was verified with', () => {
		// A modbus-serial upgrade must re-verify `TelnetPort` (see telnet-receive-buffer.ts) and then bump this pin.
		const { version } = jest.requireActual<{ version: string }>('modbus-serial/package.json');

		expect(version).toBe(TELNET_PORT_VERIFIED_VERSION);
	});

	it('discards the bytes the telnet port keeps buffered', async () => {
		const client = new ModbusRTU();

		client.linkTelnet(socket, {}, (error?: Error) => {
			if (error) throw error;
		});

		const buffer = telnetReceiveBuffer(client);
		const received = new Promise((resolve) => socket.once('data', resolve));

		// No request is outstanding, so the port only buffers what arrives.
		peer?.write(Buffer.from([0x01, 0x03, 0x04, 0x00, 0x00, 0x00, 0x01, 0xaa, 0xbb]));
		await received;

		expect(buffer.discard()).toBe(9);
		expect(buffer.discard()).toBe(0);
	});

	it('refuses a client whose port does not have the expected shape', () => {
		expect(() => telnetReceiveBuffer(new ModbusRTU())).toThrow(/TelnetPort internals changed/);
	});
});
