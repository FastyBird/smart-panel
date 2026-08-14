import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	type HomeyCredentialRotationFetch,
	type HomeyShsCredentialRotationProbeConfig,
	assertHomeyShsCredentialRotationReportSafe,
	assertHomeyShsCredentialRotationReportSchema,
	loadHomeyShsCredentialRotationProbeConfig,
	probeHomeyShsCredentialRotation,
	writeHomeyShsCredentialRotationReport,
} from './support/homey-shs-credential-rotation-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'primary-test-key-that-must-not-leak',
	FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE: 'I_WILL_REVOKE_THE_TEST_KEY_DURING_THIS_PROBE',
	FB_HOMEY_SHS_CREDENTIAL_ROTATION_OBSERVE_MS: '10000',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_REPLACEMENT_API_KEY: 'replacement-test-key-that-must-not-leak',
	FB_HOMEY_SHS_TIMEOUT_MS: '1000',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
};

const createConfig = (
	overrides: Partial<HomeyShsCredentialRotationProbeConfig> = {},
): HomeyShsCredentialRotationProbeConfig => ({
	...loadHomeyShsCredentialRotationProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-credential-rotation-spike'),
	observeMs: 20,
	timeoutMs: 10,
	...overrides,
});

const authorizationToken = (init: RequestInit): string | null => {
	const authorization = new Headers(init.headers).get('authorization');

	return authorization?.replace(/^Bearer /, '') ?? null;
};

describe('Homey SHS credential rotation compatibility probe', () => {
	it('requires the exact acknowledgement, distinct replacement key, and isolated gates', () => {
		expect(() =>
			loadHomeyShsCredentialRotationProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE: undefined,
			}),
		).toThrow('required operator acknowledgement');
		expect(() =>
			loadHomeyShsCredentialRotationProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_REPLACEMENT_API_KEY: undefined,
			}),
		).toThrow('FB_HOMEY_SHS_REPLACEMENT_API_KEY is required');
		expect(() =>
			loadHomeyShsCredentialRotationProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_REPLACEMENT_API_KEY: BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY,
			}),
		).toThrow('must differ from FB_HOMEY_SHS_API_KEY');
		expect(() =>
			loadHomeyShsCredentialRotationProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_WRITE_ENABLE: '',
			}),
		).toThrow('mutation and recovery gates must be unset');
		expect(() =>
			loadHomeyShsCredentialRotationProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_RECOVERY_ENABLE: '',
			}),
		).toThrow('mutation and recovery gates must be unset');
	});

	it('loads a bounded operator window', () => {
		const config = loadHomeyShsCredentialRotationProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-credential-rotation-spike');

		expect(config.observeMs).toBe(10_000);
		expect(() =>
			loadHomeyShsCredentialRotationProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_CREDENTIAL_ROTATION_OBSERVE_MS: '9999',
			}),
		).toThrow('between 10000 and 300000');
		expect(() =>
			loadHomeyShsCredentialRotationProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_CREDENTIAL_ROTATION_OBSERVE_MS: '300001',
			}),
		).toThrow('between 10000 and 300000');
	});

	it('proves primary revocation and replacement access without retaining credentials', async () => {
		const config = createConfig({ observeMs: 2_000 });
		let primaryRequests = 0;
		let nowMs = 0;
		let windowOpenCount = 0;
		const fetchImplementation = jest.fn<Promise<Response>, [URL, RequestInit]>((_input, init) => {
			const token = authorizationToken(init);

			if (token === config.apiKey) {
				primaryRequests += 1;

				return Promise.resolve(new Response(null, { status: primaryRequests < 3 ? 200 : 401 }));
			}

			if (token === config.replacementApiKey) {
				return Promise.resolve(new Response(null, { status: 200 }));
			}

			return Promise.reject(new Error('unexpected credential'));
		});
		const report = await probeHomeyShsCredentialRotation(
			config,
			fetchImplementation,
			(milliseconds) => {
				nowMs += milliseconds;

				return Promise.resolve();
			},
			() => {
				windowOpenCount += 1;
			},
			() => nowMs,
		);

		expect(report).toStrictEqual({
			metadata: { probe: 'homey-shs-credential-rotation', schemaVersion: 1 },
			rotation: {
				primaryKeyInitiallyValid: true,
				replacementKeyInitiallyValid: true,
				replacementKeyValidAfterRevocation: true,
				revocationObserved: true,
				revocationStatusCode: 401,
			},
			session: {
				events: [
					{ event: 'primary.validation.resolved', order: 1 },
					{ event: 'replacement.preflight.resolved', order: 2 },
					{ event: 'rotation.window.open', order: 3 },
					{ event: 'primary.revocation.observed', order: 4 },
					{ event: 'replacement.validation.resolved', order: 5 },
				],
			},
		});
		expect(fetchImplementation).toHaveBeenCalledTimes(5);
		expect(
			fetchImplementation.mock.calls.every(
				([input, init]) =>
					input.pathname === '/api/manager/devices/device' && init.method === 'GET' && init.redirect === 'error',
			),
		).toBe(true);
		expect(windowOpenCount).toBe(1);
		expect(() => assertHomeyShsCredentialRotationReportSafe(report, config)).not.toThrow();
		expect(JSON.stringify(report)).not.toContain(config.apiKey);
		expect(JSON.stringify(report)).not.toContain(config.replacementApiKey);
	});

	it('times out safely when the primary key is not revoked', async () => {
		const config = createConfig({ observeMs: 10 });
		let nowMs = 0;
		const fetchImplementation = jest.fn<Promise<Response>, [URL, RequestInit]>(() =>
			Promise.resolve(new Response(null, { status: 200 })),
		);

		await expect(
			probeHomeyShsCredentialRotation(
				config,
				fetchImplementation,
				(milliseconds) => {
					nowMs += milliseconds;

					return Promise.resolve();
				},
				undefined,
				() => nowMs,
			),
		).rejects.toThrow('revocation observation timed out after 10 ms');
	});

	it('requires both replacement-key validations to succeed', async () => {
		const config = createConfig();
		let replacementRequests = 0;
		const fetchImplementation = jest.fn<Promise<Response>, [URL, RequestInit]>((_input, init) => {
			if (authorizationToken(init) === config.apiKey) {
				return Promise.resolve(new Response(null, { status: 200 }));
			}

			replacementRequests += 1;

			return Promise.resolve(new Response(null, { status: replacementRequests === 1 ? 401 : 200 }));
		});

		await expect(probeHomeyShsCredentialRotation(config, fetchImplementation)).rejects.toThrow(
			'replacement key preflight did not authenticate',
		);

		let primaryRequests = 0;
		replacementRequests = 0;
		fetchImplementation.mockImplementation((_input, init) => {
			if (authorizationToken(init) === config.apiKey) {
				primaryRequests += 1;

				return Promise.resolve(new Response(null, { status: primaryRequests === 1 ? 200 : 401 }));
			}

			replacementRequests += 1;

			return Promise.resolve(new Response(null, { status: replacementRequests === 1 ? 200 : 401 }));
		});

		await expect(probeHomeyShsCredentialRotation(config, fetchImplementation)).rejects.toThrow(
			'replacement key after revocation did not authenticate',
		);
	});

	it('returns fixed request errors without exposing transport detail', async () => {
		const config = createConfig();
		const fetchImplementation = jest.fn<Promise<Response>, [URL, RequestInit]>(() =>
			Promise.reject(new Error(`${config.origin.origin}?key=${config.apiKey}`)),
		);

		await expect(probeHomeyShsCredentialRotation(config, fetchImplementation)).rejects.toThrow(
			'Homey credential rotation inventory request failed',
		);
		await expect(probeHomeyShsCredentialRotation(config, fetchImplementation)).rejects.not.toThrow(config.apiKey);
	});

	it('rejects unsafe or structurally changed reports', async () => {
		const config = createConfig();
		let primaryRequests = 0;
		const fetchImplementation: HomeyCredentialRotationFetch = (_input, init) => {
			if (authorizationToken(init) === config.apiKey) {
				primaryRequests += 1;

				return Promise.resolve(new Response(null, { status: primaryRequests === 1 ? 200 : 401 }));
			}

			return Promise.resolve(new Response(null, { status: 200 }));
		};
		const report = await probeHomeyShsCredentialRotation(config, fetchImplementation);
		const extra = structuredClone(report) as unknown as Record<string, unknown>;

		extra.endpoint = 'private-endpoint';

		expect(() => assertHomeyShsCredentialRotationReportSchema(extra)).toThrow('root schema is invalid');

		const unsafeConfig = { ...config, replacementApiKey: report.metadata.probe };

		expect(() => assertHomeyShsCredentialRotationReportSafe(report, unsafeConfig)).toThrow(
			'configured secret or private value',
		);
	});

	it('writes a new restrictive, schema-validated report directory', async () => {
		const config = createConfig();
		let primaryRequests = 0;
		const report = await probeHomeyShsCredentialRotation(config, (_input, init) => {
			if (authorizationToken(init) === config.apiKey) {
				primaryRequests += 1;

				return Promise.resolve(new Response(null, { status: primaryRequests === 1 ? 200 : 401 }));
			}

			return Promise.resolve(new Response(null, { status: 200 }));
		});
		const root = await mkdtemp(join(tmpdir(), 'homey-credential-rotation-spike-'));

		try {
			const outputDirectory = await writeHomeyShsCredentialRotationReport(report, root);
			const outputStat = await stat(outputDirectory);
			const reportStat = await stat(join(outputDirectory, 'report.json'));
			const written = JSON.parse(await readFile(join(outputDirectory, 'report.json'), 'utf8')) as unknown;

			expect(outputStat.mode & 0o777).toBe(0o700);
			expect(reportStat.mode & 0o777).toBe(0o600);
			expect(written).toStrictEqual(report);
		} finally {
			await rm(root, { force: true, recursive: true });
		}
	});
});
