import { IncomingMessage, Server, ServerResponse, createServer } from 'http';
import { AddressInfo } from 'net';
import { Duplex } from 'stream';
import WebSocket, { WebSocketServer } from 'ws';

const STUB_VERSION = '1.9.9-stub';
const MSE_CODECS = 'video/mp4; codecs="avc1.640029"';
const MEDIA_INTERVAL_MS = 100;
const UNKNOWN_STREAM_CLOSE_CODE = 1011;

/** A minimal `ftyp` box: size 24, `ftyp`, major brand `isom`, minor version 512, compatible `isom` and `iso2`. */
const FTYP_BOX = Buffer.concat([
	Buffer.from([0x00, 0x00, 0x00, 0x18]),
	Buffer.from('ftypisom', 'ascii'),
	Buffer.from([0x00, 0x00, 0x02, 0x00]),
	Buffer.from('isomiso2', 'ascii'),
]);

/**
 * A go2rtc stand-in that speaks the part of its API the relay uses: `GET /api`, `PUT`/`DELETE`/`GET /api/streams` and
 * the MSE WebSocket `/api/ws?src=<name>`. It needs no credentials (external mode). Shape as in go2rtc v1.9.15: `GET
 * /api` answers `{ version, revision, host }` (there is no `pid`); the delete call carries the stream name in `src`.
 *
 * `/api/ws`: after the upgrade a text `{"type":"mse"}` request is answered with a text `mse` message and then a binary
 * `ftyp` box every 100 ms. A name that was not registered with `PUT` closes with 1011.
 */
export class StubGo2rtcServer {
	/** Every `PUT /api/streams`, in order. */
	readonly puts: { name: string; src: string }[] = [];
	/** Every `DELETE /api/streams`, in order: the stream name. */
	readonly deletes: string[] = [];
	/** The frames the stub received from the relay on `/api/ws`. */
	readonly requests: string[] = [];
	/** Delays the `/api/ws` upgrade, in milliseconds. */
	acceptDelayMs = 0;

	private readonly streams = new Set<string>();
	private readonly clients = new Set<WebSocket>();
	private readonly timers = new Set<NodeJS.Timeout>();
	/** Sockets whose upgrade is delayed (`acceptDelayMs`): destroyed on `stop()` so the server can close. */
	private readonly pendingUpgrades = new Set<Duplex>();
	private readonly wss = new WebSocketServer({ noServer: true });
	private server: Server | null = null;

	/** Resolves `http://127.0.0.1:<port>`. */
	async start(): Promise<string> {
		const server = createServer((req, res) => this.onRequest(req, res));

		server.on('upgrade', (req, socket, head) => this.onUpgrade(req, socket, head));

		await new Promise<void>((resolve, reject) => {
			server.once('error', reject);
			server.listen(0, '127.0.0.1', () => {
				server.off('error', reject);
				resolve();
			});
		});

		this.server = server;

		return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	}

	async stop(): Promise<void> {
		const server = this.server;

		this.server = null;

		for (const timer of this.timers) {
			clearTimeout(timer);
			clearInterval(timer);
		}

		this.timers.clear();

		for (const socket of this.pendingUpgrades) {
			socket.destroy();
		}

		this.pendingUpgrades.clear();

		for (const client of this.clients) {
			client.terminate();
		}

		this.clients.clear();
		this.wss.close();

		if (!server) {
			return;
		}

		server.closeAllConnections();

		await new Promise<void>((resolve) => server.close(() => resolve()));
	}

	private onRequest(req: IncomingMessage, res: ServerResponse): void {
		const url = new URL(req.url ?? '/', 'http://stub');
		const send = (status: number, body: unknown): void => {
			res.writeHead(status, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(body));
		};

		if (url.pathname === '/api' && req.method === 'GET') {
			send(200, { version: STUB_VERSION, revision: 'stub', host: '127.0.0.1' });

			return;
		}

		if (url.pathname === '/api/streams') {
			if (req.method === 'GET') {
				send(200, Object.fromEntries([...this.streams].map((name) => [name, { producers: [] }])));
			} else if (req.method === 'PUT') {
				const name = url.searchParams.get('name') ?? '';
				const src = url.searchParams.get('src') ?? '';

				this.puts.push({ name, src });
				this.streams.add(name);
				send(200, {});
			} else if (req.method === 'DELETE') {
				const name = url.searchParams.get('src') ?? '';

				this.deletes.push(name);
				this.streams.delete(name);
				send(200, {});
			} else {
				send(405, {});
			}

			return;
		}

		send(404, {});
	}

	private onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
		const url = new URL(req.url ?? '/', 'http://stub');

		if (url.pathname !== '/api/ws') {
			socket.destroy();

			return;
		}

		const name = url.searchParams.get('src') ?? '';
		const accept = (): void => {
			this.wss.handleUpgrade(req, socket, head, (client) => this.onClient(client, name));
		};

		if (this.acceptDelayMs <= 0) {
			accept();

			return;
		}

		const forget = (): void => {
			this.pendingUpgrades.delete(socket);
		};
		const timer = setTimeout(() => {
			this.timers.delete(timer);
			forget();

			if (socket.destroyed) {
				return;
			}

			accept();
		}, this.acceptDelayMs);

		this.timers.add(timer);
		this.pendingUpgrades.add(socket);
		socket.once('close', forget);
	}

	private onClient(client: WebSocket, name: string): void {
		this.clients.add(client);

		client.on('error', () => undefined);
		client.on('close', () => this.clients.delete(client));

		if (!this.streams.has(name)) {
			client.close(UNKNOWN_STREAM_CLOSE_CODE, 'unknown stream');

			return;
		}

		client.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
			if (isBinary) {
				return;
			}

			const frame = rawDataToString(data);

			this.requests.push(frame);

			if (!isMseRequest(frame)) {
				return;
			}

			client.send(JSON.stringify({ type: 'mse', value: MSE_CODECS }));

			const timer = setInterval(() => {
				if (client.readyState === WebSocket.OPEN) {
					client.send(FTYP_BOX, { binary: true });
				}
			}, MEDIA_INTERVAL_MS);

			this.timers.add(timer);
			client.on('close', () => {
				clearInterval(timer);
				this.timers.delete(timer);
			});
		});
	}
}

function isMseRequest(frame: string): boolean {
	try {
		return (JSON.parse(frame) as { type?: unknown } | null)?.type === 'mse';
	} catch {
		return false;
	}
}

export function rawDataToString(data: WebSocket.RawData): string {
	if (Array.isArray(data)) {
		return Buffer.concat(data).toString('utf8');
	}

	return (data instanceof ArrayBuffer ? Buffer.from(data) : data).toString('utf8');
}
