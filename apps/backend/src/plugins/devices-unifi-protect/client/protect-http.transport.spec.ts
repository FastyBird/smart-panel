import * as https from 'https';
import * as net from 'net';

import { ProtectTestServer, startProtectTestServer } from '../../../../test/support/protect-test-server';

import { NodeProtectTransport } from './protect-http.transport';

describe('NodeProtectTransport', () => {
	let server: ProtectTestServer | undefined;
	let transport: NodeProtectTransport | undefined;

	const open = async (handler: Parameters<typeof startProtectTestServer>[0]): Promise<NodeProtectTransport> => {
		server = await startProtectTestServer(handler);
		transport = new NodeProtectTransport({
			host: '127.0.0.1',
			port: server.port,
			agent: new https.Agent({ rejectUnauthorized: false, keepAlive: true }),
		});

		return transport;
	};

	const request = (
		t: NodeProtectTransport,
		extra: { timeoutMs?: number; maxBytes?: number; signal?: AbortSignal } = {},
	) =>
		t.request({
			method: 'GET',
			path: '/x?y=1',
			headers: { 'X-API-KEY': 'k', Accept: 'application/json' },
			timeoutMs: extra.timeoutMs ?? 2000,
			maxBytes: extra.maxBytes ?? 1024,
			signal: extra.signal,
		});

	afterEach(async () => {
		transport?.close();
		await server?.close();
		transport = undefined;
		server = undefined;
	});

	it('returns status, headers and body, and sends the request line and headers it was given', async () => {
		const t = await open((_req, res) => {
			res.writeHead(201, { 'Content-Type': 'application/json', 'Retry-After': '2' });
			res.end('{"ok":true}');
		});
		const response = await request(t);

		expect(response.status).toBe(201);
		expect(response.headers['retry-after']).toBe('2');
		expect(response.body.toString()).toBe('{"ok":true}');
		expect(server?.requests[0].method).toBe('GET');
		expect(server?.requests[0].url).toBe('/x?y=1');
		expect(server?.requests[0].headers['x-api-key']).toBe('k');
	});

	it('sends a POST body with content-type and content-length', async () => {
		const received: Buffer[] = [];
		const t = await open((req, res) => {
			req.on('data', (chunk: Buffer) => received.push(chunk));
			req.on('end', () => {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end('{}');
			});
		});
		const body = Buffer.from('{"qualities":["high"]}');

		await t.request({
			method: 'POST',
			path: '/x',
			headers: { 'X-API-KEY': 'k', Accept: 'application/json' },
			timeoutMs: 2000,
			maxBytes: 1024,
			body,
		});

		expect(server?.requests[0].method).toBe('POST');
		expect(server?.requests[0].headers['content-type']).toBe('application/json');
		expect(server?.requests[0].headers['content-length']).toBe(String(body.length));
		expect(Buffer.concat(received).toString()).toBe('{"qualities":["high"]}');
	});

	it('does not follow redirects', async () => {
		const t = await open((_req, res) => {
			res.writeHead(302, { Location: 'https://192.0.2.1/elsewhere' });
			res.end();
		});

		expect((await request(t)).status).toBe(302);
		expect(server?.requests).toHaveLength(1);
	});

	it('refuses a declared body over the cap', async () => {
		const t = await open((_req, res) => {
			res.writeHead(200, { 'Content-Length': '2048' });
			res.end(Buffer.alloc(2048));
		});

		await expect(request(t, { maxBytes: 1024 })).rejects.toMatchObject({ category: 'protocol' });
	});

	it('destroys a chunked body that grows past the cap', async () => {
		let closed = false;
		const t = await open((req, res) => {
			res.writeHead(200);
			req.socket.on('close', () => {
				closed = true;
			});

			const timer = setInterval(() => {
				if (res.destroyed) {
					clearInterval(timer);

					return;
				}

				res.write(Buffer.alloc(512));
			}, 5);

			res.on('close', () => clearInterval(timer));
		});

		await expect(request(t, { maxBytes: 1024 })).rejects.toMatchObject({ category: 'protocol' });
		await new Promise((r) => setTimeout(r, 100));
		expect(closed).toBe(true);
	});

	it('accepts a body of exactly the cap', async () => {
		const t = await open((_req, res) => res.end(Buffer.alloc(1024, 0x61)));

		expect((await request(t, { maxBytes: 1024 })).body).toHaveLength(1024);
	});

	it('times out a server that never answers', async () => {
		const t = await open(() => undefined);
		const started = Date.now();

		await expect(request(t, { timeoutMs: 150 })).rejects.toMatchObject({ category: 'timeout' });
		expect(Date.now() - started).toBeLessThan(1500);
	});

	it('one timer covers a body that stalls after the headers', async () => {
		const t = await open((_req, res) => {
			res.writeHead(200);
			res.write('partial');
		});

		await expect(request(t, { timeoutMs: 200 })).rejects.toMatchObject({ category: 'timeout' });
	});

	it('cancels on the abort signal and refuses an already aborted one', async () => {
		const t = await open(() => undefined);
		const controller = new AbortController();
		const pending = request(t, { signal: controller.signal });

		setTimeout(() => controller.abort(), 50);

		await expect(pending).rejects.toMatchObject({ category: 'cancelled' });
		await expect(request(t, { signal: controller.signal })).rejects.toMatchObject({ category: 'cancelled' });
	});

	it('rejects a header value Node refuses and leaves no timer or abort listener behind', async () => {
		const t = await open((_req, res) => res.end('{}'));
		const controller = new AbortController();
		const failure = await t
			.request({
				method: 'GET',
				path: '/x',
				headers: { 'X-API-KEY': 'key\nvalue', Accept: 'application/json' },
				timeoutMs: 50,
				maxBytes: 1024,
				signal: controller.signal,
			})
			.catch((error: unknown) => error);

		expect((failure as { code?: string }).code).toBe('ERR_INVALID_CHAR');
		expect((failure as Error).message).not.toContain('value');

		// Neither the timer nor a late abort may reach the request that was never created.
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(() => controller.abort()).not.toThrow();
		expect(server?.requests).toHaveLength(0);
	});

	it('test server closes at once while a client is still negotiating TLS', async () => {
		await open((_req, res) => res.end('{}'));

		const raw = net.connect(server?.port ?? 0, '127.0.0.1');

		raw.on('error', () => undefined);
		await new Promise((resolve) => raw.once('connect', resolve));

		const startedAt = Date.now();

		// No TLS bytes are sent, so the connection never reaches `secureConnection`.
		await server?.close();
		server = undefined;

		expect(Date.now() - startedAt).toBeLessThan(1000);
		raw.destroy();
	});

	it('reports a connection closed mid-response with the raw reset code', async () => {
		const t = await open((req) => req.socket.destroy());

		await expect(request(t)).rejects.toMatchObject({ code: 'ECONNRESET' });
	});

	it('fails a body cut short as a protocol error or a reset', async () => {
		const t = await open((req, res) => {
			res.writeHead(200, { 'Content-Length': '100' });
			res.write('short');
			setTimeout(() => req.socket.destroy(), 20);
		});
		const error = (await request(t).catch((e: unknown) => e)) as { category?: string; code?: string };

		expect(error.category === 'protocol' || error.code === 'ECONNRESET').toBe(true);
	});
});
