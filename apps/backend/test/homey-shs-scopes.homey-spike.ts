import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	type HomeyScopeProbeFetch,
	type HomeyShsScopeProbeConfig,
	assertHomeyShsScopeReportSafe,
	assertHomeyShsScopeReportSchema,
	loadHomeyShsScopeProbeConfig,
	probeHomeyShsScopes,
	writeHomeyShsScopeReport,
} from './support/homey-shs-scope-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'full-read-test-key-that-must-not-leak',
	FB_HOMEY_SHS_DEVICE_ONLY_API_KEY: 'device-only-test-key-that-must-not-leak',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
	FB_HOMEY_SHS_WITHOUT_DEVICE_API_KEY: 'without-device-test-key-that-must-not-leak',
	FB_HOMEY_SHS_WITHOUT_ZONE_API_KEY: 'without-zone-test-key-that-must-not-leak',
};

const EXPECTED_REPORT = {
	metadata: { probe: 'homey-shs-permission-scopes', schemaVersion: 1 },
	scenarios: {
		missingDevicePermission: {
			allowedRequestStatusCode: 200,
			category: 'authorization',
			rejected: true,
			statusCode: 403,
		},
		missingSystemPermission: {
			allowedRequestStatusCode: 200,
			category: 'authorization',
			rejected: true,
			statusCode: 403,
		},
		missingZonePermission: {
			allowedRequestStatusCode: 200,
			category: 'authorization',
			rejected: true,
			statusCode: 403,
		},
	},
} as const;

const createConfig = (): HomeyShsScopeProbeConfig =>
	loadHomeyShsScopeProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-scope-spike');

const homeyPingResponse = (): Response =>
	new Response(null, {
		headers: { 'x-homey-id': 'synthetic-homey-id', 'x-homey-version': '13.4.1' },
		status: 200,
	});

const authorizationToken = (init: RequestInit): string | null => {
	const authorization = new Headers(init.headers).get('authorization');

	return authorization?.replace(/^Bearer /, '') ?? null;
};

const createFetch = (config: HomeyShsScopeProbeConfig): jest.MockedFunction<HomeyScopeProbeFetch> =>
	jest.fn<Promise<Response>, [URL, RequestInit]>((input, init) => {
		if (input.pathname === '/api/manager/system/ping') {
			return Promise.resolve(homeyPingResponse());
		}

		const token = authorizationToken(init);

		if (token === config.withoutDeviceApiKey) {
			return Promise.resolve(new Response(null, { status: input.pathname === '/api/manager/zones/zone' ? 200 : 403 }));
		}

		if (token === config.deviceOnlyApiKey) {
			return Promise.resolve(
				new Response(null, { status: input.pathname === '/api/manager/devices/device' ? 200 : 403 }),
			);
		}

		if (token === config.withoutZoneApiKey) {
			return Promise.resolve(
				new Response(null, { status: input.pathname === '/api/manager/devices/device' ? 200 : 403 }),
			);
		}

		return Promise.reject(new Error('unexpected credential'));
	});

describe('Homey SHS permission-scope compatibility probe', () => {
	it('requires three distinct restricted credentials and isolated read-only gates', () => {
		for (const name of [
			'FB_HOMEY_SHS_DEVICE_ONLY_API_KEY',
			'FB_HOMEY_SHS_WITHOUT_DEVICE_API_KEY',
			'FB_HOMEY_SHS_WITHOUT_ZONE_API_KEY',
		]) {
			expect(() => loadHomeyShsScopeProbeConfig({ ...BASE_ENVIRONMENT, [name]: undefined })).toThrow(
				`${name} is required`,
			);
		}

		expect(() =>
			loadHomeyShsScopeProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_WITHOUT_ZONE_API_KEY: BASE_ENVIRONMENT.FB_HOMEY_SHS_DEVICE_ONLY_API_KEY,
			}),
		).toThrow('credentials must all be distinct');
		expect(() =>
			loadHomeyShsScopeProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_REPLACEMENT_API_KEY: 'rotation-key-that-must-not-be-used',
			}),
		).toThrow('gates must be unset');
	});

	it('proves each missing permission after an allowed read', async () => {
		const config = createConfig();
		const fetchImplementation = createFetch(config);
		const report = await probeHomeyShsScopes(config, fetchImplementation);

		expect(report).toStrictEqual(EXPECTED_REPORT);
		expect(fetchImplementation).toHaveBeenCalledTimes(7);
		expect(fetchImplementation.mock.calls[0][0].pathname).toBe('/api/manager/system/ping');
		expect(new Headers(fetchImplementation.mock.calls[0][1].headers).has('authorization')).toBe(false);
		expect(fetchImplementation.mock.calls.every(([, init]) => init.method === 'GET' && init.redirect === 'error')).toBe(
			true,
		);
		expect(fetchImplementation.mock.calls.slice(1).every(([, init]) => authorizationToken(init) !== null)).toBe(true);
		expect(() => assertHomeyShsScopeReportSafe(report, config)).not.toThrow();

		const serialized = JSON.stringify(report);

		expect(serialized).not.toContain(config.apiKey);
		expect(serialized).not.toContain(config.deviceOnlyApiKey);
		expect(serialized).not.toContain(config.withoutDeviceApiKey);
		expect(serialized).not.toContain(config.withoutZoneApiKey);
	});

	it('validates Homey identity before sending restricted credentials', async () => {
		const config = createConfig();
		const fetchImplementation = jest.fn<Promise<Response>, [URL, RequestInit]>(() =>
			Promise.resolve(new Response(null, { status: 200 })),
		);

		await expect(probeHomeyShsScopes(config, fetchImplementation)).rejects.toThrow(
			'endpoint identity validation failed',
		);
		expect(fetchImplementation).toHaveBeenCalledTimes(1);
		expect(new Headers(fetchImplementation.mock.calls[0][1].headers).has('authorization')).toBe(false);
	});

	it('does not misclassify an invalid restricted credential as missing permission', async () => {
		const config = createConfig();
		const fetchImplementation = createFetch(config);

		fetchImplementation.mockImplementationOnce(() => Promise.resolve(homeyPingResponse()));
		fetchImplementation.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 401 })));

		await expect(probeHomeyShsScopes(config, fetchImplementation)).rejects.toThrow(
			'device credential did not authenticate for its allowed read',
		);
	});

	it('requires the omitted permission to return 403', async () => {
		const config = createConfig();
		const fetchImplementation = createFetch(config);

		fetchImplementation.mockImplementationOnce(() => Promise.resolve(homeyPingResponse()));
		fetchImplementation.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 200 })));
		fetchImplementation.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 401 })));

		await expect(probeHomeyShsScopes(config, fetchImplementation)).rejects.toThrow(
			'device credential did not return an authorization rejection',
		);
	});

	it('rejects extra report fields and configured private values', async () => {
		const config = createConfig();
		const report = await probeHomeyShsScopes(config, createFetch(config));
		const withExtraField = { ...report, unexpected: true };

		expect(() => assertHomeyShsScopeReportSchema(withExtraField)).toThrow('root schema is invalid');

		expect(() => assertHomeyShsScopeReportSafe(report, { ...config, privateTerms: ['authorization'] })).toThrow(
			'configured secret or private value',
		);
	});

	it('writes only the exact schema with restrictive permissions', async () => {
		const config = createConfig();
		const report = await probeHomeyShsScopes(config, createFetch(config));
		const outputRoot = await mkdtemp(join(tmpdir(), 'homey-scope-report-'));

		try {
			const outputDirectory = await writeHomeyShsScopeReport(report, outputRoot);
			const reportPath = join(outputDirectory, 'report.json');

			expect(JSON.parse(await readFile(reportPath, 'utf8'))).toStrictEqual(EXPECTED_REPORT);
			expect((await stat(outputDirectory)).mode & 0o777).toBe(0o700);
			expect((await stat(reportPath)).mode & 0o777).toBe(0o600);
		} finally {
			await rm(outputRoot, { force: true, recursive: true });
		}
	});
});
