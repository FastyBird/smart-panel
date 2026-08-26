import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import { resolve } from 'node:path';

import { type HomeyShsProbeConfig, loadHomeyShsProbeConfig } from './homey-shs-probe';

const DEVICE_PATH = '/api/manager/devices/device';
const SYSTEM_PATH = '/api/manager/system/';
const REPORT_SCHEMA_VERSION = 2;
const MAX_LOCAL_SIMULATION_TIMEOUT_MS = 250;
const LOCAL_REFUSAL_TIMEOUT_MS = 250;

type FailureCategory = 'authentication' | 'authorization' | 'timeout' | 'unavailable' | 'validation';

export type HomeyShsProbeFetch = (input: URL, init: RequestInit) => Promise<Response>;

export interface HomeyShsErrorProbeConfig extends HomeyShsProbeConfig {
	deviceOnlyApiKey: string;
}

export interface HomeyShsErrorReport {
	metadata: {
		probe: 'homey-shs-errors';
		schemaVersion: 2;
	};
	scenarios: {
		badUrlValidation: { category: 'validation'; rejected: true };
		authenticationRejection: { category: 'authentication'; rejected: true; statusCode: 401 | 403 };
		missingScope: {
			allowedRequestStatusCode: number;
			category: 'authorization';
			rejected: true;
			statusCode: 403;
		};
		requestTimeout: { category: 'timeout'; rejected: true };
		unavailableSimulation: { category: 'unavailable'; rejected: true };
	};
}

interface ClassifiedFailure {
	category: 'timeout' | 'unavailable';
}

export const loadHomeyShsErrorProbeConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsErrorProbeConfig => {
	const config = loadHomeyShsProbeConfig(environment, workingDirectory);
	const deviceOnlyApiKey = environment.FB_HOMEY_SHS_DEVICE_ONLY_API_KEY;

	if (deviceOnlyApiKey === undefined || deviceOnlyApiKey.trim() === '') {
		throw new Error('FB_HOMEY_SHS_DEVICE_ONLY_API_KEY is required');
	}

	if (deviceOnlyApiKey === config.apiKey) {
		throw new Error('FB_HOMEY_SHS_DEVICE_ONLY_API_KEY must differ from FB_HOMEY_SHS_API_KEY');
	}

	return { ...config, deviceOnlyApiKey };
};

const discardResponse = async (response: Response): Promise<void> => {
	try {
		await response.body?.cancel();
	} catch {
		throw new Error('Homey error probe response cleanup failed');
	}
};

const request = async (
	url: URL,
	timeoutMs: number,
	fetchImplementation: HomeyShsProbeFetch,
	token?: string,
): Promise<Response | ClassifiedFailure> => {
	const headers = new Headers({ accept: 'application/json' });

	if (token !== undefined) {
		headers.set('authorization', `Bearer ${token}`);
	}

	try {
		return await fetchImplementation(url, {
			headers,
			method: 'GET',
			redirect: 'error',
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (error: unknown) {
		return {
			category:
				error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name)
					? 'timeout'
					: 'unavailable',
		};
	}
};

const requireResponse = (result: Response | ClassifiedFailure, label: string): Response => {
	if (result instanceof Response) {
		return result;
	}

	throw new Error(`Homey ${label} request failed as ${result.category}`);
};

const verifyBadUrlValidation = (): HomeyShsErrorReport['scenarios']['badUrlValidation'] => {
	try {
		loadHomeyShsProbeConfig({
			FB_HOMEY_SHS_API_KEY: 'synthetic-invalid-url-key',
			FB_HOMEY_SHS_EXPECTED_HOST: 'homey.invalid',
			FB_HOMEY_SHS_URL: 'ftp://homey.invalid',
		});
	} catch (error: unknown) {
		if (error instanceof Error && error.message === 'FB_HOMEY_SHS_URL must use HTTP or HTTPS') {
			return { category: 'validation', rejected: true };
		}
	}

	throw new Error('Homey bad-URL validation probe did not reject the candidate');
};

const verifyInvalidKey = async (
	config: HomeyShsErrorProbeConfig,
	fetchImplementation: HomeyShsProbeFetch,
): Promise<HomeyShsErrorReport['scenarios']['authenticationRejection']> => {
	const invalidKey = `invalid-homey-probe-${randomBytes(24).toString('hex')}`;
	const response = requireResponse(
		await request(new URL(SYSTEM_PATH, config.origin), config.timeoutMs, fetchImplementation, invalidKey),
		'invalid-key',
	);

	try {
		if (response.status !== 401 && response.status !== 403) {
			throw new Error('Homey invalid-key probe did not return an authentication rejection');
		}

		return { category: 'authentication', rejected: true, statusCode: response.status };
	} finally {
		await discardResponse(response);
	}
};

const verifyMissingScope = async (
	config: HomeyShsErrorProbeConfig,
	fetchImplementation: HomeyShsProbeFetch,
): Promise<HomeyShsErrorReport['scenarios']['missingScope']> => {
	const allowedResponse = requireResponse(
		await request(new URL(DEVICE_PATH, config.origin), config.timeoutMs, fetchImplementation, config.deviceOnlyApiKey),
		'device-only allowed-scope',
	);
	const allowedStatusCode = allowedResponse.status;

	try {
		if (!allowedResponse.ok) {
			throw new Error('Homey device-only key did not authenticate for its allowed device read');
		}
	} finally {
		await discardResponse(allowedResponse);
	}

	const deniedResponse = requireResponse(
		await request(new URL(SYSTEM_PATH, config.origin), config.timeoutMs, fetchImplementation, config.deviceOnlyApiKey),
		'device-only denied-scope',
	);

	try {
		if (deniedResponse.status !== 403) {
			throw new Error('Homey device-only key did not return an authorization rejection for system read');
		}

		return {
			allowedRequestStatusCode: allowedStatusCode,
			category: 'authorization',
			rejected: true,
			statusCode: 403,
		};
	} finally {
		await discardResponse(deniedResponse);
	}
};

const listen = async (server: Server): Promise<number> => {
	try {
		await new Promise<void>((resolvePromise, rejectPromise) => {
			server.once('error', rejectPromise);
			server.listen(0, '127.0.0.1', () => {
				server.off('error', rejectPromise);
				resolvePromise();
			});
		});
	} catch {
		throw new Error('Homey local failure simulator could not start');
	}

	const address = server.address();

	if (address === null || typeof address === 'string') {
		throw new Error('Homey local failure simulator did not allocate a TCP port');
	}

	return address.port;
};

const close = async (server: Server): Promise<void> => {
	if (!server.listening) {
		return;
	}

	try {
		await new Promise<void>((resolvePromise, rejectPromise) => {
			server.close((error) => (error === undefined ? resolvePromise() : rejectPromise(error)));
		});
	} catch {
		throw new Error('Homey local failure simulator could not stop');
	}
};

export const probeLocalNetworkFailures = async (
	timeoutMs: number,
	fetchImplementation: HomeyShsProbeFetch = fetch,
): Promise<Pick<HomeyShsErrorReport['scenarios'], 'requestTimeout' | 'unavailableSimulation'>> => {
	const simulationTimeoutMs = Math.min(timeoutMs, MAX_LOCAL_SIMULATION_TIMEOUT_MS);
	const unavailableServer = createServer();
	const unavailablePort = await listen(unavailableServer);

	await close(unavailableServer);

	const unavailableResult = await request(
		new URL(`http://127.0.0.1:${unavailablePort}/unavailable`),
		LOCAL_REFUSAL_TIMEOUT_MS,
		fetchImplementation,
	);

	if (unavailableResult instanceof Response || unavailableResult.category !== 'unavailable') {
		if (unavailableResult instanceof Response) {
			await discardResponse(unavailableResult);
		}

		throw new Error('Homey unavailable-host simulator did not produce an unavailable failure');
	}

	const timeoutServer = createServer(() => undefined);
	const timeoutPort = await listen(timeoutServer);
	let timeoutResult: Response | ClassifiedFailure;

	try {
		timeoutResult = await request(
			new URL(`http://127.0.0.1:${timeoutPort}/timeout`),
			simulationTimeoutMs,
			fetchImplementation,
		);
	} finally {
		timeoutServer.closeAllConnections();
		await close(timeoutServer);
	}

	if (timeoutResult instanceof Response || timeoutResult.category !== 'timeout') {
		if (timeoutResult instanceof Response) {
			await discardResponse(timeoutResult);
		}

		throw new Error('Homey timeout simulator did not produce a timeout failure');
	}

	return {
		requestTimeout: { category: 'timeout', rejected: true },
		unavailableSimulation: { category: 'unavailable', rejected: true },
	};
};

export const probeHomeyShsErrors = async (
	config: HomeyShsErrorProbeConfig,
	fetchImplementation: HomeyShsProbeFetch = fetch,
	localFailureProbe: typeof probeLocalNetworkFailures = probeLocalNetworkFailures,
): Promise<HomeyShsErrorReport> => {
	const localFailures = await localFailureProbe(config.timeoutMs);

	return {
		metadata: { probe: 'homey-shs-errors', schemaVersion: REPORT_SCHEMA_VERSION },
		scenarios: {
			badUrlValidation: verifyBadUrlValidation(),
			authenticationRejection: await verifyInvalidKey(config, fetchImplementation),
			missingScope: await verifyMissingScope(config, fetchImplementation),
			...localFailures,
		},
	};
};

export const assertHomeyShsErrorReportSafe = (report: HomeyShsErrorReport, config: HomeyShsErrorProbeConfig): void => {
	const serialized = JSON.stringify(report).toLowerCase();
	const forbidden = [config.apiKey, config.deviceOnlyApiKey, config.expectedHost, ...config.privateTerms]
		.map((value) => value.trim().toLowerCase())
		.filter((value) => value.length >= 3 && !['home', 'homey'].includes(value));

	if (forbidden.some((value) => serialized.includes(value))) {
		throw new Error('Sanitized Homey error report contains a configured secret or private value');
	}

	if (
		/(?:\d{1,3}\.){3}\d{1,3}/.test(serialized) ||
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized) ||
		/(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/i.test(serialized)
	) {
		throw new Error('Sanitized Homey error report contains an address, email, or URL');
	}

	const categories = Object.values(report.scenarios).map(({ category }) => category as FailureCategory);

	if (
		!['validation', 'authentication', 'authorization', 'timeout', 'unavailable'].every((category) =>
			categories.includes(category as FailureCategory),
		)
	) {
		throw new Error('Homey error report does not contain every required failure category');
	}
};

export const writeHomeyShsErrorReport = async (report: HomeyShsErrorReport, outputRoot: string): Promise<string> => {
	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `errors-${suffix}`);

	await mkdir(outputDirectory, { mode: 0o700, recursive: true });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});

	return outputDirectory;
};

const run = async (): Promise<void> => {
	const config = loadHomeyShsErrorProbeConfig(process.env);
	const report = await probeHomeyShsErrors(config);

	assertHomeyShsErrorReportSafe(report, config);

	const outputDirectory = await writeHomeyShsErrorReport(report, config.outputRoot);

	process.stdout.write(`Sanitized Homey error report written to ${outputDirectory} (5 scenarios).\n`);
};

if (require.main === module) {
	run().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : 'Homey SHS error probe failed';

		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	});
}
