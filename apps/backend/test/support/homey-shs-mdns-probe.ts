import Bonjour from 'bonjour-service';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_OBSERVE_MS = 5_000;
const MIN_OBSERVE_MS = 1_000;
const MAX_OBSERVE_MS = 30_000;
const PUBLIC_IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const URL_PATTERN = /(?:https?|wss?):\/\//i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const IPV4_PATTERN = /(?:^|[^\d])(?:\d{1,3}\.){3}\d{1,3}(?:$|[^\d])/;
const HOMEY_TOKEN_PATTERN = /(?:hpat|pat|homey)[_-][A-Za-z0-9_-]{16,}/i;

export interface HomeyShsMdnsProbeConfig {
	expectedHost: string;
	observeMs: number;
	outputRoot: string;
	privateTerms: string[];
}

export interface HomeyShsMdnsServiceReport {
	port: number;
	protocol: 'tcp' | 'udp';
	txtKeys: string[];
	type: string;
}

export interface HomeyShsMdnsReport {
	metadata: {
		probe: 'homey-shs-mdns';
		schemaVersion: 1;
	};
	observation: {
		durationMs: number;
		matchedServices: number;
		services: HomeyShsMdnsServiceReport[];
	};
}

interface HomeyMdnsService {
	addresses?: string[];
	host?: string;
	port: number;
	protocol: 'tcp' | 'udp';
	txt?: unknown;
	type: string;
}

export interface HomeyMdnsBrowser {
	stop(): void;
}

export interface HomeyMdnsClient {
	destroy(): void;
	find(options: null, onUp: (service: HomeyMdnsService) => void): HomeyMdnsBrowser;
}

export type HomeyMdnsClientFactory = (onError: () => void) => HomeyMdnsClient;
export type HomeyMdnsWait = (durationMs: number) => Promise<void>;

const defaultClientFactory: HomeyMdnsClientFactory = (onError) => {
	const bonjour = new Bonjour(undefined, onError);

	return {
		destroy: () => bonjour.destroy(),
		find: (options, onUp) => bonjour.find(options, onUp),
	};
};

const defaultWait: HomeyMdnsWait = async (durationMs) =>
	new Promise((resolvePromise) => {
		setTimeout(resolvePromise, durationMs);
	});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const requireExactKeys = (value: unknown, expectedKeys: readonly string[], label: string): Record<string, unknown> => {
	if (!isRecord(value)) {
		throw new Error(`Homey mDNS report ${label} schema is invalid`);
	}

	const actualKeys = Object.keys(value).sort();
	const sortedExpectedKeys = [...expectedKeys].sort();

	if (
		actualKeys.length !== sortedExpectedKeys.length ||
		actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
	) {
		throw new Error(`Homey mDNS report ${label} schema is invalid`);
	}

	return value;
};

const parseObserveMs = (value: string | undefined): number => {
	if (value === undefined) {
		return DEFAULT_OBSERVE_MS;
	}

	const parsed = Number(value);

	if (!Number.isInteger(parsed) || parsed < MIN_OBSERVE_MS || parsed > MAX_OBSERVE_MS) {
		throw new Error(`FB_HOMEY_SHS_MDNS_OBSERVE_MS must be an integer between ${MIN_OBSERVE_MS} and ${MAX_OBSERVE_MS}`);
	}

	return parsed;
};

const normalizeHost = (value: string): string => {
	const trimmed = value.trim().toLowerCase().replace(/\.$/, '');

	return trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;
};

export const loadHomeyShsMdnsProbeConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsMdnsProbeConfig => {
	const rawUrl = environment.FB_HOMEY_SHS_URL;
	const expectedHost = environment.FB_HOMEY_SHS_EXPECTED_HOST;

	if (rawUrl === undefined || expectedHost === undefined) {
		throw new Error('FB_HOMEY_SHS_URL and FB_HOMEY_SHS_EXPECTED_HOST are required');
	}

	let origin: URL;

	try {
		origin = new URL(rawUrl);
	} catch {
		throw new Error('FB_HOMEY_SHS_URL must be a valid HTTP or HTTPS origin');
	}

	if (!['http:', 'https:'].includes(origin.protocol)) {
		throw new Error('FB_HOMEY_SHS_URL must use HTTP or HTTPS');
	}

	if (
		origin.username !== '' ||
		origin.password !== '' ||
		origin.search !== '' ||
		origin.hash !== '' ||
		(origin.pathname !== '/' && origin.pathname !== '')
	) {
		throw new Error('FB_HOMEY_SHS_URL must contain only the Homey origin');
	}

	const normalizedExpectedHost = normalizeHost(expectedHost);

	if (normalizedExpectedHost === '' || normalizeHost(origin.hostname) !== normalizedExpectedHost) {
		throw new Error('FB_HOMEY_SHS_EXPECTED_HOST does not match the configured URL host');
	}

	const configuredPrivateTerms = (environment.FB_HOMEY_SHS_PRIVATE_TERMS ?? '')
		.split(',')
		.map((term) => term.trim())
		.filter((term) => term.length > 0);

	if (configuredPrivateTerms.some((term) => term.length < 3)) {
		throw new Error('Every FB_HOMEY_SHS_PRIVATE_TERMS entry must contain at least three characters');
	}

	return {
		expectedHost: normalizedExpectedHost,
		observeMs: parseObserveMs(environment.FB_HOMEY_SHS_MDNS_OBSERVE_MS),
		outputRoot: resolve(workingDirectory, environment.FB_HOMEY_SHS_CAPTURE_DIR ?? 'test/.homey-shs-captures'),
		privateTerms: [...new Set(configuredPrivateTerms)],
	};
};

const serviceMatchesExpectedHost = (service: HomeyMdnsService, expectedHost: string): boolean =>
	[service.host, ...(service.addresses ?? [])]
		.filter((value): value is string => typeof value === 'string')
		.some((value) => normalizeHost(value) === expectedHost);

const toSafeServiceReport = (service: HomeyMdnsService): HomeyShsMdnsServiceReport => {
	if (!PUBLIC_IDENTIFIER_PATTERN.test(service.type)) {
		throw new Error('Homey mDNS service metadata was not safe to record');
	}

	if (
		!['tcp', 'udp'].includes(service.protocol) ||
		!Number.isInteger(service.port) ||
		service.port < 1 ||
		service.port > 65_535
	) {
		throw new Error('Homey mDNS service metadata was not safe to record');
	}

	if (service.txt !== undefined && !isRecord(service.txt)) {
		throw new Error('Homey mDNS service metadata was not safe to record');
	}

	const txtKeys = Object.keys(service.txt ?? {}).sort();

	if (txtKeys.some((key) => !PUBLIC_IDENTIFIER_PATTERN.test(key))) {
		throw new Error('Homey mDNS service metadata was not safe to record');
	}

	return {
		port: service.port,
		protocol: service.protocol,
		txtKeys,
		type: service.type,
	};
};

const serviceSignature = (service: HomeyShsMdnsServiceReport): string =>
	`${service.protocol}/${service.type}/${service.port}/${service.txtKeys.join(',')}`;

export const probeHomeyShsMdns = async (
	config: HomeyShsMdnsProbeConfig,
	clientFactory: HomeyMdnsClientFactory = defaultClientFactory,
	wait: HomeyMdnsWait = defaultWait,
): Promise<HomeyShsMdnsReport> => {
	let observationFailure: Error | null = null;
	let browser: HomeyMdnsBrowser | null = null;
	let client: HomeyMdnsClient | null = null;
	const services = new Map<string, HomeyShsMdnsServiceReport>();

	try {
		client = clientFactory(() => {
			observationFailure = new Error('Homey mDNS observation failed');
		});
		browser = client.find(null, (service) => {
			if (observationFailure !== null) {
				return;
			}

			try {
				if (!serviceMatchesExpectedHost(service, config.expectedHost)) {
					return;
				}

				const report = toSafeServiceReport(service);

				services.set(serviceSignature(report), report);
			} catch {
				observationFailure = new Error('Homey mDNS service metadata was not safe to record');
			}
		});

		await wait(config.observeMs);
	} catch {
		observationFailure ??= new Error('Homey mDNS observation failed');
	} finally {
		try {
			browser?.stop();
		} catch {
			observationFailure ??= new Error('Homey mDNS cleanup failed');
		}

		try {
			client?.destroy();
		} catch {
			observationFailure ??= new Error('Homey mDNS cleanup failed');
		}
	}

	if (observationFailure !== null) {
		throw observationFailure;
	}

	const sortedServices = [...services.values()].sort((left, right) =>
		serviceSignature(left).localeCompare(serviceSignature(right)),
	);

	return {
		metadata: { probe: 'homey-shs-mdns', schemaVersion: 1 },
		observation: {
			durationMs: config.observeMs,
			matchedServices: sortedServices.length,
			services: sortedServices,
		},
	};
};

export function assertHomeyShsMdnsReportSchema(value: unknown): asserts value is HomeyShsMdnsReport {
	const report = requireExactKeys(value, ['metadata', 'observation'], 'root');
	const metadata = requireExactKeys(report.metadata, ['probe', 'schemaVersion'], 'metadata');
	const observation = requireExactKeys(
		report.observation,
		['durationMs', 'matchedServices', 'services'],
		'observation',
	);

	if (metadata.probe !== 'homey-shs-mdns' || metadata.schemaVersion !== 1) {
		throw new Error('Homey mDNS report metadata schema is invalid');
	}

	if (
		typeof observation.durationMs !== 'number' ||
		!Number.isInteger(observation.durationMs) ||
		observation.durationMs < MIN_OBSERVE_MS ||
		observation.durationMs > MAX_OBSERVE_MS ||
		typeof observation.matchedServices !== 'number' ||
		!Number.isInteger(observation.matchedServices) ||
		observation.matchedServices < 0 ||
		!Array.isArray(observation.services) ||
		observation.matchedServices !== observation.services.length
	) {
		throw new Error('Homey mDNS report observation schema is invalid');
	}

	let previousSignature: string | null = null;

	for (const serviceValue of observation.services) {
		const service = requireExactKeys(serviceValue, ['port', 'protocol', 'txtKeys', 'type'], 'service');

		if (
			typeof service.type !== 'string' ||
			!PUBLIC_IDENTIFIER_PATTERN.test(service.type) ||
			(service.protocol !== 'tcp' && service.protocol !== 'udp') ||
			typeof service.port !== 'number' ||
			!Number.isInteger(service.port) ||
			service.port < 1 ||
			service.port > 65_535 ||
			!Array.isArray(service.txtKeys) ||
			service.txtKeys.some((key) => typeof key !== 'string' || !PUBLIC_IDENTIFIER_PATTERN.test(key))
		) {
			throw new Error('Homey mDNS report service schema is invalid');
		}

		const txtKeys = service.txtKeys as string[];

		if (txtKeys.some((key, index) => index > 0 && key <= txtKeys[index - 1])) {
			throw new Error('Homey mDNS report service schema is invalid');
		}

		const signature = serviceSignature({
			port: service.port,
			protocol: service.protocol,
			txtKeys,
			type: service.type,
		});

		if (previousSignature !== null && signature.localeCompare(previousSignature) <= 0) {
			throw new Error('Homey mDNS report service schema is invalid');
		}

		previousSignature = signature;
	}
}

export function assertHomeyShsMdnsReportSafe(
	value: unknown,
	config: HomeyShsMdnsProbeConfig,
): asserts value is HomeyShsMdnsReport {
	assertHomeyShsMdnsReportSchema(value);

	const serialized = JSON.stringify(value).toLowerCase();
	const reportStrings = value.observation.services.flatMap(({ protocol, txtKeys, type }) => [
		protocol,
		type,
		...txtKeys,
	]);
	const forbiddenValues = [config.expectedHost, ...config.privateTerms]
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length >= 3);

	if (
		forbiddenValues.some((item) => serialized.includes(item)) ||
		URL_PATTERN.test(serialized) ||
		EMAIL_PATTERN.test(serialized) ||
		IPV4_PATTERN.test(serialized) ||
		reportStrings.some((item) => item.includes(':')) ||
		HOMEY_TOKEN_PATTERN.test(serialized)
	) {
		throw new Error('Sanitized Homey mDNS report contains a secret, address, or email-like value');
	}
}

export const writeHomeyShsMdnsReport = async (report: HomeyShsMdnsReport, outputRoot: string): Promise<string> => {
	assertHomeyShsMdnsReportSchema(report);

	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `mdns-${suffix}`);

	await mkdir(outputDirectory, { mode: 0o700, recursive: true });
	await writeFile(resolve(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, {
		encoding: 'utf8',
		flag: 'wx',
		mode: 0o600,
	});

	return outputDirectory;
};

const run = async (): Promise<void> => {
	const config = loadHomeyShsMdnsProbeConfig(process.env);
	const report = await probeHomeyShsMdns(config);

	assertHomeyShsMdnsReportSafe(report, config);

	const outputDirectory = await writeHomeyShsMdnsReport(report, config.outputRoot);

	process.stdout.write(
		`Sanitized Homey mDNS report written to ${outputDirectory} ` +
			`(${report.observation.matchedServices} matched services).\n`,
	);
};

if (require.main === module) {
	run().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : 'Homey SHS mDNS probe failed';

		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	});
}
