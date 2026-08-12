import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve } from 'node:path';

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const FIXTURE_TIMESTAMP = '2000-01-01T00:00:00.000Z';

const SECRET_KEY_PATTERN = /(?:token|secret|password|authorization|api.?key|credential|cookie)/i;
const CAMEL_CASE_SECRET_CODE_KEY_PATTERN = /(?:Pin|PIN|PinCode|PINCode|Passcode|AccessCode)$/;
const BOUNDED_SECRET_CODE_KEY_PATTERN = /(?:^|[_-])(?:pin|pin.?code|passcode|access.?code)$/i;
const CAMEL_CASE_ADDRESS_KEY_PATTERN =
	/(?:Addr|Address|Host|Hostname|Ip|IP|Ipv4|IPv4|Ipv6|IPv6|Mac|MAC|Serial|SerialNumber|Ssid|SSID|Bssid|BSSID)$/;
const BOUNDED_ADDRESS_KEY_PATTERN =
	/(?:^|[_-])(?:addr|address|host|hostname|ip|ipv4|ipv6|mac|serial|serialnumber|serial_number|ssid|bssid)$/i;
const ENDPOINT_KEY_PATTERN = /(?:^|[_-])(?:endpoint|origin|uri|url)$|(?:Endpoint|Origin|Uri|URI|Url|URL)$/;
const IDENTIFIER_KEY_PATTERN =
	/(?:^(?:id|ids|identifier|identifiers|uuid|uuids)$|(?:Id|ID|Ids|IDs|Identifier|Identifiers|Uuid|UUID)$|(?:^|[_-])(?:id|ids|identifier|identifiers|uuid|uuids)$)/;
const CAMEL_CASE_IDENTIFIER_MAP_KEY_PATTERN = /(?:Nodes|Devices|Channels|Endpoints|Components|Instances)$/;
const BOUNDED_IDENTIFIER_MAP_KEY_PATTERN = /(?:^|[_-])(?:nodes|devices|channels|endpoints|components|instances)$/i;
const CAMEL_CASE_PERSONAL_KEY_PATTERN = /(?:Name|Note|Title|Label|Email|Username)$/;
const BOUNDED_PERSONAL_KEY_PATTERN = /(?:^|[_-])(?:name|note|title|label|email|username)$/i;
const REFERENCE_KEY_PATTERN = /^(?:deviceId|zone|zoneId|parent|homeyId|ownerUri|driverId|userId)$/i;
const CAMEL_CASE_REFERENCE_ARRAY_KEY_PATTERN = /(?:Ids|Origins)$/;
const BOUNDED_REFERENCE_ARRAY_KEY_PATTERN = /(?:^|[_-])(?:ids|origins)$/i;
const CAMEL_CASE_TIMESTAMP_KEY_PATTERN = /(?:At|Date|Timestamp|Updated|Modified|Created)$/;
const BOUNDED_TIMESTAMP_KEY_PATTERN = /(?:^|[_-])(?:at|date|timestamp|updated|modified|created)$/i;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IPV4_PATTERN = /(?:\d{1,3}\.){3}\d{1,3}/g;
const BRACKETED_IPV6_PATTERN = /\[([0-9A-Fa-f:.]+(?:%[A-Za-z0-9_.-]+)?)\]/g;
const UNBRACKETED_IPV6_PATTERN = /[0-9A-Fa-f:.]+(?:%[A-Za-z0-9_.-]+)?/g;
const MAX_IPV6_ADDRESS_LENGTH = 45;
const MAX_IPV6_CANDIDATE_SCAN_LENGTH = 256;
const MAC_PATTERN = /(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}|[0-9a-f]{4}(?:\.[0-9a-f]{4}){2}|[0-9a-f]{12}/gi;
const URL_PATTERN = /[A-Z][A-Z0-9+.-]*:\/\/[^\s"']+/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const HOMEY_TOKEN_PATTERN = /(?:hpat|pat|homey)[_-][A-Za-z0-9_-]{16,}/gi;

const REDACTION = {
	address: '[~0~]',
	email: '[~1~]',
	privateTerm: '[~2~]',
	secret: '[~3~]',
	unsupported: '[~4~]',
	url: '[~5~]',
	value: '[~6~]',
	identifier: '[~7~]',
} as const;
const REDACTION_PATTERN = /\[~[0-7]~\]/g;

const READ_ENDPOINTS = {
	systemInfo: '/api/manager/system/',
	zones: '/api/manager/zones/zone',
	devices: '/api/manager/devices/device',
} as const;

export interface HomeyShsProbeConfig {
	origin: URL;
	apiKey: string;
	expectedHost: string;
	timeoutMs: number;
	outputRoot: string;
	privateTerms: string[];
}

export interface HomeyShsCapture {
	metadata: Record<string, unknown>;
	systemInfo: unknown;
	zones: unknown;
	devices: unknown;
}

interface SanitizerContext {
	aliases: SanitizationAliases;
	privateTerms: string[];
	path: string[];
	rootKind: 'device' | 'generic' | 'zone';
}

export interface SanitizationAliases {
	counters: Map<string, number>;
	sourceValues: Set<string>;
	values: Map<string, string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isSecretKey = (key: string): boolean =>
	SECRET_KEY_PATTERN.test(key) ||
	CAMEL_CASE_SECRET_CODE_KEY_PATTERN.test(key) ||
	BOUNDED_SECRET_CODE_KEY_PATTERN.test(key);

export const createSanitizationAliases = (): SanitizationAliases => ({
	counters: new Map(),
	sourceValues: new Set(),
	values: new Map(),
});

const registerSourceValues = (value: unknown, aliases: SanitizationAliases): void => {
	if (typeof value === 'string') {
		aliases.sourceValues.add(value.toLowerCase());
	} else if (Array.isArray(value)) {
		value.forEach((item) => registerSourceValues(item, aliases));
	} else if (isRecord(value)) {
		Object.entries(value).forEach(([key, nestedValue]) => {
			aliases.sourceValues.add(key.toLowerCase());
			registerSourceValues(nestedValue, aliases);
		});
	}
};

const pseudonym = (kind: string, value: string, aliases: SanitizationAliases): string => {
	const key = `${kind}\0${value}`;
	const existing = aliases.values.get(key);

	if (existing !== undefined) {
		return existing;
	}

	let sequence = aliases.counters.get(kind) ?? 0;
	let alias: string;

	do {
		sequence += 1;
		alias = `${kind}-${String(sequence).padStart(6, '0')}`;
	} while (aliases.sourceValues.has(alias.toLowerCase()));

	aliases.counters.set(kind, sequence);
	aliases.values.set(key, alias);

	return alias;
};

const escapeRegularExpression = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ipv6Address = (candidate: string): string => candidate.split('%', 1)[0];

const findIpv6Range = (candidate: string): { end: number; start: number } | null => {
	const addressCandidate = ipv6Address(candidate);
	let bestRange: { end: number; start: number } | null = null;

	if (addressCandidate.length > MAX_IPV6_CANDIDATE_SCAN_LENGTH) {
		return addressCandidate.includes('::') || (addressCandidate.match(/:/g)?.length ?? 0) >= 7
			? { start: 0, end: candidate.length }
			: null;
	}

	for (let start = 0; start < addressCandidate.length; start += 1) {
		const maximumEnd = Math.min(addressCandidate.length, start + MAX_IPV6_ADDRESS_LENGTH);

		for (let end = maximumEnd; end > start; end -= 1) {
			const possibleAddress = addressCandidate.slice(start, end);

			if (!possibleAddress.includes(':') || isIP(possibleAddress) !== 6) {
				continue;
			}

			if (bestRange === null || end - start > bestRange.end - bestRange.start) {
				bestRange = { start, end: end === addressCandidate.length ? candidate.length : end };
			}

			break;
		}
	}

	return bestRange;
};

const replaceIpv6Candidate = (candidate: string, replacement: string): string => {
	let remainder = candidate;
	let sanitized = '';
	let range = findIpv6Range(remainder);

	while (range !== null) {
		sanitized += `${remainder.slice(0, range.start)}${replacement}`;
		remainder = remainder.slice(range.end);
		range = findIpv6Range(remainder);
	}

	return sanitized + remainder;
};

const replaceIpv6Addresses = (value: string, replacement: string): string =>
	value
		.replace(BRACKETED_IPV6_PATTERN, (candidate, address: string) =>
			isIP(ipv6Address(address)) === 6 ? replacement : candidate,
		)
		.replace(UNBRACKETED_IPV6_PATTERN, (candidate) => replaceIpv6Candidate(candidate, replacement));

const sanitizeString = (value: string, privateTerms: string[]): string => {
	let sanitized = replaceIpv6Addresses(value, REDACTION.address)
		.replace(URL_PATTERN, REDACTION.url)
		.replace(IPV4_PATTERN, REDACTION.address)
		.replace(MAC_PATTERN, REDACTION.address)
		.replace(EMAIL_PATTERN, REDACTION.email)
		.replace(HOMEY_TOKEN_PATTERN, REDACTION.secret);

	for (const term of privateTerms) {
		sanitized = sanitized.replace(new RegExp(escapeRegularExpression(term), 'gi'), REDACTION.privateTerm);
	}

	return sanitized;
};

const isCapabilityMap = (path: string[], rootKind: SanitizerContext['rootKind']): boolean =>
	rootKind === 'device' &&
	path.length === 2 &&
	path[0] === 'root' &&
	(path[1] === 'capabilitiesObj' || path[1] === 'capabilityOptions');

const isCapabilityIdentifier = (key: string, path: string[], rootKind: SanitizerContext['rootKind']): boolean =>
	key === 'id' && isCapabilityMap(path.slice(0, -1), rootKind);

const isCapabilityListEntry = (path: string[], rootKind: SanitizerContext['rootKind']): boolean =>
	rootKind === 'device' && path.length === 2 && path[0] === 'root' && path[1] === 'capabilities';

const isDriverMetadata = (path: string[]): boolean => path.includes('data') || path.includes('settings');

const isDriverIdentifierMap = (key: string, path: string[]): boolean =>
	isDriverMetadata(path) &&
	(CAMEL_CASE_IDENTIFIER_MAP_KEY_PATTERN.test(key) || BOUNDED_IDENTIFIER_MAP_KEY_PATTERN.test(key));

const isTimestampKey = (key: string): boolean =>
	CAMEL_CASE_TIMESTAMP_KEY_PATTERN.test(key) || BOUNDED_TIMESTAMP_KEY_PATTERN.test(key);

const isAddressKey = (key: string): boolean =>
	CAMEL_CASE_ADDRESS_KEY_PATTERN.test(key) || BOUNDED_ADDRESS_KEY_PATTERN.test(key);

const isPersonalKey = (key: string): boolean =>
	CAMEL_CASE_PERSONAL_KEY_PATTERN.test(key) || BOUNDED_PERSONAL_KEY_PATTERN.test(key);

const isReferenceArrayKey = (key: string): boolean =>
	CAMEL_CASE_REFERENCE_ARRAY_KEY_PATTERN.test(key) || BOUNDED_REFERENCE_ARRAY_KEY_PATTERN.test(key);

const referenceArrayKind = (key: string): 'device' | 'reference' | 'zone' => {
	const normalizedKey = key.replaceAll(/[_-]/g, '').toLowerCase();

	if (normalizedKey.endsWith('deviceids')) {
		return 'device';
	}

	if (normalizedKey.endsWith('zoneids')) {
		return 'zone';
	}

	return 'reference';
};

const sanitizeReference = (key: string, value: string, aliases: SanitizationAliases): string => {
	if (/^(?:zone|zoneId|parent)$/i.test(key)) {
		return pseudonym('zone', value, aliases);
	}

	if (/^deviceId$/i.test(key)) {
		return pseudonym('device', value, aliases);
	}

	if (/^homeyId$/i.test(key)) {
		return pseudonym('homey', value, aliases);
	}

	return pseudonym('reference', value, aliases);
};

const sanitizeValue = (value: unknown, key: string, context: SanitizerContext): unknown => {
	const capabilityMapEntry = isCapabilityMap(context.path, context.rootKind);

	if (!capabilityMapEntry && isSecretKey(key)) {
		return REDACTION.secret;
	}

	if (value !== null && !capabilityMapEntry && isTimestampKey(key)) {
		return FIXTURE_TIMESTAMP;
	}

	if (value !== null && !capabilityMapEntry && isAddressKey(key)) {
		return REDACTION.address;
	}

	if (Array.isArray(value) && !capabilityMapEntry && isReferenceArrayKey(key)) {
		const kind = referenceArrayKind(key);

		return value.map((item) => (typeof item === 'string' ? pseudonym(kind, item, context.aliases) : REDACTION.value));
	}

	if (
		value !== null &&
		!isRecord(value) &&
		!capabilityMapEntry &&
		!isCapabilityIdentifier(key, context.path, context.rootKind) &&
		(REFERENCE_KEY_PATTERN.test(key) || IDENTIFIER_KEY_PATTERN.test(key))
	) {
		return typeof value === 'string' && REFERENCE_KEY_PATTERN.test(key)
			? sanitizeReference(key, value, context.aliases)
			: REDACTION.identifier;
	}

	if (typeof value === 'number' && isDriverMetadata(context.path)) {
		return REDACTION.identifier;
	}

	if (value === null || typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'string') {
		if (
			isCapabilityListEntry(context.path, context.rootKind) ||
			isCapabilityIdentifier(key, context.path, context.rootKind)
		) {
			return value;
		}

		if (isPersonalKey(key)) {
			return REDACTION.privateTerm;
		}

		if (ISO_TIMESTAMP_PATTERN.test(value)) {
			return FIXTURE_TIMESTAMP;
		}

		if (isDriverMetadata(context.path)) {
			return REDACTION.identifier;
		}

		if (key === 'id' || UUID_PATTERN.test(value)) {
			return pseudonym('id', value, context.aliases);
		}

		return sanitizeString(value, context.privateTerms);
	}

	if (Array.isArray(value)) {
		return value.map((item, index) => sanitizeValue(item, String(index), { ...context, path: [...context.path, key] }));
	}

	if (!isRecord(value)) {
		return REDACTION.unsupported;
	}

	const nextPath = [...context.path, key];
	const preserveKeys = isCapabilityMap(nextPath, context.rootKind);
	const identifierMap = isDriverIdentifierMap(key, nextPath);

	return Object.fromEntries(
		Object.entries(value).map(([nestedKey, nestedValue]) => {
			const identifierMapKey =
				identifierMap ||
				UUID_PATTERN.test(nestedKey) ||
				/^\d+$/.test(nestedKey) ||
				IDENTIFIER_KEY_PATTERN.test(nestedKey);
			const privateMapKey = !preserveKeys && identifierMapKey && isDriverMetadata(nextPath);
			const safeKey = privateMapKey ? pseudonym('id', nestedKey, context.aliases) : nestedKey;

			return [safeKey, sanitizeValue(nestedValue, nestedKey, { ...context, path: nextPath })];
		}),
	);
};

export const sanitizeHomeyPayload = (
	value: unknown,
	privateTerms: string[] = [],
	rootKind: SanitizerContext['rootKind'] = 'generic',
	aliases: SanitizationAliases = createSanitizationAliases(),
): unknown => {
	registerSourceValues(value, aliases);

	return sanitizeValue(value, 'root', { aliases, privateTerms, path: [], rootKind });
};

const replaceCollectionIdentity = (
	value: unknown,
	kind: 'device' | 'zone',
	privateTerms: string[],
	aliases: SanitizationAliases,
): Record<string, unknown> => {
	if (!isRecord(value)) {
		throw new Error(`Homey ${kind} response is not an object`);
	}

	registerSourceValues(value, aliases);

	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([rawId, rawItem]) => {
				const safeId = pseudonym(kind, rawId, aliases);
				const rawName = isRecord(rawItem) && typeof rawItem.name === 'string' ? rawItem.name : rawId;
				const safeName = pseudonym(`${kind}-label`, rawName, aliases);
				const sanitized = sanitizeHomeyPayload(rawItem, privateTerms, kind, aliases);
				const safeItem = isRecord(sanitized) ? sanitized : { value: sanitized };

				return [
					safeId,
					{
						...safeItem,
						id: safeId,
						name: safeName,
					},
				];
			}),
	);
};

export const sanitizeHomeyZones = (
	value: unknown,
	privateTerms: string[] = [],
	aliases: SanitizationAliases = createSanitizationAliases(),
): Record<string, unknown> => replaceCollectionIdentity(value, 'zone', privateTerms, aliases);

export const sanitizeHomeyDevices = (
	value: unknown,
	privateTerms: string[] = [],
	aliases: SanitizationAliases = createSanitizationAliases(),
): Record<string, unknown> => replaceCollectionIdentity(value, 'device', privateTerms, aliases);

const parseTimeout = (value: string | undefined): number => {
	if (value === undefined) {
		return DEFAULT_TIMEOUT_MS;
	}

	const parsed = Number(value);

	if (!Number.isInteger(parsed) || parsed < MIN_TIMEOUT_MS || parsed > MAX_TIMEOUT_MS) {
		throw new Error(`FB_HOMEY_SHS_TIMEOUT_MS must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`);
	}

	return parsed;
};

const normalizeHost = (value: string): string =>
	value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;

export const loadHomeyShsProbeConfig = (
	environment: NodeJS.ProcessEnv,
	workingDirectory = process.cwd(),
): HomeyShsProbeConfig => {
	const rawUrl = environment.FB_HOMEY_SHS_URL;
	const apiKey = environment.FB_HOMEY_SHS_API_KEY;
	const expectedHost = environment.FB_HOMEY_SHS_EXPECTED_HOST;

	if (rawUrl === undefined || apiKey === undefined || expectedHost === undefined) {
		throw new Error('FB_HOMEY_SHS_URL, FB_HOMEY_SHS_API_KEY, and FB_HOMEY_SHS_EXPECTED_HOST are required');
	}

	const origin = new URL(rawUrl);

	if (!['http:', 'https:'].includes(origin.protocol)) {
		throw new Error('FB_HOMEY_SHS_URL must use HTTP or HTTPS');
	}

	if (origin.username !== '' || origin.password !== '' || origin.search !== '' || origin.hash !== '') {
		throw new Error('FB_HOMEY_SHS_URL must not contain credentials, a query, or a fragment');
	}

	if (origin.pathname !== '/' && origin.pathname !== '') {
		throw new Error('FB_HOMEY_SHS_URL must contain only the Homey origin, without an API path');
	}

	const normalizedExpectedHost = normalizeHost(expectedHost);

	if (normalizeHost(origin.hostname).toLowerCase() !== normalizedExpectedHost.toLowerCase()) {
		throw new Error('FB_HOMEY_SHS_EXPECTED_HOST does not match the configured URL host');
	}

	if (apiKey.trim() === '') {
		throw new Error('FB_HOMEY_SHS_API_KEY must not be empty');
	}

	const configuredPrivateTerms = (environment.FB_HOMEY_SHS_PRIVATE_TERMS ?? '')
		.split(',')
		.map((term) => term.trim())
		.filter((term) => term.length > 0);

	if (configuredPrivateTerms.some((term) => term.length < 3)) {
		throw new Error('Every FB_HOMEY_SHS_PRIVATE_TERMS entry must contain at least three characters');
	}

	const privateTerms = [...new Set(configuredPrivateTerms)];

	return {
		origin: new URL(origin.origin),
		apiKey,
		expectedHost: normalizedExpectedHost,
		timeoutMs: parseTimeout(environment.FB_HOMEY_SHS_TIMEOUT_MS),
		outputRoot: resolve(workingDirectory, environment.FB_HOMEY_SHS_CAPTURE_DIR ?? 'test/.homey-shs-captures'),
		privateTerms,
	};
};

const fetchHomey = async (
	config: HomeyShsProbeConfig,
	path: string,
	label: string,
	authenticated: boolean,
	fetchImplementation: typeof fetch,
): Promise<Response> => {
	const headers = new Headers({ accept: 'application/json' });

	if (authenticated) {
		headers.set('authorization', `Bearer ${config.apiKey}`);
	}

	try {
		return await fetchImplementation(new URL(path, config.origin), {
			headers,
			method: 'GET',
			redirect: 'error',
			signal: AbortSignal.timeout(config.timeoutMs),
		});
	} catch {
		throw new Error(`Homey ${label} request failed before a response was received`);
	}
};

const readJson = async (response: Response, label: string): Promise<unknown> => {
	if (!response.ok) {
		throw new Error(`Homey ${label} request returned HTTP ${response.status}`);
	}

	const contentLength = Number(response.headers.get('content-length') ?? 0);

	if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
		throw new Error(`Homey ${label} response exceeded the capture size limit`);
	}

	const chunks: Uint8Array[] = [];
	let responseBytes = 0;
	const reader = response.body?.getReader();

	if (reader !== undefined) {
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			responseBytes += value.byteLength;

			if (responseBytes > MAX_RESPONSE_BYTES) {
				await reader.cancel();
				throw new Error(`Homey ${label} response exceeded the capture size limit`);
			}

			chunks.push(value);
		}
	}

	const body = Buffer.concat(chunks, responseBytes).toString('utf8');

	try {
		return JSON.parse(body) as unknown;
	} catch {
		throw new Error(`Homey ${label} response was not valid JSON`);
	}
};

export const captureHomeyShs = async (
	config: HomeyShsProbeConfig,
	fetchImplementation: typeof fetch = fetch,
): Promise<HomeyShsCapture> => {
	const ping = await fetchHomey(config, '/api/manager/system/ping', 'ping', false, fetchImplementation);

	if (!ping.ok || ping.headers.get('x-homey-id') === null) {
		await ping.body?.cancel();
		throw new Error('The configured endpoint did not return a valid Homey ping response');
	}

	await ping.body?.cancel();

	const [systemResponse, zonesResponse, devicesResponse] = await Promise.all(
		Object.entries(READ_ENDPOINTS).map(([label, path]) => fetchHomey(config, path, label, true, fetchImplementation)),
	);
	const [systemInfo, zones, devices] = await Promise.all([
		readJson(systemResponse, 'systemInfo'),
		readJson(zonesResponse, 'zones'),
		readJson(devicesResponse, 'devices'),
	]);
	const aliases = createSanitizationAliases();
	registerSourceValues(config.expectedHost, aliases);
	registerSourceValues(systemInfo, aliases);
	registerSourceValues(zones, aliases);
	registerSourceValues(devices, aliases);
	registerSourceValues(ping.headers.get('x-homey-id'), aliases);
	const sanitizedZones = sanitizeHomeyZones(zones, config.privateTerms, aliases);
	const sanitizedDevices = sanitizeHomeyDevices(devices, config.privateTerms, aliases);

	return {
		metadata: {
			schemaVersion: 1,
			capturedAt: new Date().toISOString(),
			transport: { protocol: config.origin.protocol.slice(0, -1), port: config.origin.port || 'default' },
			homey: {
				id: pseudonym('homey', ping.headers.get('x-homey-id') ?? 'unknown', aliases),
				version: sanitizeString(ping.headers.get('x-homey-version') ?? 'unknown', config.privateTerms),
				tier: sanitizeString(ping.headers.get('x-homey-tier') ?? 'unknown', config.privateTerms),
			},
			counts: {
				zones: Object.keys(sanitizedZones).length,
				devices: Object.keys(sanitizedDevices).length,
			},
			readEndpoints: READ_ENDPOINTS,
		},
		systemInfo: sanitizeHomeyPayload(systemInfo, config.privateTerms, 'generic', aliases),
		zones: sanitizedZones,
		devices: sanitizedDevices,
	};
};

export const assertHomeyCaptureSafe = (
	capture: HomeyShsCapture,
	forbiddenValues: string[],
	privateTerms: string[] = [],
	expectedHost?: string,
): void => {
	const serialized = JSON.stringify(capture);
	const forbidden = forbiddenValues.filter((value) => value.length > 0);

	for (const value of forbidden) {
		if (serialized.toLowerCase().includes(value.toLowerCase())) {
			throw new Error('Sanitized Homey capture still contains a configured forbidden value');
		}
	}

	if (expectedHost !== undefined) {
		const escapedHost = escapeRegularExpression(expectedHost);
		const hostTokenPattern = new RegExp(`(^|[^A-Za-z0-9.-])${escapedHost}(?=$|[^A-Za-z0-9.-])`, 'i');
		const globallyIdentifiableHost = expectedHost.includes('.') || expectedHost.includes(':');
		const hostLeakPattern = globallyIdentifiableHost ? new RegExp(escapedHost, 'i') : hostTokenPattern;
		let hostLeakFound = false;
		const inspectEndpointValues = (value: unknown, key = ''): void => {
			if (typeof value === 'string') {
				const endpointShaped =
					globallyIdentifiableHost ||
					isAddressKey(key) ||
					ENDPOINT_KEY_PATTERN.test(key) ||
					value.includes('://') ||
					new RegExp(`${escapedHost}:\\d+`, 'i').test(value);

				hostLeakFound ||= endpointShaped && hostLeakPattern.test(value);
			} else if (Array.isArray(value)) {
				value.forEach((item) => inspectEndpointValues(item, key));
			} else if (isRecord(value)) {
				Object.entries(value).forEach(([nestedKey, nestedValue]) => {
					const endpointShapedKey =
						isAddressKey(nestedKey) ||
						ENDPOINT_KEY_PATTERN.test(nestedKey) ||
						nestedKey.includes('://') ||
						new RegExp(`${escapedHost}:\\d+`, 'i').test(nestedKey);

					hostLeakFound ||= (globallyIdentifiableHost || endpointShapedKey) && hostLeakPattern.test(nestedKey);
					inspectEndpointValues(nestedValue, nestedKey);
				});
			}
		};

		inspectEndpointValues(capture);

		if (hostLeakFound) {
			throw new Error('Sanitized Homey capture still contains the expected host in a value');
		}
	}

	const generatedPseudonymPattern = /^(?:device|device-label|homey|id|reference|zone|zone-label)-\d{6}$/;
	const fixedPayloadKeys = new Set([
		'active',
		'available',
		'capabilities',
		'capabilitiesObj',
		'capabilityOptions',
		'data',
		'deviceId',
		'deviceIds',
		'driverId',
		'enabled',
		'format',
		'homeyId',
		'id',
		'metadata',
		'name',
		'ownerUri',
		'parent',
		'settings',
		'type',
		'ui',
		'update',
		'userId',
		'value',
		'zone',
		'zoneId',
		'zoneIds',
	]);
	const dynamicKeyContainsPrivateTerm = (key: string, term: string): boolean =>
		key.toLowerCase().includes(term.toLowerCase());
	const isCapturedCapabilityMapPath = (path: string[]): boolean =>
		path.length === 3 &&
		path[0] === 'devices' &&
		generatedPseudonymPattern.test(path[1]) &&
		(path[2] === 'capabilitiesObj' || path[2] === 'capabilityOptions');
	const isCapturedCapabilityIdentifier = (key: string, path: string[]): boolean =>
		key === 'id' && isCapturedCapabilityMapPath(path.slice(0, -1));
	const isCapturedCapabilityListEntry = (path: string[]): boolean =>
		path.length === 3 && path[0] === 'devices' && generatedPseudonymPattern.test(path[1]) && path[2] === 'capabilities';
	const isStructuralRecordPath = (path: string[]): boolean => {
		if (path.length === 1 && path[0] === 'systemInfo') {
			return true;
		}

		if (
			path.length === 2 &&
			(path[0] === 'devices' || path[0] === 'zones') &&
			generatedPseudonymPattern.test(path[1])
		) {
			return true;
		}

		return isCapturedCapabilityMapPath(path.slice(0, -1));
	};
	const inspectPrivateTermValues = (value: unknown, key: string, path: string[], term: string): boolean => {
		if (typeof value === 'string') {
			const generatedValue = generatedPseudonymPattern.test(value);

			return (
				!isCapturedCapabilityListEntry(path) &&
				!isCapturedCapabilityIdentifier(key, path) &&
				!generatedValue &&
				value.replace(REDACTION_PATTERN, '').toLowerCase().includes(term.toLowerCase())
			);
		}

		if (typeof value === 'number') {
			return String(value).includes(term);
		}

		if (Array.isArray(value)) {
			return value.some((item, index) => inspectPrivateTermValues(item, String(index), [...path, key], term));
		}

		if (isRecord(value)) {
			const nextPath = [...path, key];
			const preserveKeys = isCapturedCapabilityMapPath(nextPath);
			const structuralRecord = isStructuralRecordPath(nextPath);

			return Object.entries(value).some(([nestedKey, nestedValue]) => {
				const generatedKey = generatedPseudonymPattern.test(nestedKey);
				const structuralKey = structuralRecord && fixedPayloadKeys.has(nestedKey);
				const privateDynamicKey =
					!preserveKeys && !generatedKey && !structuralKey && dynamicKeyContainsPrivateTerm(nestedKey, term);

				return privateDynamicKey || inspectPrivateTermValues(nestedValue, nestedKey, nextPath, term);
			});
		}

		return false;
	};

	for (const term of privateTerms) {
		const privateTermFound = [
			['systemInfo', capture.systemInfo],
			['zones', capture.zones],
			['devices', capture.devices],
		].some(([payloadKey, value]) => inspectPrivateTermValues(value, payloadKey as string, [], term));

		if (privateTermFound) {
			throw new Error('Sanitized Homey capture still contains a configured private term');
		}
	}

	const unsafePatterns = [IPV4_PATTERN, MAC_PATTERN, URL_PATTERN, EMAIL_PATTERN, HOMEY_TOKEN_PATTERN];

	if (
		unsafePatterns.some((pattern) => new RegExp(pattern.source, pattern.flags).test(serialized)) ||
		replaceIpv6Addresses(serialized, REDACTION.address) !== serialized
	) {
		throw new Error('Sanitized Homey capture still contains a secret, address, or email-like value');
	}
};

export const writeHomeyShsCapture = async (capture: HomeyShsCapture, outputRoot: string): Promise<string> => {
	const suffix = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`;
	const outputDirectory = resolve(outputRoot, `capture-${suffix}`);

	await mkdir(outputDirectory, { mode: 0o700, recursive: true });

	for (const [name, value] of Object.entries(capture)) {
		await writeFile(resolve(outputDirectory, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, {
			encoding: 'utf8',
			flag: 'wx',
			mode: 0o600,
		});
	}

	return outputDirectory;
};

const run = async (): Promise<void> => {
	const config = loadHomeyShsProbeConfig(process.env);
	const capture = await captureHomeyShs(config);

	assertHomeyCaptureSafe(capture, [config.apiKey], config.privateTerms, config.expectedHost);

	const outputDirectory = await writeHomeyShsCapture(capture, config.outputRoot);
	const counts = capture.metadata.counts as { devices: number; zones: number };

	process.stdout.write(
		`Sanitized Homey capture written to ${outputDirectory} (${counts.devices} devices, ${counts.zones} zones).\n`,
	);
};

if (require.main === module) {
	run().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : 'Homey SHS probe failed';

		process.stderr.write(`${message}\n`);
		process.exitCode = 1;
	});
}
