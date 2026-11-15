import * as http from 'http';
import * as https from 'https';
import { AddressInfo } from 'net';
import * as net from 'net';

import { PROTECT_TEST_TLS, protectTlsServerOptions } from '../../../../test/support/protect-tls';
import { PROTECT_TEST_DIRECT_DOMAIN } from '../../../../test/support/protect-tls';

import { NodeProtectProbeTransport } from './protect-discovery-probe.transport';

type Closable = { close: (cb?: () => void) => unknown; closeAllConnections?: () => void };

describe('NodeProtectProbeTransport', () => {
	const servers: Closable[] = [];
	const transport = new NodeProtectProbeTransport();

	const listen = async <T extends Closable & { listen: (...args: any[]) => unknown; address: () => unknown }>(
		server: T,
	): Promise<{ host: string; port: number }> => {
		servers.push(server);
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

		return { host: '127.0.0.1', port: (server.address() as AddressInfo).port };
	};

	afterEach(async () => {
		await Promise.all(
			servers.splice(0).map(
				(server) =>
					new Promise<void>((resolve) => {
						server.closeAllConnections?.();
						server.close(() => resolve());
					}),
			),
		);
	});

	describe('get', () => {
		it('get returns status and body from a self-signed server', async () => {
			const target = await listen(
				https.createServer(protectTlsServerOptions(), (_req, res) => {
					res.writeHead(200);
					res.end('{"a":1}');
				}),
			);

			await expect(transport.get(target, '/api/system', 300)).resolves.toEqual({
				ok: true,
				statusCode: 200,
				body: '{"a":1}',
			});
		});

		it('get sends no credentials and only the documented headers', async () => {
			let headers: http.IncomingHttpHeaders = {};
			const target = await listen(
				https.createServer(protectTlsServerOptions(), (req, res) => {
					headers = req.headers;
					res.end('{}');
				}),
			);

			await transport.get(target, '/api/system', 300);

			expect(headers['authorization']).toBeUndefined();
			expect(headers['x-api-key']).toBeUndefined();
			expect(headers['accept']).toBe('application/json');
		});

		it('get does not follow a redirect', async () => {
			let hits = 0;
			const target = await listen(
				https.createServer(protectTlsServerOptions(), (_req, res) => {
					hits++;
					res.writeHead(302, { Location: '/x' });
					res.end();
				}),
			);
			const result = await transport.get(target, '/api/system', 300);

			expect(result).toMatchObject({ ok: true, statusCode: 302 });
			expect(hits).toBe(1);
		});

		it('get fails with kind timeout when the server accepts and never answers', async () => {
			const target = await listen(https.createServer(protectTlsServerOptions(), () => undefined));

			await expect(transport.get(target, '/api/system', 200)).resolves.toMatchObject({
				ok: false,
				kind: 'timeout',
			});
		});

		it('get fails with kind timeout when the server dribbles the body past the overall deadline', async () => {
			let timer: NodeJS.Timeout | undefined;
			const target = await listen(
				https.createServer(protectTlsServerOptions(), (_req, res) => {
					res.writeHead(200);
					timer = setInterval(() => res.write('x'), 50);
					res.on('close', () => clearInterval(timer));
				}),
			);

			await expect(transport.get(target, '/api/system', 200)).resolves.toMatchObject({
				ok: false,
				kind: 'timeout',
			});
			clearInterval(timer);
		});

		it('get fails with kind refused for a closed port', async () => {
			const server = net.createServer();
			const target = await listen(server);

			await new Promise<void>((resolve) => server.close(() => resolve()));
			servers.pop();

			await expect(transport.get(target, '/api/system', 300)).resolves.toMatchObject({
				ok: false,
				kind: 'refused',
			});
		});

		it('get fails with kind protocol when the body exceeds 65536 bytes', async () => {
			let closed = false;
			const target = await listen(
				https.createServer(protectTlsServerOptions(), (req, res) => {
					req.socket.on('close', () => (closed = true));
					res.writeHead(200);
					res.write(Buffer.alloc(40000, 'a'));
					res.write(Buffer.alloc(40000, 'a'));
				}),
			);

			await expect(transport.get(target, '/api/system', 300)).resolves.toEqual({
				ok: false,
				kind: 'protocol',
				code: 'body_too_large',
			});
			await new Promise((resolve) => setTimeout(resolve, 50));
			expect(closed).toBe(true);
		});

		it('get fails with kind tls when the port speaks plain HTTP', async () => {
			const target = await listen(
				net.createServer((socket) => {
					socket.on('error', () => undefined);
					socket.end('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n', () => socket.destroy());
				}),
			);

			await expect(transport.get(target, '/api/system', 300)).resolves.toMatchObject({ ok: false, kind: 'tls' });
		});
	});

	describe('checkCertificate', () => {
		it('checkCertificate is valid when the certificate is trusted and names the servername', async () => {
			const target = await listen(https.createServer(protectTlsServerOptions()));
			const trusting = new NodeProtectProbeTransport({ extraCa: PROTECT_TEST_TLS.ca });
			const result = await trusting.checkCertificate(target, PROTECT_TEST_DIRECT_DOMAIN, 300);

			expect(result).toMatchObject({ ok: true, valid: true, errorCode: null });
			expect(result).toHaveProperty('validTo');

			const validTo = (result as { validTo: string }).validTo;

			expect(new Date(validTo).toISOString()).toBe(validTo);
			expect(new Date(validTo).getTime()).toBeGreaterThan(Date.now());
		});

		it('checkCertificate reports DEPTH_ZERO_SELF_SIGNED_CERT without extraCa', async () => {
			const target = await listen(https.createServer(protectTlsServerOptions()));

			await expect(transport.checkCertificate(target, 'other.test', 300)).resolves.toEqual({
				ok: true,
				valid: false,
				errorCode: 'DEPTH_ZERO_SELF_SIGNED_CERT',
				validTo: null,
			});
		});

		it('checkCertificate reports ERR_TLS_CERT_ALTNAME_INVALID for another servername', async () => {
			// The CA-signed certificate under every SNI, so only the name check can fail.
			const target = await listen(https.createServer({ ...PROTECT_TEST_TLS.console }));
			const trusting = new NodeProtectProbeTransport({ extraCa: PROTECT_TEST_TLS.ca });

			await expect(trusting.checkCertificate(target, 'other.test', 300)).resolves.toEqual({
				ok: true,
				valid: false,
				errorCode: 'ERR_TLS_CERT_ALTNAME_INVALID',
				validTo: null,
			});
		});

		it('checkCertificate fails with kind refused for a closed port', async () => {
			const server = net.createServer();
			const target = await listen(server);

			await new Promise<void>((resolve) => server.close(() => resolve()));
			servers.pop();

			await expect(transport.checkCertificate(target, PROTECT_TEST_DIRECT_DOMAIN, 300)).resolves.toMatchObject({
				ok: false,
				kind: 'refused',
			});
		});
	});

	describe('resolveAll', () => {
		it('resolveAll returns an IP literal unchanged', async () => {
			await expect(transport.resolveAll('127.0.0.1')).resolves.toEqual(['127.0.0.1']);
		});

		it('resolveAll returns [] for a name that does not resolve', async () => {
			await expect(transport.resolveAll('nonexistent.invalid')).resolves.toEqual([]);
		});
	});
});
