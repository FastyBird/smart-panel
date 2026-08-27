import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { type HomeyShsProbeConfig, loadHomeyShsProbeConfig } from './homey-shs-probe';

const DEVICE_PATH = '/api/manager/devices/device';
const PING_PATH = '/api/manager/system/ping';
const SYSTEM_PATH = '/api/manager/system/';
const ZONE_PATH = '/api/manager/zones/zone';
const PUBLIC_HOMEY_TERMS = new Set(['home', 'homey']);
const INCOMPATIBLE_GATE_PREFIXES = [
	'FB_HOMEY_SHS_CREDENTIAL_ROTATION_',
	'FB_HOMEY_SHS_LIFECYCLE_',
	'FB_HOMEY_SHS_RECOVERY_',
	'FB_HOMEY_SHS_REPLACEMENT_',
	'FB_HOMEY_SHS_WRITE_',
];

export type HomeyScopeProbeFetch = (input: URL, init: RequestInit) => Promise<Response>;

export interface HomeyShsScopeProbeConfig extends HomeyShsProbeConfig {
	deviceOnlyApiKey: string;
	withoutDeviceApiKey: string;
	withoutZoneApiKey: string;
}

interface MissingPermissionEvidence {
	allowedRequestStatusCode: 200;
	category: 'authorization';
	rejected: true;
	statusCode: 403;
}

export interface HomeyShsScopeReport {
	metadata: {
		probe: 'homey-shs-permission-scopes';
		schemaVersion: 1;
	};
	scenarios: {
		missingDevicePermission: MissingPermissionEvidence;
		missingSystemPermission: MissingPermissionEvidence;
		missingZonePermission: MissingPermissionEvidence;
	};
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const requireExactKeys = (value: unknown, expectedKeys: readonly string[], label: string): Record<string, unknown> => {
	if (!isRecord(value)) {
		throw new Error(`Homey permission-scope report ${label} schema is invalid`);
	}

	const actualKeys = Object.keys(value).sort();
	const sortedExpectedKeys = [...expectedKeys].sort();

	if (
		actualKeys.length !== sortedExpectedKeys.length ||
		actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
	) {
		throw new Error(`Homey permission-scope report ${label} schema is invalid`);
	}

	return value;
};

const requireCredential = (environment: NodeJS.ProcessEnv, name: string): string => {
	const value = environment[name];

	if (value === undefined || value.trim() === '') {
		throw new Error(`${name} is required`);
	}

	return value;
};

export const loadHomeyShsScopeProbeConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsScopeProbeConfig => {
	const incompatibleGate = Object.keys(environment).find((name) =>
		INCOMPATIBLE_GATE_PREFIXES.some((prefix) => name.startsWith(prefix)),
	);

	if (incompatibleGate !== undefined) {
		throw new Error('Homey mutation, recovery, and credential-rotation gates must be unset during the scope probe');
	}

	const config = loadHomeyShsProbeConfig(environment, workingDirectory);
	const deviceOnlyApiKey = requireCredential(environment, 'FB_HOMEY_SHS_DEVICE_ONLY_API_KEY');
	const withoutDeviceApiKey = requireCredential(environment, 'FB_HOMEY_SHS_WITHOUT_DEVICE_API_KEY');
	const withoutZoneApiKey = requireCredential(environment, 'FB_HOMEY_SHS_WITHOUT_ZONE_API_KEY');
	const credentials = [config.apiKey, deviceOnlyApiKey, withoutDeviceApiKey, withoutZoneApiKey];

	if (new Set(credentials).size !== credentials.length) {
		throw new Error('Homey permission-scope probe credentials must all be distinct');
	}

	return { ...config, deviceOnlyApiKey, withoutDeviceApiKey, withoutZoneApiKey };
};

const discardResponse = async (response: Response): Promise<void> => {
	try {
		await response.body?.cancel();
	} catch {
		throw new Error('Homey permission-scope response cleanup failed');
	}
};

const request = async (
	config: HomeyShsScopeProbeConfig,
	path: string,
	fetchImplementation: HomeyScopeProbeFetch,
	token?: string,
): Promise<Response> => {
	const headers = new Headers({ accept: 'application/json' });

	if (token !== undefined) {
		headers.set('authorization', `Bearer ${token}`);
	}

	try {
		return await fetchImplementation(new URL(path, config.origin), {
			headers,
			method: 'GET',
			redirect: 'error',
			signal: AbortSignal.timeout(config.timeoutMs),
		});
	} catch {
		// Raw transport errors may contain the pinned endpoint or private network detail.
		throw new Error('Homey permission-scope request failed');
	}
};

const verifyHomeyIdentity = async (
	config: HomeyShsScopeProbeConfig,
	fetchImplementation: HomeyScopeProbeFetch,
): Promise<void> => {
	const response = await request(config, PING_PATH, fetchImplementation);

	try {
		const homeyId = response.headers.get('x-homey-id');
		const homeyVersion = response.headers.get('x-homey-version');

		if (
			!response.ok ||
			homeyId === null ||
			homeyId.trim() === '' ||
			homeyVersion === null ||
			homeyVersion.trim() === ''
		) {
			throw new Error('Homey permission-scope endpoint identity validation failed');
		}
	} finally {
		await discardResponse(response);
	}
};

const verifyMissingPermission = async (
	config: HomeyShsScopeProbeConfig,
	credential: string,
	allowedPath: string,
	deniedPath: string,
	label: 'device' | 'system' | 'zone',
	fetchImplementation: HomeyScopeProbeFetch,
): Promise<MissingPermissionEvidence> => {
	const allowedResponse = await request(config, allowedPath, fetchImplementation, credential);

	try {
		if (allowedResponse.status !== 200) {
			throw new Error(`Homey permission-scope ${label} credential did not authenticate for its allowed read`);
		}
	} finally {
		await discardResponse(allowedResponse);
	}

	const deniedResponse = await request(config, deniedPath, fetchImplementation, credential);

	try {
		if (deniedResponse.status !== 403) {
			throw new Error(`Homey permission-scope ${label} credential did not return an authorization rejection`);
		}

		return {
			allowedRequestStatusCode: 200,
			category: 'authorization',
			rejected: true,
			statusCode: 403,
		};
	} finally {
		await discardResponse(deniedResponse);
	}
};

export const probeHomeyShsScopes = async (
	config: HomeyShsScopeProbeConfig,
	fetchImplementation: HomeyScopeProbeFetch = fetch,
): Promise<HomeyShsScopeReport> => {
	await verifyHomeyIdentity(config, fetchImplementation);

	return {
		metadata: { probe: 'homey-shs-permission-scopes', schemaVersion: 1 },
		scenarios: {
			missingDevicePermission: await verifyMissingPermission(
				config,
				config.withoutDeviceApiKey,
				ZONE_PATH,
				DEVICE_PATH,
				'device',
				fetchImplementation,
			),
			missingSystemPermission: await verifyMissingPermission(
				config,
				config.deviceOnlyApiKey,
				DEVICE_PATH,
				SYSTEM_PATH,
				'system',
				fetchImplementation,
			),
			missingZonePermission: await verifyMissingPermission(
				config,
				config.withoutZoneApiKey,
				DEVICE_PATH,
				ZONE_PATH,
				'zone',
				fetchImplementation,
			),
		},
	};
};

const assertMissingPermissionEvidence = (value: unknown, label: string): void => {
	const evidence = requireExactKeys(value, ['allowedRequestStatusCode', 'category', 'rejected', 'statusCode'], label);

	if (
		evidence.allowedRequestStatusCode !== 200 ||
		evidence.category !== 'authorization' ||
		evidence.rejected !== true ||
		evidence.statusCode !== 403
	) {
		throw new Error(`Homey permission-scope report ${label} state schema is invalid`);
	}
};

export function assertHomeyShsScopeReportSchema(value: unknown): asserts value is HomeyShsScopeReport {
	const report = requireExactKeys(value, ['metadata', 'scenarios'], 'root');
	const metadata = requireExactKeys(report.metadata, ['probe', 'schemaVersion'], 'metadata');
	const scenarios = requireExactKeys(
		report.scenarios,
		['missingDevicePermission', 'missingSystemPermission', 'missingZonePermission'],
		'scenarios',
	);

	if (metadata.probe !== 'homey-shs-permission-scopes' || metadata.schemaVersion !== 1) {
		throw new Error('Homey permission-scope report metadata state schema is invalid');
	}

	assertMissingPermissionEvidence(scenarios.missingDevicePermission, 'missing-device');
	assertMissingPermissionEvidence(scenarios.missingSystemPermission, 'missing-system');
	assertMissingPermissionEvidence(scenarios.missingZonePermission, 'missing-zone');
}

export function assertHomeyShsScopeReportSafe(
	value: unknown,
	config: HomeyShsScopeProbeConfig,
): asserts value is HomeyShsScopeReport {
	assertHomeyShsScopeReportSchema(value);

	const serialized = JSON.stringify(value).toLowerCase();
	const forbiddenValues = [
		config.apiKey,
		config.deviceOnlyApiKey,
		config.withoutDeviceApiKey,
		config.withoutZoneApiKey,
		config.expectedHost,
		...config.privateTerms,
	]
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length >= 3 && !PUBLIC_HOMEY_TERMS.has(item));

	if (forbiddenValues.some((item) => serialized.includes(item))) {
		throw new Error('Sanitized Homey permission-scope report contains a configured secret or private value');
	}

	if (
		/(?:\d{1,3}\.){3}\d{1,3}/.test(serialized) ||
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized) ||
		/(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/i.test(serialized)
	) {
		throw new Error('Sanitized Homey permission-scope report contains an address, email, or URL');
	}
}

export const writeHomeyShsScopeReport = async (report: HomeyShsScopeReport, outputRoot: string): Promise<string> => {
	assertHomeyShsScopeReportSchema(report);

	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `permission-scopes-${suffix}`);

	await mkdir(outputDirectory, { mode: 0o700, recursive: true });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});

	return outputDirectory;
};

const run = async (): Promise<void> => {
	const config = loadHomeyShsScopeProbeConfig(process.env);
	const report = await probeHomeyShsScopes(config);

	assertHomeyShsScopeReportSafe(report, config);

	const outputDirectory = await writeHomeyShsScopeReport(report, config.outputRoot);

	process.stdout.write(`Sanitized Homey permission-scope report written to ${outputDirectory} (3 scenarios).\n`);
};

if (require.main === module) {
	run().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : 'Homey SHS permission-scope probe failed';

		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	});
}
