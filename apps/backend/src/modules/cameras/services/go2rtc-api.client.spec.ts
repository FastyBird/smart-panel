import { IncomingHttpHeaders, IncomingMessage, Server, ServerResponse, createServer } from 'http';
import { AddressInfo, createServer as createNetServer } from 'net';

import { Go2rtcApiError } from '../cameras.exceptions';

import { Go2rtcApiClient } from './go2rtc-api.client';

interface Recorded {
	method: string;
	path: string;
	query: Record<string, string>;
}

class StubServer {
	last: Recorded | null = null;
	lastHeaders: IncomingHttpHeaders = {};

	private readonly replies = new Map<string, { status: number; body: unknown }>();
	private readonly server: Server;
	private hang = false;

	constructor() {
		this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
			const url = new URL(req.url ?? '/', 'http://localhost');

			this.last = {
				method: req.method ?? '',
				path: url.pathname,
				query: Object.fromEntries(url.searchParams.entries()),
			};
			this.lastHeaders = req.headers;

			if (this.hang) {
				return;
			}

			const reply = this.replies.get(`${req.method} ${url.pathname}`) ?? { status: 200, body: {} };

			res.writeHead(reply.status, { 'content-type': 'application/json' });
			res.end(JSON.stringify(reply.body));
		});
	}

	reply(key: string, status: number, body: unknown): void {
		this.replies.set(key, { status, body });
	}

	neverAnswer(): void {
		this.hang = true;
	}

	async listen(): Promise<string> {
		await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));

		return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
	}

	async close(): Promise<void> {
		this.server.closeAllConnections();
		await new Promise<void>((resolve) => this.server.close(() => resolve()));
	}
}

async function closedPort(): Promise<number> {
	const server = createNetServer();

	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

	const { port } = server.address() as AddressInfo;

	await new Promise<void>((resolve) => server.close(() => resolve()));

	return port;
}

describe('Go2rtcApiClient', () => {
	let stub: StubServer;
	let baseUrl: string;
	let client: Go2rtcApiClient;

	beforeEach(async () => {
		stub = new StubServer();
		baseUrl = await stub.listen();
		client = new Go2rtcApiClient({ baseUrl, authorization: 'Basic c3A6cHc=' });
	});

	afterEach(() => stub.close());

	it('reads version and config_path from GET /api and sends the authorization header', async () => {
		stub.reply('GET /api', 200, { version: '1.9.9', revision: 'abc', config_path: '/cfg/go2rtc.yaml', host: 'h' });

		expect(await client.getInfo()).toEqual({ version: '1.9.9', configPath: '/cfg/go2rtc.yaml' });
		expect(stub.lastHeaders.authorization).toBe('Basic c3A6cHc=');
		expect(client.authorization).toBe('Basic c3A6cHc=');
	});

	it('sends no authorization header without credentials', async () => {
		const anonymous = new Go2rtcApiClient({ baseUrl, authorization: null });

		await anonymous.getInfo();

		expect(stub.lastHeaders.authorization).toBeUndefined();
	});

	it('drops a version that is not a plain version string and a missing config_path', async () => {
		stub.reply('GET /api', 200, { version: '<script>' });

		expect(await client.getInfo()).toEqual({ version: null, configPath: null });
	});

	it('puts a stream with name and src query parameters', async () => {
		await client.putStream('smart-panel_c1_medium', 'rtspx://c:7441/A?enableSrtp');

		expect(stub.last).toEqual({
			method: 'PUT',
			path: '/api/streams',
			query: { name: 'smart-panel_c1_medium', src: 'rtspx://c:7441/A?enableSrtp' },
		});
	});

	it('deletes by passing the name as src and accepts 404', async () => {
		stub.reply('DELETE /api/streams', 404, {});

		await expect(client.deleteStream('smart-panel_c1_medium')).resolves.toBeUndefined();
		expect(stub.last).toEqual({ method: 'DELETE', path: '/api/streams', query: { src: 'smart-panel_c1_medium' } });
	});

	it('lists stream names', async () => {
		stub.reply('GET /api/streams', 200, { a: {}, b: {} });

		expect(await client.listStreamNames()).toEqual(['a', 'b']);
	});

	it('rejects a stream listing that is not an object', async () => {
		stub.reply('GET /api/streams', 200, ['a']);

		await expect(client.listStreamNames()).rejects.toBeInstanceOf(Go2rtcApiError);
	});

	it('rejects with Go2rtcApiError without the url on 500', async () => {
		stub.reply('PUT /api/streams', 500, {});

		const failure = await client.putStream('n', 'rtspx://c:7441/SENTINELALIAS0123456789').catch((e: unknown) => e);

		expect(failure).toBeInstanceOf(Go2rtcApiError);
		expect(failure).toMatchObject({ name: 'Go2rtcApiError', status: 500, message: 'go2rtc request failed' });
		expect(JSON.stringify(failure)).not.toContain('SENTINELALIAS');
		expect((failure as Error).stack).not.toContain('SENTINELALIAS');
	});

	it('rejects with status null on timeout', async () => {
		stub.neverAnswer();

		const slow = new Go2rtcApiClient({ baseUrl, authorization: null }, 50);

		await expect(slow.getInfo()).rejects.toMatchObject({ name: 'Go2rtcApiError', status: null });
	});

	it('rejects with status null on a refused connection', async () => {
		const refused = new Go2rtcApiClient({ baseUrl: `http://127.0.0.1:${await closedPort()}`, authorization: null });

		await expect(refused.putStream('n', 'rtspx://c:7441/SENTINELALIAS0123456789')).rejects.toMatchObject({
			name: 'Go2rtcApiError',
			status: null,
			message: 'go2rtc request failed',
		});
	});

	it('builds ws and wss urls', () => {
		expect(new Go2rtcApiClient({ baseUrl: 'https://h:1984', authorization: null }).wsUrl('a b')).toBe(
			'wss://h:1984/api/ws?src=a%20b',
		);
		expect(new Go2rtcApiClient({ baseUrl: 'http://h:1984', authorization: null }).wsUrl('a')).toBe(
			'ws://h:1984/api/ws?src=a',
		);
	});
});
