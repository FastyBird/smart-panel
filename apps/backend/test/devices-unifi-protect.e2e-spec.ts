import { useContainer } from 'class-validator';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'fs';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { inspect } from 'util';

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { createGlobalExceptionFilters } from '../src/common/filters/global-filters';
import { ValidationExceptionFactory } from '../src/common/validation/validation-exception-factory';
import { ManagedServiceManagerService } from '../src/modules/extensions/services/managed-service-manager.service';
import { FactoryResetRegistryService } from '../src/modules/system/services/factory-reset-registry.service';
import { UserRole } from '../src/modules/users/users.constants';
import {
	DEVICES_UNIFI_PROTECT_PLUGIN_NAME,
	DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX,
	PROTECT_TRUSTED_CA,
} from '../src/plugins/devices-unifi-protect/devices-unifi-protect.constants';
import { DevicesUnifiProtectPlugin } from '../src/plugins/devices-unifi-protect/devices-unifi-protect.plugin';
import {
	PROTECT_ERROR_MESSAGES,
	ProtectErrorCategory,
} from '../src/plugins/devices-unifi-protect/errors/protect-api.error';

import { FAKE_PROTECT_ALIAS, FAKE_PROTECT_API_KEY, FakeProtectServer } from './support/fake-protect-server';
import { PROTECT_TEST_DIRECT_DOMAIN, PROTECT_TEST_TLS } from './support/protect-tls';

const PROTECT_SENTINEL_KEY = 'PROTECT_SENTINEL_KEY_7f3a9c0d1e2b4a6f';
const SENTINELS = [PROTECT_SENTINEL_KEY, 'SENTINELALIAS', FAKE_PROTECT_ALIAS];
const FIXTURES = join(__dirname, '..', 'src', 'plugins', 'devices-unifi-protect', '__fixtures__');
const READINESS_IP_NAME_TEXT = 'TLS server name is required when the host is an IP address';

interface StatusData {
	service_state: string;
	connection_state: string;
	enabled: boolean;
	configured: boolean;
	healthy: boolean;
	host: string | null;
	tls_mode: string;
	application_version: string | null;
	minimum_version: string;
	nvr_name: string | null;
	last_error_category: string | null;
	last_error: string | null;
	reconnect_attempt: number;
	next_retry_at: string | null;
}

interface TestData {
	mode: string;
	success: boolean;
	tls_mode: string | null;
	certificate: {
		fingerprint_sha256: string;
		trusted: boolean;
		self_signed: boolean;
	} | null;
	direct_connect_domain: string | null;
	suggested_server_name: string | null;
	application_version: string | null;
	version_supported: boolean | null;
	nvr_name: string | null;
	error_category: string | null;
	error: string | null;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const colonUpper = (fingerprint: string): string => (fingerprint.match(/../g) ?? []).join(':').toUpperCase();

const listFiles = (directory: string): string[] =>
	readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);

		return statSync(path).isDirectory() ? listFiles(path) : [path];
	});

describe('UniFi Protect plugin (e2e)', () => {
	const api = '/api/v1';
	const base = `${api}/plugins/${DEVICES_UNIFI_PROTECT_PLUGIN_PREFIX}`;
	const statusUrl = `${base}/status`;
	const testUrl = `${base}/test-connection`;
	const configUrl = `${api}/modules/config/config/plugin/${DEVICES_UNIFI_PROTECT_PLUGIN_NAME}`;
	const servicesUrl = `${api}/modules/extensions/services`;

	const selfSignedFingerprint = PROTECT_TEST_TLS.fingerprints.selfSigned;
	const nvrName = (JSON.parse(readFileSync(join(FIXTURES, 'nvrs.json'), 'utf8')) as { name: string }).name;

	let app: NestFastifyApplication;
	let fake: FakeProtectServer;
	let configDirectory: string;
	let originalConfigPath: string | undefined;
	let ownerToken: string;
	let userToken: string;
	let logSpies: jest.SpyInstance[] = [];
	let emitSpies: jest.SpyInstance[] = [];
	let writesSeen = 0;
	let forbiddenSeen = 0;
	// Every response the suite received, inspected for the sentinels at the end.
	const observed: unknown[] = [];

	const record = <T extends { body: unknown; text: string; headers: unknown }>(response: T): T => {
		observed.push([response.body, response.text, response.headers]);

		return response;
	};

	const get = async (path: string, token: string) =>
		record(await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`));

	const post = async (path: string, token: string, body: Record<string, unknown>) =>
		record(await request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`).send(body));

	const patchConfig = async (data: Record<string, unknown>) =>
		record(
			await request(app.getHttpServer())
				.patch(configUrl)
				.set('Authorization', `Bearer ${ownerToken}`)
				.send({ data: { type: DEVICES_UNIFI_PROTECT_PLUGIN_NAME, ...data } }),
		);

	const status = async (): Promise<StatusData> => ((await get(statusUrl, userToken)).body as { data: StatusData }).data;

	/** Polls `GET status` every 100 ms for up to 5 s until the predicate holds. */
	const awaitStatus = async (predicate: (data: StatusData) => boolean, what: string): Promise<StatusData> => {
		const deadline = Date.now() + 5000;
		let last = await status();

		while (!predicate(last)) {
			if (Date.now() > deadline) {
				throw new Error(`Timed out waiting for ${what}; last state ${JSON.stringify(last)}`);
			}

			await sleep(100);
			last = await status();
		}

		return last;
	};

	const testConnection = async (data: Record<string, unknown>) => {
		const response = await post(testUrl, ownerToken, { data });

		return { response, data: (response.body as { data: TestData }).data };
	};

	const candidate = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
		mode: 'candidate',
		host: fake.host,
		port: fake.port,
		api_key: FAKE_PROTECT_API_KEY,
		...overrides,
	});

	const pinnedSelfSigned = { mode: 'pinned', fingerprint_sha256: selfSignedFingerprint };

	const keyedRequests = () => fake.requests.filter((r) => r.hadApiKey);

	const metaInfoRequests = () => fake.requests.filter((r) => r.path.endsWith('/meta/info')).length;

	const savedConfig = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
		enabled: true,
		host: fake.host,
		port: fake.port,
		api_key: FAKE_PROTECT_API_KEY,
		tls: { mode: 'pinned', fingerprint_sha256: colonUpper(selfSignedFingerprint) },
		...overrides,
	});

	const closedPort = (): Promise<number> =>
		new Promise((resolve, reject) => {
			const server = createServer();

			server.once('error', reject);
			server.listen(0, '127.0.0.1', () => {
				const { port } = server.address() as { port: number };

				server.close(() => resolve(port));
			});
		});

	beforeAll(async () => {
		// Set before the app module is compiled: the PATCH requests persist the plugin configuration (with the key)
		// into this directory instead of the repository's data directory.
		configDirectory = mkdtempSync(join(tmpdir(), 'unifi-protect-e2e-'));
		originalConfigPath = process.env.FB_CONFIG_PATH;
		process.env.FB_CONFIG_PATH = configDirectory;

		// Every log call and emitted event of the suite is inspected at the end; the spies live until `afterAll`.
		logSpies = (['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const).map((method) =>
			jest.spyOn(Logger.prototype, method).mockImplementation(),
		);
		emitSpies = (['emit', 'emitAsync'] as const).map((method) => jest.spyOn(EventEmitter2.prototype, method));

		fake = await FakeProtectServer.start();

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
			.overrideProvider(PROTECT_TRUSTED_CA)
			.useValue(PROTECT_TEST_TLS.ca)
			.compile();

		app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

		// Mirror the production wiring of main.ts so error responses have their real shape.
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
		await sleep(100);

		await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/register`)
			.send({ data: { username: 'protowner', password: 'securePassword123!', email: 'protowner@example.com' } });

		const ownerLogin = await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/login`)
			.send({ data: { username: 'protowner', password: 'securePassword123!' } });

		ownerToken = (ownerLogin.body as { data: { access_token: string } }).data.access_token;

		await request(app.getHttpServer())
			.post(`${api}/modules/users/users`)
			.set('Authorization', `Bearer ${ownerToken}`)
			.send({
				data: {
					username: 'protuser',
					password: 'securePassword123!',
					email: 'protuser@example.com',
					role: UserRole.USER,
				},
			});

		const userLogin = await request(app.getHttpServer())
			.post(`${api}/modules/auth/auth/login`)
			.send({ data: { username: 'protuser', password: 'securePassword123!' } });

		userToken = (userLogin.body as { data: { access_token: string } }).data.access_token;
	}, 120_000);

	afterAll(async () => {
		await app?.close();
		await fake?.stop();

		logSpies.forEach((spy) => spy.mockRestore());
		emitSpies.forEach((spy) => spy.mockRestore());

		rmSync(configDirectory, { recursive: true, force: true });

		if (originalConfigPath === undefined) {
			delete process.env.FB_CONFIG_PATH;
		} else {
			process.env.FB_CONFIG_PATH = originalConfigPath;
		}
	});

	beforeEach(() => {
		writesSeen += fake.writes.length;
		forbiddenSeen += fake.forbiddenHits;
		fake.reset();
		fake.set({ applicationVersion: null, apiKey: FAKE_PROTECT_API_KEY });
	});

	it('boots the plugin module with its managed service and factory-reset handler resolved by Nest', () => {
		expect(app.get(DevicesUnifiProtectPlugin)).toBeInstanceOf(DevicesUnifiProtectPlugin);
		expect(app.get(FactoryResetRegistryService).has(DEVICES_UNIFI_PROTECT_PLUGIN_NAME)).toBe(true);
		expect(app.get(ManagedServiceManagerService)).toBeInstanceOf(ManagedServiceManagerService);
	});

	it('reports a disabled, unconfigured provider to a user before configuration', async () => {
		const response = await get(statusUrl, userToken);

		expect(response.status).toBe(200);
		expect((response.body as { data: StatusData }).data).toMatchObject({
			enabled: false,
			configured: false,
			connection_state: 'disconnected',
			minimum_version: '7.2.105',
		});
	});

	it('stops a candidate with an IP host and the default TLS before any key is sent', async () => {
		const { response, data } = await testConnection(candidate());

		expect(response.status).toBe(200);
		expect(data).toMatchObject({
			mode: 'candidate',
			success: false,
			tls_mode: 'verify',
			error_category: 'tls_untrusted',
			error: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.TLS_UNTRUSTED],
			direct_connect_domain: PROTECT_TEST_DIRECT_DOMAIN,
			suggested_server_name: PROTECT_TEST_DIRECT_DOMAIN,
			certificate: { fingerprint_sha256: selfSignedFingerprint, trusted: false, self_signed: true },
		});
		expect(fake.requests.length).toBeGreaterThan(0);
		expect(keyedRequests()).toEqual([]);
	});

	it('verifies the console certificate under the confirmed server name and reads the console', async () => {
		const { data } = await testConnection(
			candidate({ tls: { mode: 'verify', server_name: PROTECT_TEST_DIRECT_DOMAIN } }),
		);

		expect(data).toMatchObject({
			success: true,
			certificate: { trusted: true, self_signed: false },
			application_version: '7.3.74',
			version_supported: true,
			nvr_name: nvrName,
			error_category: null,
		});
		expect(keyedRequests().length).toBeGreaterThan(0);
	});

	it('accepts a candidate pinned to the presented self-signed fingerprint', async () => {
		const { data } = await testConnection(candidate({ tls: pinnedSelfSigned }));

		expect(data).toMatchObject({
			success: true,
			tls_mode: 'pinned',
			certificate: { fingerprint_sha256: selfSignedFingerprint, trusted: false },
			nvr_name: nvrName,
		});
	});

	it('accepts the pin in colon-separated upper case', async () => {
		const { data } = await testConnection(
			candidate({ tls: { mode: 'pinned', fingerprint_sha256: colonUpper(selfSignedFingerprint) } }),
		);

		expect(data.success).toBe(true);
	});

	it('refuses a pin that names a different certificate and sends no key', async () => {
		const { data } = await testConnection(
			candidate({ tls: { mode: 'pinned', fingerprint_sha256: PROTECT_TEST_TLS.fingerprints.console } }),
		);

		expect(data).toMatchObject({
			success: false,
			error_category: 'tls_fingerprint_mismatch',
			certificate: { fingerprint_sha256: selfSignedFingerprint },
		});
		expect(keyedRequests()).toEqual([]);
	});

	it('reports a wrong key as an authentication failure', async () => {
		const { data } = await testConnection(candidate({ api_key: 'wrong-key-0000', tls: pinnedSelfSigned }));

		expect(data).toMatchObject({
			success: false,
			error_category: 'authentication',
			error: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.AUTHENTICATION],
		});
	});

	it('reports a console older than the minimum version with the observed version', async () => {
		fake.set({ applicationVersion: '7.2.104' });

		const { data } = await testConnection(candidate({ tls: pinnedSelfSigned }));

		expect(data).toMatchObject({
			success: false,
			error_category: 'version_unsupported',
			application_version: '7.2.104',
			version_supported: false,
			nvr_name: null,
		});
	});

	it('rejects a candidate without a new key and never falls back to a stored one', async () => {
		const response = await post(testUrl, ownerToken, {
			data: { mode: 'candidate', host: fake.host, port: fake.port, tls: pinnedSelfSigned },
		});

		expect(response.status).toBe(400);
		expect(fake.requests).toEqual([]);
	});

	it('rejects an unknown TLS mode in a plugin config update and leaves the config unchanged', async () => {
		const before = (await get(configUrl, ownerToken)).body as { data: Record<string, unknown> };
		const rejected = await patchConfig({ tls: { mode: 'insecure' } });
		const after = (await get(configUrl, ownerToken)).body as { data: Record<string, unknown> };

		expect(rejected.status).toBe(400);
		expect(after.data).toEqual(before.data);
		expect(after.data).toMatchObject({ enabled: false, tls: { mode: 'verify' } });
	});

	it('rejects a saved-mode request that carries a host (validation pipe) and contacts no console', async () => {
		const response = await post(testUrl, ownerToken, { data: { mode: 'saved', host: fake.host } });

		expect(response.status).toBe(400);
		expect(fake.requests).toEqual([]);
	});

	it('reports validation for the saved mode before a key is stored and contacts no console', async () => {
		const { response, data } = await testConnection({ mode: 'saved' });

		expect(response.status).toBe(200);
		expect(data).toMatchObject({
			mode: 'saved',
			success: false,
			error_category: 'validation',
			error: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.VALIDATION],
			certificate: null,
		});
		expect(fake.requests).toEqual([]);
	});

	it('refuses test-connection to a user-role token', async () => {
		const response = await post(testUrl, userToken, { data: { mode: 'saved' } });

		expect(response.status).toBe(403);
		expect(fake.requests).toEqual([]);
	});

	it('connects after the configuration is saved, never returning the key', async () => {
		const saved = await patchConfig(savedConfig());

		expect(saved.status).toBe(200);

		const config = (await get(configUrl, ownerToken)).body as { data: Record<string, unknown> };

		expect(config.data).toMatchObject({
			enabled: true,
			host: fake.host,
			api_key_configured: true,
			tls: { mode: 'pinned', fingerprint_sha256: selfSignedFingerprint },
		});
		expect(config.data).not.toHaveProperty('api_key');

		const connected = await awaitStatus((data) => data.connection_state === 'connected', 'connected');

		expect(connected).toMatchObject({
			service_state: 'started',
			healthy: true,
			configured: true,
			nvr_name: nvrName,
			application_version: '7.3.74',
			tls_mode: 'pinned',
			last_error_category: null,
			next_retry_at: null,
		});

		// The saved configuration tests fine against the live console as well.
		const { data } = await testConnection({ mode: 'saved' });

		expect(data).toMatchObject({ mode: 'saved', success: true, tls_mode: 'pinned', nvr_name: nvrName });
	});

	it('reports version_unsupported for a console older than 7.2.105', async () => {
		await patchConfig({ enabled: false });
		await awaitStatus((data) => data.service_state === 'stopped', 'the connector to stop');

		fake.set({ applicationVersion: '7.2.104' });
		await patchConfig(savedConfig());

		const unsupported = await awaitStatus(
			(data) => data.connection_state === 'version_unsupported',
			'version_unsupported',
		);

		expect(unsupported).toMatchObject({
			healthy: false,
			application_version: '7.2.104',
			last_error_category: 'version_unsupported',
			last_error: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.VERSION_UNSUPPORTED],
		});
	});

	it('stops at auth_failed for a wrong key and does not retry', async () => {
		await patchConfig({ api_key: 'wrong-key-0000' });

		const failed = await awaitStatus((data) => data.connection_state === 'auth_failed', 'auth_failed');

		expect(failed).toMatchObject({
			last_error_category: 'authentication',
			last_error: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.AUTHENTICATION],
			next_retry_at: null,
		});

		const requestsAtFailure = metaInfoRequests();

		expect(requestsAtFailure).toBeGreaterThan(0);

		await sleep(3000);

		expect(metaInfoRequests()).toBe(requestsAtFailure);
		expect((await status()).connection_state).toBe('auth_failed');
	});

	it('reports a not-ready saved configuration with the fixed readiness text and contacts no console', async () => {
		const saved = await patchConfig(
			savedConfig({ api_key: FAKE_PROTECT_API_KEY, tls: { mode: 'verify', server_name: null } }),
		);

		expect(saved.status).toBe(200);

		const notReady = await awaitStatus(
			(data) => data.last_error === READINESS_IP_NAME_TEXT,
			'the readiness text in the status',
		);

		expect(notReady).toMatchObject({
			connection_state: 'disconnected',
			healthy: false,
			enabled: true,
			last_error_category: 'validation',
			last_error: READINESS_IP_NAME_TEXT,
			next_retry_at: null,
		});

		await sleep(300);

		expect(fake.requests).toEqual([]);
	});

	it('backs off and reports unreachable when the console port is closed', async () => {
		const port = await closedPort();

		await patchConfig(savedConfig({ port }));

		const unreachable = await awaitStatus(
			(data) =>
				data.connection_state === 'disconnected' &&
				data.last_error_category === 'unreachable' &&
				data.next_retry_at !== null,
			'an unreachable console with a scheduled retry',
		);

		expect(unreachable).toMatchObject({
			healthy: false,
			last_error: PROTECT_ERROR_MESSAGES[ProtectErrorCategory.UNREACHABLE],
		});
		expect(unreachable.reconnect_attempt).toBeGreaterThanOrEqual(1);
		expect(Number.isNaN(Date.parse(String(unreachable.next_retry_at)))).toBe(false);
	});

	it('keeps the key out of the managed service status', async () => {
		const response = await get(servicesUrl, userToken);
		const entries = (response.body as { data: Record<string, unknown>[] }).data;
		const connector = entries.find(
			(entry) => entry.extension_type === DEVICES_UNIFI_PROTECT_PLUGIN_NAME && entry.service_id === 'connector',
		);

		expect(response.status).toBe(200);
		expect(connector).toBeDefined();
		expect(connector).toMatchObject({ extension_kind: 'plugin', enabled: true });
		expect(JSON.stringify(connector)).not.toContain(PROTECT_SENTINEL_KEY);
	});

	it('never leaked a secret, wrote to the console or touched a forbidden endpoint', () => {
		writesSeen += fake.writes.length;
		forbiddenSeen += fake.forbiddenHits;

		const spied = inspect(
			[logSpies.map((spy): unknown => spy.mock.calls), emitSpies.map((spy): unknown => spy.mock.calls), observed],
			{ depth: null, maxArrayLength: null, maxStringLength: null, breakLength: Infinity },
		);

		for (const sentinel of SENTINELS) {
			expect(spied).not.toContain(sentinel);
		}

		// The spies saw real traffic, so the checks above are not vacuous.
		expect(spied).toContain('UniFi Protect connected (Protect 7.3.74)');
		expect(spied).toContain('UniFi Protect connection stopped (authentication)');
		expect(spied).toContain(selfSignedFingerprint);
		expect(logSpies.some((spy) => spy.mock.calls.length > 0)).toBe(true);
		expect(emitSpies.some((spy) => spy.mock.calls.length > 0)).toBe(true);
		expect(observed.length).toBeGreaterThan(10);
		expect(writesSeen).toBe(0);
		expect(forbiddenSeen).toBe(0);

		const files = listFiles(configDirectory);
		const withKey = files.filter((file) => readFileSync(file).toString('latin1').includes(PROTECT_SENTINEL_KEY));

		expect(files.length).toBeGreaterThan(0);
		expect(withKey.map((file) => file.slice(configDirectory.length + 1))).toEqual(['config.yaml']);
	});
});
