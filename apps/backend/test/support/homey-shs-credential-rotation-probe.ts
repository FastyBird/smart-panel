import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { type HomeyShsProbeConfig, loadHomeyShsProbeConfig } from './homey-shs-probe';

const DEVICE_PATH = '/api/manager/devices/device';
const CREDENTIAL_ROTATION_ACKNOWLEDGEMENT = 'I_WILL_REVOKE_THE_TEST_KEY_DURING_THIS_PROBE';
const DEFAULT_OBSERVE_MS = 90_000;
const MIN_OBSERVE_MS = 10_000;
const MAX_OBSERVE_MS = 300_000;
const REVOCATION_POLL_MS = 1_000;
const PUBLIC_HOMEY_TERMS = new Set(['home', 'homey']);
const INCOMPATIBLE_GATE_PREFIXES = ['FB_HOMEY_SHS_LIFECYCLE_', 'FB_HOMEY_SHS_RECOVERY_', 'FB_HOMEY_SHS_WRITE_'];
const EXPECTED_EVENTS = [
	'primary.validation.resolved',
	'replacement.preflight.resolved',
	'rotation.window.open',
	'primary.revocation.observed',
	'replacement.validation.resolved',
] as const;

export type HomeyCredentialRotationFetch = (input: URL, init: RequestInit) => Promise<Response>;
export type HomeyCredentialRotationWait = (milliseconds: number) => Promise<void>;

export interface HomeyShsCredentialRotationProbeConfig extends HomeyShsProbeConfig {
	observeMs: number;
	replacementApiKey: string;
}

export interface HomeyShsCredentialRotationReport {
	metadata: {
		probe: 'homey-shs-credential-rotation';
		schemaVersion: 1;
	};
	rotation: {
		primaryKeyInitiallyValid: true;
		replacementKeyInitiallyValid: true;
		replacementKeyValidAfterRevocation: true;
		revocationObserved: true;
		revocationStatusCode: 401;
	};
	session: {
		events: Array<{ event: (typeof EXPECTED_EVENTS)[number]; order: number }>;
	};
}

class HomeyShsCredentialRotationTimeoutError extends Error {
	constructor(timeoutMs: number) {
		super(`Homey credential rotation revocation observation timed out after ${timeoutMs} ms`);
		this.name = 'HomeyShsCredentialRotationTimeoutError';
	}
}

const sleep: HomeyCredentialRotationWait = async (milliseconds) =>
	new Promise((resolvePromise) => {
		setTimeout(resolvePromise, milliseconds);
	});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const requireExactKeys = (value: unknown, expectedKeys: readonly string[], label: string): Record<string, unknown> => {
	if (!isRecord(value)) {
		throw new Error(`Homey credential rotation report ${label} schema is invalid`);
	}

	const actualKeys = Object.keys(value).sort();
	const sortedExpectedKeys = [...expectedKeys].sort();

	if (
		actualKeys.length !== sortedExpectedKeys.length ||
		actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
	) {
		throw new Error(`Homey credential rotation report ${label} schema is invalid`);
	}

	return value;
};

const parseObserveMs = (value: string | undefined): number => {
	if (value === undefined) {
		return DEFAULT_OBSERVE_MS;
	}

	const parsed = Number(value);

	if (!Number.isInteger(parsed) || parsed < MIN_OBSERVE_MS || parsed > MAX_OBSERVE_MS) {
		throw new Error(
			`FB_HOMEY_SHS_CREDENTIAL_ROTATION_OBSERVE_MS must be an integer between ${MIN_OBSERVE_MS} and ${MAX_OBSERVE_MS}`,
		);
	}

	return parsed;
};

export const loadHomeyShsCredentialRotationProbeConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsCredentialRotationProbeConfig => {
	if (environment.FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE !== CREDENTIAL_ROTATION_ACKNOWLEDGEMENT) {
		throw new Error('FB_HOMEY_SHS_CREDENTIAL_ROTATION_ENABLE does not contain the required operator acknowledgement');
	}

	const incompatibleGate = Object.keys(environment).find((name) =>
		INCOMPATIBLE_GATE_PREFIXES.some((prefix) => name.startsWith(prefix)),
	);

	if (incompatibleGate !== undefined) {
		throw new Error('Homey mutation and recovery gates must be unset during the credential rotation probe');
	}

	const config = loadHomeyShsProbeConfig(environment, workingDirectory);
	const replacementApiKey = environment.FB_HOMEY_SHS_REPLACEMENT_API_KEY;

	if (replacementApiKey === undefined || replacementApiKey.trim() === '') {
		throw new Error('FB_HOMEY_SHS_REPLACEMENT_API_KEY is required');
	}

	if (replacementApiKey === config.apiKey) {
		throw new Error('FB_HOMEY_SHS_REPLACEMENT_API_KEY must differ from FB_HOMEY_SHS_API_KEY');
	}

	return {
		...config,
		observeMs: parseObserveMs(environment.FB_HOMEY_SHS_CREDENTIAL_ROTATION_OBSERVE_MS),
		replacementApiKey,
	};
};

const discardResponse = async (response: Response): Promise<void> => {
	try {
		await response.body?.cancel();
	} catch {
		throw new Error('Homey credential rotation response cleanup failed');
	}
};

const requestInventory = async (
	config: HomeyShsCredentialRotationProbeConfig,
	token: string,
	timeoutMs: number,
	fetchImplementation: HomeyCredentialRotationFetch,
): Promise<Response> => {
	try {
		return await fetchImplementation(new URL(DEVICE_PATH, config.origin), {
			headers: new Headers({ accept: 'application/json', authorization: `Bearer ${token}` }),
			method: 'GET',
			redirect: 'error',
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch {
		// Raw transport errors may contain the pinned endpoint or other private network detail.
		throw new Error('Homey credential rotation inventory request failed');
	}
};

const requireValidKey = async (
	config: HomeyShsCredentialRotationProbeConfig,
	token: string,
	label: 'primary key' | 'replacement key after revocation' | 'replacement key preflight',
	fetchImplementation: HomeyCredentialRotationFetch,
): Promise<void> => {
	const response = await requestInventory(config, token, config.timeoutMs, fetchImplementation);

	try {
		if (!response.ok) {
			throw new Error(`Homey credential rotation ${label} did not authenticate for device inventory`);
		}
	} finally {
		await discardResponse(response);
	}
};

const waitForRevocation = async (
	config: HomeyShsCredentialRotationProbeConfig,
	fetchImplementation: HomeyCredentialRotationFetch,
	wait: HomeyCredentialRotationWait,
	now: () => number,
): Promise<void> => {
	const deadline = now() + config.observeMs;

	while (true) {
		const remainingMs = deadline - now();

		if (remainingMs <= 0) {
			throw new HomeyShsCredentialRotationTimeoutError(config.observeMs);
		}

		const response = await requestInventory(
			config,
			config.apiKey,
			Math.min(config.timeoutMs, remainingMs),
			fetchImplementation,
		);
		const status = response.status;

		await discardResponse(response);

		if (status === 401) {
			return;
		}

		if (status !== 200) {
			throw new Error('Homey credential rotation primary key returned an unexpected status');
		}

		const waitMs = Math.min(REVOCATION_POLL_MS, Math.max(0, deadline - now()));

		if (waitMs === 0) {
			throw new HomeyShsCredentialRotationTimeoutError(config.observeMs);
		}

		await wait(waitMs);
	}
};

const appendEvent = (report: HomeyShsCredentialRotationReport, event: (typeof EXPECTED_EVENTS)[number]): void => {
	report.session.events.push({ event, order: report.session.events.length + 1 });
};

export const probeHomeyShsCredentialRotation = async (
	config: HomeyShsCredentialRotationProbeConfig,
	fetchImplementation: HomeyCredentialRotationFetch = fetch,
	wait: HomeyCredentialRotationWait = sleep,
	onWindowOpen: () => void = () => undefined,
	now: () => number = Date.now,
): Promise<HomeyShsCredentialRotationReport> => {
	const report: HomeyShsCredentialRotationReport = {
		metadata: { probe: 'homey-shs-credential-rotation', schemaVersion: 1 },
		rotation: {
			primaryKeyInitiallyValid: true,
			replacementKeyInitiallyValid: true,
			replacementKeyValidAfterRevocation: true,
			revocationObserved: true,
			revocationStatusCode: 401,
		},
		session: { events: [] },
	};

	await requireValidKey(config, config.apiKey, 'primary key', fetchImplementation);
	appendEvent(report, 'primary.validation.resolved');
	await requireValidKey(config, config.replacementApiKey, 'replacement key preflight', fetchImplementation);
	appendEvent(report, 'replacement.preflight.resolved');
	appendEvent(report, 'rotation.window.open');
	onWindowOpen();
	await waitForRevocation(config, fetchImplementation, wait, now);
	appendEvent(report, 'primary.revocation.observed');
	await requireValidKey(config, config.replacementApiKey, 'replacement key after revocation', fetchImplementation);
	appendEvent(report, 'replacement.validation.resolved');

	return report;
};

export function assertHomeyShsCredentialRotationReportSchema(
	value: unknown,
): asserts value is HomeyShsCredentialRotationReport {
	const report = requireExactKeys(value, ['metadata', 'rotation', 'session'], 'root');
	const metadata = requireExactKeys(report.metadata, ['probe', 'schemaVersion'], 'metadata');
	const rotation = requireExactKeys(
		report.rotation,
		[
			'primaryKeyInitiallyValid',
			'replacementKeyInitiallyValid',
			'replacementKeyValidAfterRevocation',
			'revocationObserved',
			'revocationStatusCode',
		],
		'rotation',
	);
	const session = requireExactKeys(report.session, ['events'], 'session');

	if (
		metadata.probe !== 'homey-shs-credential-rotation' ||
		metadata.schemaVersion !== 1 ||
		rotation.primaryKeyInitiallyValid !== true ||
		rotation.replacementKeyInitiallyValid !== true ||
		rotation.replacementKeyValidAfterRevocation !== true ||
		rotation.revocationObserved !== true ||
		rotation.revocationStatusCode !== 401 ||
		!Array.isArray(session.events) ||
		session.events.length !== EXPECTED_EVENTS.length
	) {
		throw new Error('Homey credential rotation report state schema is invalid');
	}

	for (const [index, eventValue] of session.events.entries()) {
		const event = requireExactKeys(eventValue, ['event', 'order'], 'event');

		if (event.event !== EXPECTED_EVENTS[index] || event.order !== index + 1) {
			throw new Error('Homey credential rotation report event schema is invalid');
		}
	}
}

export function assertHomeyShsCredentialRotationReportSafe(
	value: unknown,
	config: HomeyShsCredentialRotationProbeConfig,
): asserts value is HomeyShsCredentialRotationReport {
	assertHomeyShsCredentialRotationReportSchema(value);

	const serialized = JSON.stringify(value).toLowerCase();
	const forbiddenValues = [config.apiKey, config.replacementApiKey, config.expectedHost, ...config.privateTerms]
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length >= 3 && !PUBLIC_HOMEY_TERMS.has(item));

	if (forbiddenValues.some((item) => serialized.includes(item))) {
		throw new Error('Sanitized Homey credential rotation report contains a configured secret or private value');
	}

	if (
		/(?:\d{1,3}\.){3}\d{1,3}/.test(serialized) ||
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized) ||
		/(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/i.test(serialized)
	) {
		throw new Error('Sanitized Homey credential rotation report contains an address, email, or URL');
	}
}

export const writeHomeyShsCredentialRotationReport = async (
	report: HomeyShsCredentialRotationReport,
	outputRoot: string,
): Promise<string> => {
	assertHomeyShsCredentialRotationReportSchema(report);

	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `credential-rotation-${suffix}`);

	await mkdir(outputDirectory, { mode: 0o700, recursive: true });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});

	return outputDirectory;
};

const run = async (): Promise<void> => {
	const config = loadHomeyShsCredentialRotationProbeConfig(process.env);
	const report = await probeHomeyShsCredentialRotation(config, fetch, sleep, () => {
		process.stdout.write(
			`Homey credential rotation observation window is open for ${config.observeMs} ms. Revoke only the dedicated primary test key now.\n`,
		);
	});

	assertHomeyShsCredentialRotationReportSafe(report, config);

	const outputDirectory = await writeHomeyShsCredentialRotationReport(report, config.outputRoot);

	process.stdout.write(`Sanitized Homey credential rotation report written to ${outputDirectory}.\n`);
};

if (require.main === module) {
	run().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : 'Homey SHS credential rotation probe failed';

		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	});
}
