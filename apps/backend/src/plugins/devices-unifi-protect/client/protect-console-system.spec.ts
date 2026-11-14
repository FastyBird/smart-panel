import { readFileSync } from 'fs';
import { join, resolve } from 'path';

import { ProtectTestServer, startProtectTestServer } from '../../../../test/support/protect-test-server';
import { ProtectApiError } from '../errors/protect-api.error';

import { fetchProtectConsoleSystem } from './protect-console-system';

const system = readFileSync(join(resolve(__dirname, '../__fixtures__'), 'system.json'), 'utf8');

describe('fetchProtectConsoleSystem', () => {
	let server: ProtectTestServer | undefined;

	afterEach(async () => {
		await server?.close();
		server = undefined;
	});

	it('reads the unauthenticated console info over an unverified connection and sends no credential', async () => {
		server = await startProtectTestServer((_req, res) => {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(system);
		});

		expect(await fetchProtectConsoleSystem({ host: '127.0.0.1', port: server.port })).toEqual({
			name: 'Dream Machine Pro',
			mac: '0CEA14003A69',
			shortname: 'UNVR',
			directConnectDomain: '0cea14000000000000000000000000000000.id.ui.direct',
			deviceState: 'setup',
		});
		expect(server.requests).toHaveLength(1);
		expect(server.requests[0].url).toBe('/api/system');
		expect(server.requests[0].method).toBe('GET');
		expect(server.requests[0].headers['x-api-key']).toBeUndefined();
		expect(server.requests[0].headers.authorization).toBeUndefined();
		expect(server.requests[0].headers.cookie).toBeUndefined();
	});

	it('tolerates missing fields', async () => {
		server = await startProtectTestServer((_req, res) => res.end('{"name":7,"hardware":null}'));

		expect(await fetchProtectConsoleSystem({ host: '127.0.0.1', port: server.port })).toEqual({
			name: null,
			mac: null,
			shortname: null,
			directConnectDomain: null,
			deviceState: null,
		});
	});

	it.each([
		['a non-JSON body', 200, '<html>', 'protocol'],
		['a JSON array', 200, '[]', 'protocol'],
		['a missing page', 404, '{}', 'not_found'],
		['a console error', 503, '{}', 'unavailable'],
	])('reports %s as ProtectApiError on the system operation', async (_name, status, body, category) => {
		server = await startProtectTestServer((_req, res) => {
			res.writeHead(status);
			res.end(body);
		});

		const error = await fetchProtectConsoleSystem({ host: '127.0.0.1', port: server.port }).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ProtectApiError);
		expect(error).toMatchObject({ category, operation: 'system' });
	});

	it('caps the body at 64 KiB', async () => {
		server = await startProtectTestServer((_req, res) => res.end(JSON.stringify({ name: 'x'.repeat(70 * 1024) })));

		await expect(fetchProtectConsoleSystem({ host: '127.0.0.1', port: server.port })).rejects.toMatchObject({
			category: 'protocol',
			operation: 'system',
		});
	});

	it('times out a silent console', async () => {
		server = await startProtectTestServer(() => undefined);

		await expect(
			fetchProtectConsoleSystem({ host: '127.0.0.1', port: server.port, timeoutMs: 150 }),
		).rejects.toMatchObject({ category: 'timeout', operation: 'system' });
	});

	it('reports a closed port as unreachable', async () => {
		server = await startProtectTestServer(() => undefined);

		const port = server.port;

		await server.close();
		server = undefined;
		await expect(fetchProtectConsoleSystem({ host: '127.0.0.1', port })).rejects.toMatchObject({
			category: 'unreachable',
			operation: 'system',
		});
	});
});
