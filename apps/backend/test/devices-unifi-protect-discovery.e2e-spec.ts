import { useContainer } from 'class-validator';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import * as https from 'https';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { createGlobalExceptionFilters } from '../src/common/filters/global-filters';
import { ValidationExceptionFactory } from '../src/common/validation/validation-exception-factory';
import { UserRole } from '../src/modules/users/users.constants';
import { DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX } from '../src/plugins/devices-unifi-protect/devices-unifi-protect.constants';
import { DevicesUnifiProtectPlugin } from '../src/plugins/devices-unifi-protect/devices-unifi-protect.plugin';
import {
	NodeProtectProbeTransport,
	ProtectCertificateCheck,
	ProtectProbeTarget,
} from '../src/plugins/devices-unifi-protect/services/protect-discovery-probe.transport';
import {
	PROTECT_DISCOVERY_ENVIRONMENT,
	PROTECT_DISCOVERY_REQUEST_V1,
	PROTECT_PROBE_TRANSPORT,
} from '../src/plugins/devices-unifi-protect/services/protect-discovery.constants';

import { FakeUdpSocket, createFakeDiscoveryEnvironment } from './support/fake-udp-socket';
import { PROTECT_TEST_TLS, protectTlsServerOptions } from './support/protect-tls';

const FIXTURES = join(__dirname, '..', 'src', 'plugins', 'devices-unifi-protect', '__fixtures__');

interface ProbeData {
	status: string;
	failure: string | null;
	protect: string;
	preferred_host: string | null;
	certificate: { valid: boolean | null; error_code: string | null } | null;
}

interface ScanData {
	status: string;
	consoles: { model: string; hostname: string; probe: ProbeData }[];
	other_unifi_devices: number;
}

describe('UniFi Protect discovery (e2e)', () => {
	const api = '/api/v1';
	const base = `${api}/plugins/${DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX}/discovery`;
	const routes = [
		{ method: 'get', path: base },
		{ method: 'post', path: `${base}/scan` },
		{ method: 'post', path: `${base}/probe` },
	] as const;

	let app: NestFastifyApplication;
	let server: https.Server;
	let serverPort: number;
	let httpsRequests = 0;
	let sockets: FakeUdpSocket[] = [];
	let ownerToken: string;
	let userToken: string;
	let configDirectory: string;
	let originalConfigPath: string | undefined;
	let logSpies: jest.SpyInstance[] = [];

	/** Sends every probe aimed at port 443 to the local HTTPS server; other ports pass through. */
	class LocalProbeTransport extends NodeProtectProbeTransport {
		private rewrite(target: ProtectProbeTarget): ProtectProbeTarget {
			return target.port === 443 ? { host: target.host, port: serverPort } : target;
		}

		get(target: ProtectProbeTarget, path: string, timeoutMs: number) {
			return super.get(this.rewrite(target), path, timeoutMs);
		}

		checkCertificate(
			target: ProtectProbeTarget,
			servername: string,
			timeoutMs: number,
		): Promise<ProtectCertificateCheck> {
			return super.checkCertificate(this.rewrite(target), servername, timeoutMs);
		}

		resolveAll(): Promise<string[]> {
			return Promise.resolve<string[]>([]);
		}
	}

	const send = (method: 'get' | 'post', path: string, token?: string, body?: Record<string, unknown>) => {
		const req = request(app.getHttpServer())[method](path);

		if (token) {
			void req.set('Authorization', `Bearer ${token}`);
		}

		return body ? req.send(body) : req;
	};

	const closedPort = (): Promise<number> =>
		new Promise((resolve, reject) => {
			const probe = createServer();

			probe.once('error', reject);
			probe.listen(0, '127.0.0.1', () => {
				const { port } = probe.address() as { port: number };

				probe.close(() => resolve(port));
			});
		});

	beforeAll(async () => {
		// The module configuration is persisted into this directory instead of the repository's data directory.
		configDirectory = mkdtempSync(join(tmpdir(), 'unifi-protect-discovery-e2e-'));
		originalConfigPath = process.env.FB_CONFIG_PATH;
		process.env.FB_CONFIG_PATH = configDirectory;

		logSpies = (['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation(),
		);

		const system = readFileSync(join(FIXTURES, 'system.json'));

		server = https.createServer(protectTlsServerOptions(), (req, res) => {
			httpsRequests += 1;

			if (req.url === '/api/system') {
				res.writeHead(200, { 'Content-Type': 'application/json' }).end(system);
			} else if (req.url === '/proxy/protect/api') {
				res.writeHead(401).end();
			} else {
				res.writeHead(404).end();
			}
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		serverPort = (server.address() as { port: number }).port;

		const reply = readFileSync(join(FIXTURES, 'discovery-reply.bin'));
		const fake = createFakeDiscoveryEnvironment({
			interfaces: {
				en0: [
					{
						address: '192.168.1.20',
						netmask: '255.255.255.0',
						family: 'IPv4',
						internal: false,
						mac: '00:00:00:00:00:00',
						cidr: null,
					},
				],
			},
			onSend: (socket, msg) => {
				if (msg.equals(PROTECT_DISCOVERY_REQUEST_V1)) {
					socket.reply(reply, '127.0.0.1');
				}
			},
		});

		sockets = fake.sockets;

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				AppModule.register({
					moduleExtensions: [],
					pluginExtensions: [
						{ routePrefix: DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX, extensionClass: DevicesUnifiProtectPlugin },
					],
				}),
			],
		})
			.overrideProvider(PROTECT_DISCOVERY_ENVIRONMENT)
			.useValue(fake.env)
			.overrideProvider(PROTECT_PROBE_TRANSPORT)
			.useValue(new LocalProbeTransport({ extraCa: PROTECT_TEST_TLS.ca }))
			.compile();

		app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

		app.useGlobalFilters(...createGlobalExceptionFilters(moduleFixture.get(ConfigService)));
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
				transformOptions: { enableImplicitConversion: true },
				exceptionFactory: (errors) => ValidationExceptionFactory.createException(errors),
			}),
		);
		app.setGlobalPrefix('api');
		app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
		useContainer(moduleFixture, { fallbackOnErrors: true });

		await app.init();
		await app.getHttpAdapter().getInstance().ready();

		await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/register`)
			.send({ data: { username: 'discowner', password: 'securePassword123!', email: 'discowner@example.com' } });

		const ownerLogin = await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/login`)
			.send({ data: { username: 'discowner', password: 'securePassword123!' } });

		ownerToken = (ownerLogin.body as { data: { access_token: string } }).data.access_token;

		await request(app.getHttpServer())
			.post(`${api}/modules/users/users`)
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({
				data: {
					username: 'discuser',
					password: 'securePassword123!',
					email: 'discuser@example.com',
					role: UserRole.USER,
				},
			});

		const userLogin = await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/login`)
			.send({ data: { username: 'discuser', password: 'securePassword123!' } });

		userToken = (userLogin.body as { data: { access_token: string } }).data.access_token;
	}, 120_000);

	afterAll(async () => {
		await app?.close();
		sockets.forEach((socket) => {
			if (!socket.closed) {
				socket.close();
			}
		});
		server?.closeAllConnections();
		await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));

		logSpies.forEach((spy) => spy.mockRestore());
		rmSync(configDirectory, { recursive: true, force: true });

		if (originalConfigPath === undefined) {
			delete process.env.FB_CONFIG_PATH;
		} else {
			process.env.FB_CONFIG_PATH = originalConfigPath;
		}
	});

	it('rejects unauthenticated requests with 401 on all three routes', async () => {
		for (const route of routes) {
			const response = await send(route.method, route.path, undefined, { data: { host: '127.0.0.1' } });

			expect([route.path, response.status]).toEqual([route.path, 401]);
		}
	});

	it('rejects a USER with 403 on all three routes', async () => {
		for (const route of routes) {
			const response = await send(route.method, route.path, userToken, { data: { host: '127.0.0.1' } });

			expect([route.path, response.status]).toEqual([route.path, 403]);
		}

		expect(httpsRequests).toBe(0);
	});

	it('returns an idle scan before any scan ran', async () => {
		const response = await send('get', base, ownerToken);

		expect(response.status).toBe(200);
		expect((response.body as { data: ScanData }).data).toMatchObject({
			status: 'idle',
			consoles: [],
			other_unifi_devices: 0,
		});
	});

	it('scans through the fake network and lists the console with a real probe', async () => {
		const response = await send('post', `${base}/scan`, ownerToken);
		const data = (response.body as { data: ScanData }).data;

		expect(response.status).toBe(200);
		expect(data.status).toBe('completed');
		expect(data.consoles).toHaveLength(1);
		expect(data.consoles[0]).toMatchObject({
			model: 'UNVR',
			hostname: 'Dream-Machine-Pro',
			probe: {
				status: 'console',
				protect: 'present',
				certificate: { valid: false },
				preferred_host: '127.0.0.1',
			},
		});

		const last = await send('get', base, ownerToken);

		expect((last.body as { data: ScanData }).data).toEqual(data);
	}, 60_000);

	it('probes a manually entered host and reports an untrusted certificate', async () => {
		const response = await send('post', `${base}/probe`, ownerToken, {
			data: { host: '127.0.0.1', port: serverPort },
		});
		const data = (response.body as { data: ProbeData }).data;

		expect(response.status).toBe(200);
		expect(data).toMatchObject({
			status: 'console',
			protect: 'present',
			preferred_host: '127.0.0.1',
			certificate: { error_code: 'DEPTH_ZERO_SELF_SIGNED_CERT' },
		});
	});

	it('reports a closed port as a 200 unreachable result', async () => {
		const response = await send('post', `${base}/probe`, ownerToken, {
			data: { host: '127.0.0.1', port: await closedPort() },
		});
		const data = (response.body as { data: ProbeData }).data;

		expect(response.status).toBe(200);
		expect(data).toMatchObject({ status: 'unreachable', failure: 'connection_refused', preferred_host: null });
	});

	it.each(['http://127.0.0.1', '127.0.0.1/api', '169.254.169.254', '', true])(
		'rejects host %j with 400',
		async (host) => {
			const before = httpsRequests;
			const response = await send('post', `${base}/probe`, ownerToken, { data: { host, port: serverPort } });

			expect(response.status).toBe(400);
			expect(httpsRequests).toBe(before);
		},
	);

	it('rejects an unknown body property with 400', async () => {
		const before = httpsRequests;
		const response = await send('post', `${base}/probe`, ownerToken, {
			data: { host: '127.0.0.1', port: serverPort, api_key: 'x' },
		});

		expect(response.status).toBe(400);
		expect(httpsRequests).toBe(before);
	});
});
