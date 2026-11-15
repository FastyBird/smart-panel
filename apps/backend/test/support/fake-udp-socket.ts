import { EventEmitter } from 'events';
import * as os from 'os';

import type {
	ProtectDiscoveryEnvironment,
	ProtectDiscoverySocket,
} from '../../src/plugins/devices-unifi-protect/services/protect-discovery.service';

export interface FakeSend {
	msg: Buffer;
	port: number;
	address: string;
}

export interface FakeDiscoveryEnvironmentOptions {
	interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>;
	container?: boolean;
	/** Return an Error to fail that send; call `socket.reply(buf, fromAddress)` to answer. */
	onSend?: (socket: FakeUdpSocket, msg: Buffer, port: number, address: string) => Error | null | void;
	bindError?: (address: string) => NodeJS.ErrnoException | null;
}

/** In-memory stand-in for a bound `dgram` udp4 socket; everything asynchronous settles in microtasks. */
export class FakeUdpSocket extends EventEmitter implements ProtectDiscoverySocket {
	readonly sends: FakeSend[] = [];
	boundAddress: string | null = null;
	boundPort: number | null = null;
	closed = false;
	closeCount = 0;
	broadcast: boolean | null = null;
	multicastTtl: number | null = null;
	multicastInterface: string | null = null;
	multicastLoopback: boolean | null = null;
	/** Make a setter throw (`setBroadcast`, `setMulticastInterface`, ...). */
	throwOn = new Set<string>();

	constructor(
		private readonly options: Pick<FakeDiscoveryEnvironmentOptions, 'onSend' | 'bindError'> = {},
		public readonly index = 0,
	) {
		super();
	}

	bind(...args: any[]): this {
		const [port, address, callback] = args as [number, string, (() => void) | undefined];

		this.boundPort = port;
		this.boundAddress = address;

		const error = this.options.bindError?.(address) ?? null;

		void Promise.resolve().then(() => {
			if (this.closed) {
				return;
			}

			if (error) {
				this.emit('error', error);

				return;
			}

			callback?.();
		});

		return this;
	}

	send(...args: any[]): void {
		if (this.closed) {
			throw Object.assign(new Error('Not running'), { code: 'ERR_SOCKET_DGRAM_NOT_RUNNING' });
		}

		const [msg, port, address, callback] = args as [
			Buffer,
			number,
			string,
			((error: Error | null) => void) | undefined,
		];

		this.sends.push({ msg, port, address });

		const failure = this.options.onSend?.(this, msg, port, address);

		void Promise.resolve().then(() => callback?.(failure instanceof Error ? failure : null));
	}

	close(callback?: () => void): this {
		if (this.closed) {
			throw Object.assign(new Error('Not running'), { code: 'ERR_SOCKET_DGRAM_NOT_RUNNING' });
		}

		this.closed = true;
		this.closeCount += 1;

		if (callback) {
			void Promise.resolve().then(callback);
		}

		return this;
	}

	setBroadcast(flag: boolean): void {
		this.guard('setBroadcast');
		this.broadcast = flag;
	}

	setMulticastTTL(ttl: number): number {
		this.guard('setMulticastTTL');
		this.multicastTtl = ttl;

		return ttl;
	}

	setMulticastInterface(address: string): void {
		this.guard('setMulticastInterface');
		this.multicastInterface = address;
	}

	setMulticastLoopback(flag: boolean): boolean {
		this.guard('setMulticastLoopback');
		this.multicastLoopback = flag;

		return flag;
	}

	/** Delivers a datagram as if it arrived from `address:port` (default the discovery port). */
	reply(buffer: Buffer, address: string, port = 10001): void {
		void Promise.resolve().then(() => {
			if (!this.closed) {
				this.emit('message', buffer, { address, family: 'IPv4', port, size: buffer.length });
			}
		});
	}

	private guard(name: string): void {
		if (this.throwOn.has(name)) {
			throw new Error(`${name} failed`);
		}
	}
}

export const createFakeDiscoveryEnvironment = (
	opts: FakeDiscoveryEnvironmentOptions,
): { env: ProtectDiscoveryEnvironment; sockets: FakeUdpSocket[] } => {
	const sockets: FakeUdpSocket[] = [];
	const env: ProtectDiscoveryEnvironment = {
		createSocket: () => {
			const socket = new FakeUdpSocket({ onSend: opts.onSend, bindError: opts.bindError }, sockets.length);

			sockets.push(socket);

			return socket;
		},
		networkInterfaces: () => opts.interfaces,
		isContainer: () => opts.container ?? false,
	};

	return { env, sockets };
};
