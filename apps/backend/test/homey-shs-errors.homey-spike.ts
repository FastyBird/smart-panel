import {
	type HomeyShsErrorReport,
	type HomeyShsProbeFetch,
	assertHomeyShsErrorReportSafe,
	loadHomeyShsErrorProbeConfig,
	probeHomeyShsErrors,
	probeLocalNetworkFailures,
} from './support/homey-shs-error-probe';

const BASE_ENVIRONMENT: NodeJS.ProcessEnv = {
	FB_HOMEY_SHS_API_KEY: 'full-scope-test-key-that-must-not-leak',
	FB_HOMEY_SHS_DEVICE_ONLY_API_KEY: 'device-only-test-key-that-must-not-leak',
	FB_HOMEY_SHS_EXPECTED_HOST: '127.0.0.1',
	FB_HOMEY_SHS_PRIVATE_TERMS: 'Private Room,Private Device',
	FB_HOMEY_SHS_URL: 'http://127.0.0.1:4859',
};

const LOCAL_FAILURES: Pick<HomeyShsErrorReport['scenarios'], 'requestTimeout' | 'unavailableHost'> = {
	requestTimeout: { category: 'timeout', rejected: true },
	unavailableHost: { category: 'unavailable', rejected: true },
};

const createLiveFetch = (): jest.MockedFunction<HomeyShsProbeFetch> =>
	jest.fn<Promise<Response>, [URL, RequestInit]>((input, init) => {
		const authorization = new Headers(init.headers).get('authorization');

		if (authorization?.startsWith('Bearer invalid-homey-probe-') === true) {
			return Promise.resolve(new Response(null, { status: 401 }));
		}

		if (authorization === `Bearer ${BASE_ENVIRONMENT.FB_HOMEY_SHS_DEVICE_ONLY_API_KEY}`) {
			return Promise.resolve(
				new Response(null, { status: input.pathname === '/api/manager/devices/device' ? 200 : 403 }),
			);
		}

		return Promise.reject(new Error('unexpected unsanitized test request'));
	});

describe('Homey SHS error compatibility probe', () => {
	it('requires a distinct device-only key for missing-scope evidence', () => {
		expect(() =>
			loadHomeyShsErrorProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_DEVICE_ONLY_API_KEY: undefined,
			}),
		).toThrow('FB_HOMEY_SHS_DEVICE_ONLY_API_KEY is required');

		expect(() =>
			loadHomeyShsErrorProbeConfig({
				...BASE_ENVIRONMENT,
				FB_HOMEY_SHS_DEVICE_ONLY_API_KEY: BASE_ENVIRONMENT.FB_HOMEY_SHS_API_KEY,
			}),
		).toThrow('must differ from FB_HOMEY_SHS_API_KEY');
	});

	it('classifies all five failures without retaining endpoints, keys, or response bodies', async () => {
		const config = loadHomeyShsErrorProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-error-spike');
		const fetchImplementation = createLiveFetch();
		const report = await probeHomeyShsErrors(config, fetchImplementation, () => Promise.resolve(LOCAL_FAILURES));

		expect(report).toEqual({
			metadata: { probe: 'homey-shs-errors', schemaVersion: 1 },
			scenarios: {
				badUrl: { category: 'validation', rejected: true },
				invalidKey: { category: 'authentication', rejected: true, statusCode: 401 },
				missingScope: {
					allowedRequestStatusCode: 200,
					category: 'authorization',
					rejected: true,
					statusCode: 403,
				},
				...LOCAL_FAILURES,
			},
		});
		expect(fetchImplementation).toHaveBeenCalledTimes(3);
		expect(
			fetchImplementation.mock.calls.every(([, init]) => init?.method === 'GET' && init.redirect === 'error'),
		).toBe(true);
		expect(() => assertHomeyShsErrorReportSafe(report, config)).not.toThrow();
		expect(JSON.stringify(report)).not.toContain(config.apiKey);
		expect(JSON.stringify(report)).not.toContain(config.deviceOnlyApiKey);
	});

	it('does not accept a successful request as invalid-key evidence', async () => {
		const config = loadHomeyShsErrorProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-error-spike');
		const fetchImplementation = jest.fn<Promise<Response>, [URL, RequestInit]>(() =>
			Promise.resolve(new Response(null, { status: 200 })),
		);

		await expect(
			probeHomeyShsErrors(config, fetchImplementation, () => Promise.resolve(LOCAL_FAILURES)),
		).rejects.toThrow('invalid-key probe did not return an authentication rejection');
	});

	it('proves the restricted key is valid before accepting a denied scope', async () => {
		const config = loadHomeyShsErrorProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-error-spike');
		const fetchImplementation = createLiveFetch();

		fetchImplementation.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 401 })));
		fetchImplementation.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 401 })));

		await expect(
			probeHomeyShsErrors(config, fetchImplementation, () => Promise.resolve(LOCAL_FAILURES)),
		).rejects.toThrow('device-only key did not authenticate for its allowed device read');
	});

	it('requires a forbidden system read to return an authorization rejection', async () => {
		const config = loadHomeyShsErrorProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-error-spike');
		const fetchImplementation = createLiveFetch();

		fetchImplementation.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 401 })));
		fetchImplementation.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 200 })));
		fetchImplementation.mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 401 })));

		await expect(
			probeHomeyShsErrors(config, fetchImplementation, () => Promise.resolve(LOCAL_FAILURES)),
		).rejects.toThrow('did not return an authorization rejection for system read');
	});

	it('keeps a short timeout simulation from racing real connection refusal', async () => {
		const result = await probeLocalNetworkFailures(20);

		expect(result).toEqual(LOCAL_FAILURES);
	});

	it('rejects a report if a configured secret is inserted later', async () => {
		const config = loadHomeyShsErrorProbeConfig(BASE_ENVIRONMENT, '/tmp/homey-error-spike');
		const report = await probeHomeyShsErrors(config, createLiveFetch(), () => Promise.resolve(LOCAL_FAILURES));

		report.metadata.probe = config.deviceOnlyApiKey as 'homey-shs-errors';

		expect(() => assertHomeyShsErrorReportSafe(report, config)).toThrow('configured secret or private value');
	});
});
