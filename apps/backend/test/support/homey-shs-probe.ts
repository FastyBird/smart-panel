import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { resolve } from 'node:path';

import { resolveHomeyTransportPort } from './homey-shs-transport';

const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_ALIAS_ATTEMPTS_PER_PREFIX = 1_000;
const FIXTURE_TIMESTAMP = '2000-01-01T00:00:00.000Z';
const NEUTRAL_ALIAS_PREFIXES = ['p', 'q', 'x', 'z'] as const;

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
const CAMEL_CASE_IDENTIFIER_MAP_KEY_PATTERN = /(?:Aliases|Nodes|Devices|Channels|Endpoints|Components|Instances)$/;
const BOUNDED_IDENTIFIER_MAP_KEY_PATTERN =
	/(?:^|[_-])(?:aliases|nodes|devices|channels|endpoints|components|instances)$/i;
const CAMEL_CASE_PERSONAL_KEY_PATTERN = /(?:Name|Note|Title|Label|Email|Username)$/;
const BOUNDED_PERSONAL_KEY_PATTERN = /(?:^|[_-])(?:name|note|title|label|email|username)$/i;
const LOCATION_METADATA_KEY_PATTERN = /^(?:country|language|locale|region|time_?zone)$/i;
const HUMAN_TIMESTAMP_KEY_PATTERN = /^(?:dateHuman|humanDate)$/i;
const REFERENCE_KEY_PATTERN = /^(?:deviceId|zone|zoneId|parent|homeyId|ownerUri|driverId|userId)$/i;
const CAMEL_CASE_REFERENCE_ARRAY_KEY_PATTERN = /(?:Ids|Origins)$/;
const BOUNDED_REFERENCE_ARRAY_KEY_PATTERN = /(?:^|[_-])(?:ids|origins)$/i;
const CAMEL_CASE_TIMESTAMP_KEY_PATTERN = /(?:At|Date|Timestamp|Updated|Modified|Created)$/;
const BOUNDED_TIMESTAMP_KEY_PATTERN = /(?:^|[_-])(?:at|date|timestamp|updated|modified|created)$/i;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERATED_PSEUDONYM_PATTERN =
	/^(?:capability-base|capability-suffix|device|device-label|enum-option|homey|id|p|q|reference|x|z|zone|zone-label)-\d{6}$/;
const IPV4_PATTERN = /(?:\d{1,3}\.){3}\d{1,3}/g;
const BRACKETED_IPV6_PATTERN = /\[([0-9A-Fa-f:.]+(?:%[A-Za-z0-9_.-]+)?)\]/g;
const UNBRACKETED_IPV6_PATTERN = /[0-9A-Fa-f:.]+(?:%[A-Za-z0-9_.-]+)?/g;
const MAX_IPV6_ADDRESS_LENGTH = 45;
const MAX_IPV6_CANDIDATE_SCAN_LENGTH = 256;
const MAC_PATTERN = /(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}|[0-9a-f]{4}(?:\.[0-9a-f]{4}){2}|[0-9a-f]{12}/gi;
const URL_PATTERN = /(?:[A-Z][A-Z0-9+.-]*:)?\/\/[^\s"']+/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const HOMEY_TOKEN_PATTERN = /(?:hpat|pat|homey)[_-][A-Za-z0-9_-]{16,}/gi;
const PRESERVED_STRUCTURAL_KEY_SET = new Set([
	'accountId',
	'capabilities',
	'capabilitiesObj',
	'capabilityOptions',
	'deviceId',
	'deviceIds',
	'device_id',
	'driverId',
	'hardware_id',
	'homeyId',
	'id',
	'ownerUri',
	'parent',
	'userId',
	'zone',
	'zoneId',
	'zoneIds',
	'zone_ids',
]);

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
const NUMERIC_REDACTION = 0;
const DEVICE_ICON_KEY_PATTERN = /^(?:icon|iconOverride)$/;
const SYSTEM_FINGERPRINT_STRING_KEYS = new Set(['nodeVersion', 'platform', 'rebootReason']);
const SYSTEM_FINGERPRINT_NUMBER_KEYS = new Set(['freemem', 'totalmem', 'uptime']);
const SYSTEM_FINGERPRINT_BOOLEAN_KEYS = new Set(['dateDst', 'devmode']);
const SYSTEM_INFO_PROTOCOL_KEYS = new Set([
	'address',
	'bootDate',
	'country',
	'cpus',
	'date',
	'dateDst',
	'dateHuman',
	'devmode',
	'freemem',
	'homeyModelName',
	'homeyPlatform',
	'homeyPlatformVersion',
	'homeyVersion',
	'hostname',
	'language',
	'loadavg',
	'mac',
	'nodeVersion',
	'platform',
	'rebootReason',
	'timezone',
	'totalmem',
	'uptime',
]);
const HOMEY_TERM_COLLIDING_PROTOCOL_KEYS = new Set(['homeBattery', 'homeBatteryVirtual', 'homeyclass']);
const PUBLIC_HOMEY_CAPABILITY_BASES = new Set([
	'actionEvents',
	'active_map',
	'alarm_battery',
	'alarm_bin_full',
	'alarm_co',
	'alarm_contact',
	'alarm_problem',
	'alarm_smoke',
	'alarm_stuck',
	'alarm_tank_empty',
	'alarm_tank_full',
	'battery_charging_state',
	'button',
	'clean_area',
	'clean_full',
	'clean_last',
	'clean_mode',
	'clean_time',
	'device_status',
	'dim',
	'dock',
	'effect',
	'empty_dustbin',
	'homealarm_state',
	'input_1',
	'input_external',
	'is_cleaning',
	'last_seen',
	'light_hue',
	'light_mode',
	'light_saturation',
	'light_temperature',
	'measure_battery',
	'measure_co2',
	'measure_current',
	'measure_humidity',
	'measure_linkquality',
	'measure_luminance',
	'measure_power',
	'measure_power_apparent',
	'measure_pressure',
	'measure_temperature',
	'measure_voltage',
	'meter_power',
	'meter_power_factor',
	'mop_attached',
	'mop_route',
	'onoff',
	'pause_clean',
	'position_x',
	'position_y',
	'power_on_behavior',
	'rssi',
	'scrub_intensity',
	'suction_power',
	'target_temperature',
	'wash_mop',
	'water_box_attached',
	'windowcoverings_set',
	'windowcoverings_state',
	'windowcoverings_tilt_set',
]);

export const isPublicHomeyCapabilityBase = (value: string): boolean => PUBLIC_HOMEY_CAPABILITY_BASES.has(value);

const PUBLIC_HOMEY_ENUM_STATES = new Map<string, ReadonlySet<string>>([
	['battery_charging_state', new Set(['charging', 'discharging', 'full'])],
	['light_mode', new Set(['color', 'temperature'])],
	['power_on_behavior', new Set(['off', 'on', 'previous'])],
	['windowcoverings_state', new Set(['down', 'idle', 'up'])],
]);

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
	individualDevice?: unknown;
	capabilityValue?: unknown;
}

type UnsafeCaptureCategory = 'email' | 'homey-token' | 'ipv4' | 'ipv6' | 'mac' | 'url';

interface UnsafeCaptureMatch {
	category: UnsafeCaptureCategory;
	section: keyof HomeyShsCapture | 'root';
}

interface SanitizerContext {
	aliases: SanitizationAliases;
	capabilityIdentifiers: Set<string>;
	privateTerms: string[];
	path: string[];
	rootKind: 'device' | 'generic' | 'zone';
}

interface PublishedMetadataOptions {
	redactDeviceIcons?: boolean;
	redactSystemFingerprint?: boolean;
	redactZoneIcons?: boolean;
}

export interface SanitizationAliases {
	counters: Map<string, number>;
	forbiddenSubstrings: Set<string>;
	sourceValues: Set<string>;
	values: Map<string, string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const isHomeySecretKey = (key: string): boolean =>
	SECRET_KEY_PATTERN.test(key) ||
	CAMEL_CASE_SECRET_CODE_KEY_PATTERN.test(key) ||
	BOUNDED_SECRET_CODE_KEY_PATTERN.test(key);

export const createSanitizationAliases = (): SanitizationAliases => ({
	counters: new Map(),
	forbiddenSubstrings: new Set(),
	sourceValues: new Set(),
	values: new Map(),
});

const registerPrivateTerms = (privateTerms: string[], aliases: SanitizationAliases): void => {
	privateTerms.forEach((term) => aliases.forbiddenSubstrings.add(term.toLowerCase()));
};

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
	let alias: string | undefined;
	const normalizedKind = kind.toLowerCase();
	const kindConflicts = [...aliases.forbiddenSubstrings].some((term) => normalizedKind.includes(term));
	const prefixes = kindConflicts ? NEUTRAL_ALIAS_PREFIXES : [kind, ...NEUTRAL_ALIAS_PREFIXES];

	for (const prefix of prefixes) {
		for (let attempt = 0; attempt < MAX_ALIAS_ATTEMPTS_PER_PREFIX; attempt += 1) {
			sequence += 1;
			const candidate = `${prefix}-${String(sequence).padStart(6, '0')}`;
			const normalizedCandidate = candidate.toLowerCase();
			const conflicts =
				aliases.sourceValues.has(normalizedCandidate) ||
				[...aliases.forbiddenSubstrings].some((term) => normalizedCandidate.includes(term));

			if (!conflicts) {
				alias = candidate;
				break;
			}
		}

		if (alias !== undefined) {
			break;
		}
	}

	if (alias === undefined) {
		throw new Error('Unable to allocate a Homey capture alias that excludes configured private terms');
	}

	aliases.counters.set(kind, sequence);
	aliases.sourceValues.add(alias.toLowerCase());
	aliases.values.set(key, alias);

	return alias;
};

const escapeRegularExpression = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ipv6Address = (candidate: string): string => candidate.split('%', 1)[0];

export const findHomeyIpv6Range = (candidate: string): { end: number; start: number } | null => {
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
	let range = findHomeyIpv6Range(remainder);

	while (range !== null) {
		sanitized += `${remainder.slice(0, range.start)}${replacement}`;
		remainder = remainder.slice(range.end);
		range = findHomeyIpv6Range(remainder);
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

const isCapabilityEnumOptionIdentifier = (
	key: string,
	path: string[],
	rootKind: SanitizerContext['rootKind'],
): boolean =>
	key === 'id' &&
	rootKind === 'device' &&
	path.length === 5 &&
	path[0] === 'root' &&
	(path[1] === 'capabilitiesObj' || path[1] === 'capabilityOptions') &&
	path[3] === 'values' &&
	/^\d+$/.test(path[4]);

const isPublicHomeyEnumState = (capabilityId: string, value: string): boolean => {
	const separator = capabilityId.indexOf('.');
	const capabilityBase = separator < 0 ? capabilityId : capabilityId.slice(0, separator);

	return PUBLIC_HOMEY_ENUM_STATES.get(capabilityBase)?.has(value) ?? false;
};

const sanitizeHomeyEnumState = (capabilityId: string, value: string, aliases: SanitizationAliases): string =>
	isPublicHomeyEnumState(capabilityId, value) ? value : pseudonym('enum-option', value, aliases);

const isCapabilityListEntry = (path: string[], rootKind: SanitizerContext['rootKind']): boolean =>
	rootKind === 'device' && path.length === 2 && path[0] === 'root' && path[1] === 'capabilities';

const isCapabilityReferenceField = (key: string, path: string[], rootKind: SanitizerContext['rootKind']): boolean =>
	rootKind === 'device' && (/capabilit|quickAction|uiIndicator/i.test(key) || path[path.length - 1] === 'capabilities');

const collectCapabilityIdentifiers = (value: unknown, rootKind: SanitizerContext['rootKind']): Set<string> => {
	if (rootKind !== 'device' || !isRecord(value)) {
		return new Set();
	}

	const identifiers = new Set(
		Array.isArray(value.capabilities)
			? value.capabilities.filter((capability): capability is string => typeof capability === 'string')
			: [],
	);

	for (const capabilityMap of [value.capabilitiesObj, value.capabilityOptions]) {
		if (isRecord(capabilityMap)) {
			Object.keys(capabilityMap).forEach((identifier) => identifiers.add(identifier));
		}
	}

	return identifiers;
};

const sanitizeCapabilityIdentifier = (value: string, aliases: SanitizationAliases): string => {
	const separator = value.indexOf('.');
	const base = separator < 0 ? value : value.slice(0, separator);
	const privateBase =
		!PUBLIC_HOMEY_CAPABILITY_BASES.has(base) &&
		[...aliases.forbiddenSubstrings].some((term) => base.toLowerCase().includes(term));
	const safeBase = privateBase ? pseudonym('capability-base', base, aliases) : base;

	if (separator < 0) {
		return safeBase;
	}

	return `${safeBase}.${pseudonym('capability-suffix', value.slice(separator + 1), aliases)}`;
};

const assertSanitizedCapabilityIdentifier = (value: unknown): void => {
	if (typeof value !== 'string') {
		throw new Error('Sanitized Homey capture contains an unredacted sensitive field');
	}

	const separator = value.indexOf('.');

	if (separator >= 0 && !GENERATED_PSEUDONYM_PATTERN.test(value.slice(separator + 1))) {
		throw new Error('Sanitized Homey capture contains an unredacted sensitive field');
	}
};

const isDriverMetadata = (path: string[]): boolean => path.includes('data') || path.includes('settings');

const isIdentifierMap = (key: string): boolean =>
	CAMEL_CASE_IDENTIFIER_MAP_KEY_PATTERN.test(key) || BOUNDED_IDENTIFIER_MAP_KEY_PATTERN.test(key);

export const isHomeyIdentifierKey = (key: string): boolean => IDENTIFIER_KEY_PATTERN.test(key);

export const isHomeyReferenceKey = (key: string): boolean => REFERENCE_KEY_PATTERN.test(key);

export const isHomeyReferenceArrayKey = (key: string): boolean =>
	CAMEL_CASE_REFERENCE_ARRAY_KEY_PATTERN.test(key) || BOUNDED_REFERENCE_ARRAY_KEY_PATTERN.test(key);

export const isHomeyUuid = (value: string): boolean => UUID_PATTERN.test(value);

const isTimestampKey = (key: string): boolean =>
	CAMEL_CASE_TIMESTAMP_KEY_PATTERN.test(key) ||
	BOUNDED_TIMESTAMP_KEY_PATTERN.test(key) ||
	HUMAN_TIMESTAMP_KEY_PATTERN.test(key);

export const isHomeyAddressKey = (key: string): boolean =>
	CAMEL_CASE_ADDRESS_KEY_PATTERN.test(key) || BOUNDED_ADDRESS_KEY_PATTERN.test(key);

export const isHomeyPersonalKey = (key: string): boolean =>
	CAMEL_CASE_PERSONAL_KEY_PATTERN.test(key) ||
	BOUNDED_PERSONAL_KEY_PATTERN.test(key) ||
	LOCATION_METADATA_KEY_PATTERN.test(key);

export const isHomeyGeneratedPseudonym = (value: unknown): value is string =>
	typeof value === 'string' && GENERATED_PSEUDONYM_PATTERN.test(value);

const isReferenceArrayKey = (key: string): boolean => isHomeyReferenceArrayKey(key);

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

const redactScalar = (value: unknown, marker: string): unknown => {
	if (value === null) {
		return null;
	}

	if (typeof value === 'number') {
		return NUMERIC_REDACTION;
	}

	if (typeof value === 'boolean') {
		return false;
	}

	return marker;
};

const sanitizeValue = (value: unknown, key: string, context: SanitizerContext): unknown => {
	const capabilityMapEntry = isCapabilityMap(context.path, context.rootKind);

	if (!capabilityMapEntry && isHomeySecretKey(key)) {
		return redactScalar(value, REDACTION.secret);
	}

	if (isHomeyPersonalKey(key)) {
		return redactScalar(value, REDACTION.privateTerm);
	}

	if (value !== null && !capabilityMapEntry && isTimestampKey(key)) {
		return redactScalar(value, FIXTURE_TIMESTAMP);
	}

	if (value !== null && !capabilityMapEntry && isHomeyAddressKey(key)) {
		return redactScalar(value, REDACTION.address);
	}

	if (value !== null && context.rootKind === 'zone' && key === 'icon') {
		return redactScalar(value, REDACTION.privateTerm);
	}

	if (value !== null && context.rootKind === 'device' && DEVICE_ICON_KEY_PATTERN.test(key)) {
		return redactScalar(value, REDACTION.privateTerm);
	}

	if (value !== null && !capabilityMapEntry && ENDPOINT_KEY_PATTERN.test(key)) {
		return redactScalar(value, REDACTION.url);
	}

	if (Array.isArray(value) && !capabilityMapEntry && isReferenceArrayKey(key)) {
		const kind = referenceArrayKind(key);

		return value.map((item) =>
			typeof item === 'string' ? pseudonym(kind, item, context.aliases) : redactScalar(item, REDACTION.value),
		);
	}

	if (
		value !== null &&
		!isRecord(value) &&
		!capabilityMapEntry &&
		!isCapabilityIdentifier(key, context.path, context.rootKind) &&
		!isCapabilityEnumOptionIdentifier(key, context.path, context.rootKind) &&
		(REFERENCE_KEY_PATTERN.test(key) || IDENTIFIER_KEY_PATTERN.test(key))
	) {
		return typeof value === 'string' && REFERENCE_KEY_PATTERN.test(key)
			? sanitizeReference(key, value, context.aliases)
			: redactScalar(value, REDACTION.identifier);
	}

	if (typeof value === 'number' && isDriverMetadata(context.path)) {
		return NUMERIC_REDACTION;
	}

	if (value === null || typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'string') {
		if (isCapabilityEnumOptionIdentifier(key, context.path, context.rootKind)) {
			return sanitizeHomeyEnumState(context.path[2], value, context.aliases);
		}

		if (isCapabilityReferenceField(key, context.path, context.rootKind) && context.capabilityIdentifiers.has(value)) {
			return sanitizeCapabilityIdentifier(value, context.aliases);
		}

		if (
			isCapabilityListEntry(context.path, context.rootKind) ||
			isCapabilityIdentifier(key, context.path, context.rootKind)
		) {
			return sanitizeCapabilityIdentifier(value, context.aliases);
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

	if (isCapabilityMap(context.path, context.rootKind) && value.type === 'enum' && Array.isArray(value.values)) {
		value.values.forEach((option) => {
			if (isRecord(option) && typeof option.id === 'string') {
				sanitizeHomeyEnumState(key, option.id, context.aliases);
			}
		});
	}

	const nextPath = [...context.path, key];
	const preserveKeys = isCapabilityMap(nextPath, context.rootKind);
	const identifierMap = isIdentifierMap(key);
	const enumCapability = isCapabilityMap(context.path, context.rootKind) && value.type === 'enum';

	return Object.fromEntries(
		Object.entries(value).map(([nestedKey, nestedValue]) => {
			const generatedPseudonym = GENERATED_PSEUDONYM_PATTERN.test(nestedKey);
			const sanitizedIdentifierEntry = generatedPseudonym && nestedValue === REDACTION.identifier;
			const identifierMapKey =
				identifierMap ||
				generatedPseudonym ||
				UUID_PATTERN.test(nestedKey) ||
				/^\d+$/.test(nestedKey) ||
				IDENTIFIER_KEY_PATTERN.test(nestedKey);
			const privateMapKey =
				!preserveKeys && (identifierMap || (identifierMapKey && !PRESERVED_STRUCTURAL_KEY_SET.has(nestedKey)));
			const safeKey = preserveKeys
				? sanitizeCapabilityIdentifier(nestedKey, context.aliases)
				: privateMapKey && !sanitizedIdentifierEntry
					? pseudonym('id', nestedKey, context.aliases)
					: nestedKey;

			const safeValue =
				enumCapability && nestedKey === 'value' && typeof nestedValue === 'string'
					? sanitizeHomeyEnumState(key, nestedValue, context.aliases)
					: sanitizeValue(nestedValue, nestedKey, { ...context, path: nextPath });

			return [safeKey, safeValue];
		}),
	);
};

export const sanitizeHomeyPayload = (
	value: unknown,
	privateTerms: string[] = [],
	rootKind: SanitizerContext['rootKind'] = 'generic',
	aliases: SanitizationAliases = createSanitizationAliases(),
): unknown => {
	registerPrivateTerms(privateTerms, aliases);
	registerSourceValues(value, aliases);

	return sanitizeValue(value, 'root', {
		aliases,
		capabilityIdentifiers: collectCapabilityIdentifiers(value, rootKind),
		privateTerms,
		path: [],
		rootKind,
	});
};

const sanitizedSystemCpu = (): Record<string, unknown> => ({
	model: REDACTION.identifier,
	speed: 0,
	times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
});

export const sanitizeHomeyPublishedMetadata = (value: unknown, options: PublishedMetadataOptions = {}): unknown => {
	if (Array.isArray(value)) {
		return value.map((item) => sanitizeHomeyPublishedMetadata(item, options));
	}

	if (!isRecord(value)) {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value).map(([key, nestedValue]) => {
			if (HUMAN_TIMESTAMP_KEY_PATTERN.test(key)) {
				return [key, FIXTURE_TIMESTAMP];
			}

			if (
				LOCATION_METADATA_KEY_PATTERN.test(key) ||
				(options.redactZoneIcons && key === 'icon') ||
				(options.redactDeviceIcons && DEVICE_ICON_KEY_PATTERN.test(key))
			) {
				return [key, REDACTION.privateTerm];
			}

			if (options.redactSystemFingerprint) {
				if (SYSTEM_FINGERPRINT_STRING_KEYS.has(key)) {
					return [key, REDACTION.identifier];
				}

				if (SYSTEM_FINGERPRINT_NUMBER_KEYS.has(key)) {
					return [key, 0];
				}

				if (SYSTEM_FINGERPRINT_BOOLEAN_KEYS.has(key)) {
					return [key, false];
				}

				if (key === 'loadavg') {
					return [key, [0, 0, 0]];
				}

				if (key === 'cpus') {
					return [key, [sanitizedSystemCpu()]];
				}
			}

			return [key, sanitizeHomeyPublishedMetadata(nestedValue, options)];
		}),
	);
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

	registerPrivateTerms(privateTerms, aliases);
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

interface HomeyReadTarget {
	deviceId: string;
	capabilityId: string;
}

const selectHomeyReadTarget = (devices: unknown): HomeyReadTarget => {
	if (!isRecord(devices)) {
		throw new Error('Homey devices response is not an object');
	}

	const candidates = Object.entries(devices)
		.sort(([left], [right]) => left.localeCompare(right))
		.flatMap(([deviceId, device]) => {
			if (!isRecord(device) || !isRecord(device.capabilitiesObj)) {
				return [];
			}

			return Object.entries(device.capabilitiesObj)
				.filter(([, capability]) => !isRecord(capability) || capability.getable !== false)
				.map(([capabilityId]) => ({ deviceId, capabilityId }));
		})
		.sort((left, right) => {
			const suffixPreference = Number(right.capabilityId.includes('.')) - Number(left.capabilityId.includes('.'));

			return (
				suffixPreference ||
				left.deviceId.localeCompare(right.deviceId) ||
				left.capabilityId.localeCompare(right.capabilityId)
			);
		});
	const target = candidates[0];

	if (!target) {
		throw new Error('Homey devices response has no readable capability target');
	}

	return target;
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
	const readTarget = selectHomeyReadTarget(devices);
	const individualDevicePath = `/api/manager/devices/device/${encodeURIComponent(readTarget.deviceId)}`;
	const capabilityValuePath = `${individualDevicePath}/capability/${encodeURIComponent(readTarget.capabilityId)}`;
	const [individualDeviceResponse, capabilityValueResponse] = await Promise.all([
		fetchHomey(config, individualDevicePath, 'individualDevice', true, fetchImplementation),
		fetchHomey(config, capabilityValuePath, 'capabilityValue', true, fetchImplementation),
	]);
	const [individualDevice, capabilityValue] = await Promise.all([
		readJson(individualDeviceResponse, 'individualDevice'),
		readJson(capabilityValueResponse, 'capabilityValue'),
	]);

	if (!isRecord(individualDevice) || individualDevice.id !== readTarget.deviceId) {
		throw new Error('Homey individualDevice response identity did not match the requested inventory device');
	}

	const aliases = createSanitizationAliases();
	registerSourceValues(config.expectedHost, aliases);
	registerPrivateTerms(config.privateTerms, aliases);
	registerSourceValues(systemInfo, aliases);
	registerSourceValues(zones, aliases);
	registerSourceValues(devices, aliases);
	registerSourceValues(individualDevice, aliases);
	registerSourceValues(capabilityValue, aliases);
	registerSourceValues(ping.headers.get('x-homey-id'), aliases);
	const sanitizedZones = sanitizeHomeyZones(zones, config.privateTerms, aliases);
	const sanitizedDevices = sanitizeHomeyDevices(devices, config.privateTerms, aliases);
	const sanitizedIndividualDevices = sanitizeHomeyDevices(
		{ [readTarget.deviceId]: individualDevice },
		config.privateTerms,
		aliases,
	);
	const safeDeviceId = pseudonym('device', readTarget.deviceId, aliases);
	const transportProtocol = config.origin.protocol.slice(0, -1);

	return {
		metadata: {
			schemaVersion: 1,
			capturedAt: new Date().toISOString(),
			transport: {
				protocol: transportProtocol,
				port: resolveHomeyTransportPort(transportProtocol, config.origin.port),
			},
			homey: {
				id: pseudonym('homey', ping.headers.get('x-homey-id') ?? 'unknown', aliases),
				version: sanitizeString(ping.headers.get('x-homey-version') ?? 'unknown', config.privateTerms),
				tier: sanitizeString(ping.headers.get('x-homey-tier') ?? 'unknown', config.privateTerms),
			},
			counts: {
				zones: Object.keys(sanitizedZones).length,
				devices: Object.keys(sanitizedDevices).length,
			},
			readEndpoints: {
				...READ_ENDPOINTS,
				individualDevice: '/api/manager/devices/device/:deviceId',
				capabilityValue: '/api/manager/devices/device/:deviceId/capability/:capabilityId',
			},
		},
		systemInfo: sanitizeHomeyPublishedMetadata(
			sanitizeHomeyPayload(systemInfo, config.privateTerms, 'generic', aliases),
			{ redactSystemFingerprint: true },
		),
		zones: sanitizedZones,
		devices: sanitizedDevices,
		individualDevice: sanitizedIndividualDevices[safeDeviceId],
		capabilityValue: {
			deviceId: safeDeviceId,
			capabilityId: sanitizeCapabilityIdentifier(readTarget.capabilityId, aliases),
			response: sanitizeHomeyPayload(capabilityValue, config.privateTerms, 'generic', aliases),
		},
	};
};

const throwUnredactedSensitiveField = (): never => {
	throw new Error('Sanitized Homey capture contains an unredacted sensitive field');
};

const assertRedactedScalar = (value: unknown, marker: string): void => {
	if (
		value !== null &&
		value !== marker &&
		!(typeof value === 'number' && value === NUMERIC_REDACTION) &&
		!(typeof value === 'boolean' && value === false)
	) {
		throwUnredactedSensitiveField();
	}
};

const assertGeneratedPseudonym = (value: unknown): void => {
	if (typeof value !== 'string' || !GENERATED_PSEUDONYM_PATTERN.test(value)) {
		throwUnredactedSensitiveField();
	}
};

const assertHomeyPayloadRedacted = (value: unknown, rootKind: SanitizerContext['rootKind']): void => {
	const capabilityIdentifiers = collectCapabilityIdentifiers(value, rootKind);
	const inspect = (nestedValue: unknown, key: string, path: string[]): void => {
		const capabilityMapEntry = isCapabilityMap(path, rootKind);
		const collectionIdentity =
			rootKind !== 'generic' && path.length === 1 && path[0] === 'root' && (key === 'id' || key === 'name');

		if (collectionIdentity) {
			assertGeneratedPseudonym(nestedValue);
			return;
		}

		if (!capabilityMapEntry && isHomeySecretKey(key)) {
			assertRedactedScalar(nestedValue, REDACTION.secret);
			return;
		}

		if (isHomeyPersonalKey(key)) {
			if (key !== 'name' || typeof nestedValue !== 'string' || !GENERATED_PSEUDONYM_PATTERN.test(nestedValue)) {
				assertRedactedScalar(nestedValue, REDACTION.privateTerm);
			}
			return;
		}

		if (nestedValue !== null && !capabilityMapEntry && isTimestampKey(key)) {
			assertRedactedScalar(nestedValue, FIXTURE_TIMESTAMP);
			return;
		}

		if (nestedValue !== null && !capabilityMapEntry && isHomeyAddressKey(key)) {
			assertRedactedScalar(nestedValue, REDACTION.address);
			return;
		}

		if (nestedValue !== null && rootKind === 'zone' && key === 'icon') {
			assertRedactedScalar(nestedValue, REDACTION.privateTerm);
			return;
		}

		if (nestedValue !== null && rootKind === 'device' && DEVICE_ICON_KEY_PATTERN.test(key)) {
			assertRedactedScalar(nestedValue, REDACTION.privateTerm);
			return;
		}

		if (nestedValue !== null && !capabilityMapEntry && ENDPOINT_KEY_PATTERN.test(key)) {
			assertRedactedScalar(nestedValue, REDACTION.url);
			return;
		}

		if (Array.isArray(nestedValue) && !capabilityMapEntry && isReferenceArrayKey(key)) {
			nestedValue.forEach((item) => {
				if (typeof item === 'string') {
					assertGeneratedPseudonym(item);
				} else {
					assertRedactedScalar(item, REDACTION.value);
				}
			});
			return;
		}

		if (
			nestedValue !== null &&
			!isRecord(nestedValue) &&
			!capabilityMapEntry &&
			!isCapabilityIdentifier(key, path, rootKind) &&
			!isCapabilityEnumOptionIdentifier(key, path, rootKind) &&
			(REFERENCE_KEY_PATTERN.test(key) || IDENTIFIER_KEY_PATTERN.test(key))
		) {
			if (typeof nestedValue === 'string' && REFERENCE_KEY_PATTERN.test(key)) {
				assertGeneratedPseudonym(nestedValue);
			} else {
				assertRedactedScalar(nestedValue, REDACTION.identifier);
			}
			return;
		}

		if (typeof nestedValue === 'number' && isDriverMetadata(path)) {
			if (nestedValue !== NUMERIC_REDACTION) {
				throwUnredactedSensitiveField();
			}
			return;
		}

		if (nestedValue === null || typeof nestedValue === 'number' || typeof nestedValue === 'boolean') {
			return;
		}

		if (typeof nestedValue === 'string') {
			if (isCapabilityEnumOptionIdentifier(key, path, rootKind)) {
				if (!isPublicHomeyEnumState(path[2], nestedValue)) {
					assertGeneratedPseudonym(nestedValue);
				}
				return;
			}

			if (isCapabilityListEntry(path, rootKind) || isCapabilityIdentifier(key, path, rootKind)) {
				assertSanitizedCapabilityIdentifier(nestedValue);
				return;
			}

			if (isCapabilityReferenceField(key, path, rootKind)) {
				if (nestedValue !== '.none' && !capabilityIdentifiers.has(nestedValue)) {
					throwUnredactedSensitiveField();
				}
				return;
			}

			if (ISO_TIMESTAMP_PATTERN.test(nestedValue)) {
				if (nestedValue !== FIXTURE_TIMESTAMP) {
					throwUnredactedSensitiveField();
				}
				return;
			}

			if (isDriverMetadata(path)) {
				assertRedactedScalar(nestedValue, REDACTION.identifier);
				return;
			}

			if (key === 'id' || UUID_PATTERN.test(nestedValue)) {
				assertGeneratedPseudonym(nestedValue);
			}
			return;
		}

		if (Array.isArray(nestedValue)) {
			nestedValue.forEach((item, index) => inspect(item, String(index), [...path, key]));
			return;
		}

		if (!isRecord(nestedValue)) {
			return throwUnredactedSensitiveField();
		}

		if (isCapabilityMap(path, rootKind) && nestedValue.type === 'enum') {
			if (Array.isArray(nestedValue.values)) {
				const optionIds = nestedValue.values.map((option) => (isRecord(option) ? option.id : undefined));

				optionIds.forEach((optionId) => {
					if (typeof optionId !== 'string' || !isPublicHomeyEnumState(key, optionId)) {
						assertGeneratedPseudonym(optionId);
					}
				});

				if (new Set(optionIds).size !== optionIds.length) {
					throwUnredactedSensitiveField();
				}

				if (typeof nestedValue.value === 'string' && !optionIds.includes(nestedValue.value)) {
					throwUnredactedSensitiveField();
				}
			} else {
				if (typeof nestedValue.value === 'string' && !isPublicHomeyEnumState(key, nestedValue.value)) {
					assertGeneratedPseudonym(nestedValue.value);
				}
			}
		}

		const nextPath = [...path, key];
		const preserveKeys = isCapabilityMap(nextPath, rootKind);
		const identifierMap = isIdentifierMap(key);

		Object.entries(nestedValue).forEach(([nestedKey, childValue]) => {
			if (preserveKeys) {
				assertSanitizedCapabilityIdentifier(nestedKey);
			}

			const generatedPseudonym = GENERATED_PSEUDONYM_PATTERN.test(nestedKey);
			const sanitizedIdentifierEntry = generatedPseudonym && childValue === REDACTION.identifier;
			const identifierMapKey =
				identifierMap ||
				generatedPseudonym ||
				UUID_PATTERN.test(nestedKey) ||
				/^\d+$/.test(nestedKey) ||
				IDENTIFIER_KEY_PATTERN.test(nestedKey);
			const privateMapKey =
				!preserveKeys && (identifierMap || (identifierMapKey && !PRESERVED_STRUCTURAL_KEY_SET.has(nestedKey)));

			if (privateMapKey && !sanitizedIdentifierEntry && !generatedPseudonym) {
				throwUnredactedSensitiveField();
			}

			inspect(childValue, nestedKey, nextPath);
		});
	};

	inspect(value, 'root', []);
};

export const assertHomeyCaptureRedacted = (capture: HomeyShsCapture): void => {
	assertHomeyPayloadRedacted(capture.systemInfo, 'generic');

	if (!isRecord(capture.zones) || !isRecord(capture.devices)) {
		throwUnredactedSensitiveField();
	}

	for (const [id, zone] of Object.entries(capture.zones)) {
		assertGeneratedPseudonym(id);
		assertHomeyPayloadRedacted(zone, 'zone');
	}

	for (const [id, device] of Object.entries(capture.devices)) {
		assertGeneratedPseudonym(id);
		assertHomeyPayloadRedacted(device, 'device');
	}

	if (capture.individualDevice !== undefined) {
		assertHomeyPayloadRedacted(capture.individualDevice, 'device');
	}

	if (capture.capabilityValue !== undefined) {
		const capabilityValue = capture.capabilityValue;

		if (!isRecord(capabilityValue) || typeof capabilityValue.capabilityId !== 'string') {
			return throwUnredactedSensitiveField();
		}

		assertGeneratedPseudonym(capabilityValue.deviceId);
		assertSanitizedCapabilityIdentifier(capabilityValue.capabilityId);
		assertHomeyPayloadRedacted(capabilityValue.response, 'generic');
	}
};

export const assertHomeyCaptureSafe = (
	capture: HomeyShsCapture,
	forbiddenValues: string[],
	privateTerms: string[] = [],
	expectedHost?: string,
): void => {
	const forbidden = forbiddenValues.filter((value) => value.length > 0);
	const containsForbiddenValue = (value: unknown, forbiddenValue: string): boolean => {
		if (typeof value === 'string' || typeof value === 'number') {
			return String(value).toLowerCase().includes(forbiddenValue);
		}

		if (Array.isArray(value)) {
			return value.some((item) => containsForbiddenValue(item, forbiddenValue));
		}

		if (isRecord(value)) {
			return Object.entries(value).some(
				([key, nestedValue]) =>
					key.toLowerCase().includes(forbiddenValue) || containsForbiddenValue(nestedValue, forbiddenValue),
			);
		}

		return false;
	};

	for (const value of forbidden) {
		if (containsForbiddenValue(capture, value.toLowerCase())) {
			throw new Error('Sanitized Homey capture still contains a configured forbidden value');
		}
	}

	const fixedPayloadKeys = new Set([
		'active',
		'available',
		'capabilities',
		'capabilitiesObj',
		'capabilityOptions',
		'capabilityId',
		'data',
		'deviceId',
		'deviceIds',
		'driverId',
		'enabled',
		'format',
		'homeBattery',
		'homeBatteryVirtual',
		'homeyId',
		'homeyclass',
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
	const isCapturedCapabilityMapPath = (path: string[]): boolean =>
		(path.length === 3 &&
			path[0] === 'devices' &&
			GENERATED_PSEUDONYM_PATTERN.test(path[1]) &&
			(path[2] === 'capabilitiesObj' || path[2] === 'capabilityOptions')) ||
		(path.length === 2 &&
			path[0] === 'individualDevice' &&
			(path[1] === 'capabilitiesObj' || path[1] === 'capabilityOptions'));
	const isCapturedCapabilityIdentifier = (key: string, path: string[]): boolean =>
		key === 'id' && isCapturedCapabilityMapPath(path.slice(0, -1));
	const isCapturedCapabilityListEntry = (path: string[]): boolean =>
		(path.length === 3 &&
			path[0] === 'devices' &&
			GENERATED_PSEUDONYM_PATTERN.test(path[1]) &&
			path[2] === 'capabilities') ||
		(path.length === 2 && path[0] === 'individualDevice' && path[1] === 'capabilities');
	const isCapturedCapabilityReadIdentifier = (key: string, path: string[]): boolean =>
		key === 'capabilityId' && path.length === 1 && path[0] === 'capabilityValue';
	const capturedEnumCapabilityId = (key: string, path: string[]): string | null => {
		if (key === 'value' && isCapturedCapabilityMapPath(path.slice(0, -1))) {
			return path[path.length - 1];
		}

		if (
			key === 'id' &&
			path.length >= 5 &&
			path[path.length - 2] === 'values' &&
			isCapturedCapabilityMapPath(path.slice(0, -3))
		) {
			return path[path.length - 3];
		}

		return null;
	};
	const isStructuralRecordPath = (path: string[]): boolean => {
		if (
			path.length === 1 &&
			(path[0] === 'systemInfo' || path[0] === 'individualDevice' || path[0] === 'capabilityValue')
		) {
			return true;
		}

		if (
			path.length === 2 &&
			(path[0] === 'devices' || path[0] === 'zones') &&
			GENERATED_PSEUDONYM_PATTERN.test(path[1])
		) {
			return true;
		}

		return isCapturedCapabilityMapPath(path.slice(0, -1));
	};
	const fixedCaptureRootKeys = new Set([
		'capabilityValue',
		'devices',
		'individualDevice',
		'metadata',
		'systemInfo',
		'zones',
	]);
	const fixedMetadataKeys = new Set(['capturedAt', 'counts', 'homey', 'readEndpoints', 'schemaVersion', 'transport']);
	const fixedMetadataNestedKeys = new Map<string, Set<string>>([
		['counts', new Set(['devices', 'zones'])],
		['homey', new Set(['id', 'tier', 'version'])],
		['readEndpoints', new Set(['capabilityValue', 'devices', 'individualDevice', 'systemInfo', 'zones'])],
		['transport', new Set(['port', 'protocol'])],
	]);
	const isFixedCaptureKey = (key: string, path: string[]): boolean => {
		if (path.length === 0) {
			return fixedCaptureRootKeys.has(key);
		}

		if (path.length === 1 && path[0] === 'metadata') {
			return fixedMetadataKeys.has(key);
		}

		if (path.length === 2 && path[0] === 'metadata') {
			return fixedMetadataNestedKeys.get(path[1])?.has(key) ?? false;
		}

		if (path.length === 1 && path[0] === 'systemInfo') {
			return SYSTEM_INFO_PROTOCOL_KEYS.has(key) || GENERATED_PSEUDONYM_PATTERN.test(key);
		}

		return isStructuralRecordPath(path) && fixedPayloadKeys.has(key);
	};

	if (expectedHost !== undefined) {
		const escapedHost = escapeRegularExpression(expectedHost);
		const hostTokenPattern = new RegExp(`(^|[^A-Za-z0-9.-])${escapedHost}(?=$|[^A-Za-z0-9.-])`, 'i');
		const globallyIdentifiableHost = expectedHost.includes('.') || expectedHost.includes(':');
		const hostLeakPattern = globallyIdentifiableHost ? new RegExp(escapedHost, 'i') : hostTokenPattern;
		let hostLeakFound = false;
		const inspectEndpointValues = (value: unknown, key = '', path: string[] = []): void => {
			if (typeof value === 'string') {
				const endpointShaped =
					globallyIdentifiableHost ||
					isHomeyAddressKey(key) ||
					ENDPOINT_KEY_PATTERN.test(key) ||
					value.includes('://') ||
					new RegExp(`${escapedHost}:\\d+`, 'i').test(value);
				const exactDynamicHostValue =
					!globallyIdentifiableHost &&
					value.toLowerCase() === expectedHost.toLowerCase() &&
					!isFixedCaptureKey(key, path);

				hostLeakFound ||= exactDynamicHostValue || (endpointShaped && hostLeakPattern.test(value));
			} else if (Array.isArray(value)) {
				value.forEach((item) => inspectEndpointValues(item, key, path));
			} else if (isRecord(value)) {
				const nextPath = key === '' ? path : [...path, key];

				Object.entries(value).forEach(([nestedKey, nestedValue]) => {
					const endpointShapedKey =
						isHomeyAddressKey(nestedKey) ||
						ENDPOINT_KEY_PATTERN.test(nestedKey) ||
						nestedKey.includes('://') ||
						new RegExp(`${escapedHost}:\\d+`, 'i').test(nestedKey);

					const exactDynamicHostKey =
						!globallyIdentifiableHost &&
						nestedKey.toLowerCase() === expectedHost.toLowerCase() &&
						!isFixedCaptureKey(nestedKey, nextPath);

					hostLeakFound ||=
						exactDynamicHostKey || ((globallyIdentifiableHost || endpointShapedKey) && hostLeakPattern.test(nestedKey));
					inspectEndpointValues(nestedValue, nestedKey, nextPath);
				});
			}
		};

		inspectEndpointValues(capture);

		if (hostLeakFound) {
			throw new Error('Sanitized Homey capture still contains the expected host in a value');
		}
	}

	const dynamicKeyContainsPrivateTerm = (key: string, term: string): boolean =>
		key.toLowerCase().includes(term.toLowerCase());
	const capturedCapabilityIdentifiers = new Set<string>();
	const registerCapturedCapabilityIdentifiers = (value: unknown): void => {
		if (!isRecord(value)) {
			return;
		}

		for (const capability of Array.isArray(value.capabilities) ? value.capabilities : []) {
			if (typeof capability === 'string') {
				capturedCapabilityIdentifiers.add(capability);
			}
		}

		for (const capabilityMap of [value.capabilitiesObj, value.capabilityOptions]) {
			if (isRecord(capabilityMap)) {
				Object.keys(capabilityMap).forEach((identifier) => capturedCapabilityIdentifiers.add(identifier));
			}
		}
	};

	if (isRecord(capture.devices)) {
		Object.values(capture.devices).forEach(registerCapturedCapabilityIdentifiers);
	}
	registerCapturedCapabilityIdentifiers(capture.individualDevice);
	const inspectPrivateTermValues = (value: unknown, key: string, path: string[], term: string): boolean => {
		if (typeof value === 'string') {
			const enumCapabilityId = capturedEnumCapabilityId(key, path);
			const publicEnumState = enumCapabilityId !== null && isPublicHomeyEnumState(enumCapabilityId, value);

			if (publicEnumState) {
				return false;
			}

			const publicCapabilityIdentifier =
				isCapturedCapabilityListEntry(path) ||
				isCapturedCapabilityIdentifier(key, path) ||
				isCapturedCapabilityReadIdentifier(key, path) ||
				(isCapabilityReferenceField(key, path, 'device') && capturedCapabilityIdentifiers.has(value));
			if (publicCapabilityIdentifier) {
				const separator = value.indexOf('.');
				const base = separator < 0 ? value : value.slice(0, separator);
				const suffix = separator < 0 ? '' : value.slice(separator + 1);
				const privateBase = !PUBLIC_HOMEY_CAPABILITY_BASES.has(base) && base.toLowerCase().includes(term.toLowerCase());
				const privateSuffix = suffix.replace(REDACTION_PATTERN, '').toLowerCase().includes(term.toLowerCase());

				return privateBase || privateSuffix;
			}

			return value.replace(REDACTION_PATTERN, '').toLowerCase().includes(term.toLowerCase());
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
				const structuralKey =
					(structuralRecord && isFixedCaptureKey(nestedKey, nextPath)) ||
					(isDriverMetadata(nextPath) && fixedPayloadKeys.has(nestedKey)) ||
					HOMEY_TERM_COLLIDING_PROTOCOL_KEYS.has(nestedKey);
				const privateDynamicKey = !preserveKeys && !structuralKey && dynamicKeyContainsPrivateTerm(nestedKey, term);

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
			['individualDevice', capture.individualDevice],
			['capabilityValue', capture.capabilityValue],
		].some(([payloadKey, value]) => inspectPrivateTermValues(value, payloadKey as string, [], term));

		if (privateTermFound) {
			throw new Error('Sanitized Homey capture still contains a configured private term');
		}
	}

	const containsUnredactedEndpoint = (value: unknown, key = ''): boolean => {
		if (typeof value === 'string') {
			return ENDPOINT_KEY_PATTERN.test(key) && value !== REDACTION.url;
		}

		if (Array.isArray(value)) {
			return value.some((item) => containsUnredactedEndpoint(item, key));
		}

		return isRecord(value)
			? Object.entries(value).some(([nestedKey, nestedValue]) => containsUnredactedEndpoint(nestedValue, nestedKey))
			: false;
	};

	if (containsUnredactedEndpoint(capture)) {
		throw new Error('Sanitized Homey capture still contains an unredacted endpoint value');
	}

	const containsUnredactedSourceMetadata = (value: unknown, section = '', key = ''): boolean => {
		if (Array.isArray(value)) {
			return value.some((item) => containsUnredactedSourceMetadata(item, section, key));
		}

		if (isRecord(value)) {
			return Object.entries(value).some(([nestedKey, nestedValue]) => {
				if (HUMAN_TIMESTAMP_KEY_PATTERN.test(nestedKey)) {
					return nestedValue !== FIXTURE_TIMESTAMP;
				}

				if (LOCATION_METADATA_KEY_PATTERN.test(nestedKey)) {
					return nestedValue !== REDACTION.privateTerm;
				}

				if (section === 'zones' && nestedKey === 'icon') {
					return nestedValue !== REDACTION.privateTerm;
				}

				if ((section === 'devices' || section === 'individualDevice') && DEVICE_ICON_KEY_PATTERN.test(nestedKey)) {
					return nestedValue !== REDACTION.privateTerm;
				}

				if (section === 'systemInfo') {
					if (SYSTEM_FINGERPRINT_STRING_KEYS.has(nestedKey)) {
						return nestedValue !== REDACTION.identifier;
					}

					if (SYSTEM_FINGERPRINT_NUMBER_KEYS.has(nestedKey)) {
						return nestedValue !== 0;
					}

					if (SYSTEM_FINGERPRINT_BOOLEAN_KEYS.has(nestedKey)) {
						return nestedValue !== false;
					}

					if (nestedKey === 'loadavg') {
						return JSON.stringify(nestedValue) !== JSON.stringify([0, 0, 0]);
					}

					if (nestedKey === 'cpus') {
						return JSON.stringify(nestedValue) !== JSON.stringify([sanitizedSystemCpu()]);
					}
				}

				const nestedSection = section === '' ? nestedKey : section;

				return containsUnredactedSourceMetadata(nestedValue, nestedSection, nestedKey);
			});
		}

		return HUMAN_TIMESTAMP_KEY_PATTERN.test(key) || LOCATION_METADATA_KEY_PATTERN.test(key);
	};

	if (containsUnredactedSourceMetadata(capture)) {
		throw new Error('Sanitized Homey capture still contains unredacted metadata, icons, or host fingerprint');
	}

	const unsafeStringCategory = (value: string): UnsafeCaptureCategory | null => {
		const patterns: Array<[UnsafeCaptureCategory, RegExp]> = [
			['ipv4', IPV4_PATTERN],
			['mac', MAC_PATTERN],
			['url', URL_PATTERN],
			['email', EMAIL_PATTERN],
			['homey-token', HOMEY_TOKEN_PATTERN],
		];

		for (const [category, pattern] of patterns) {
			if (new RegExp(pattern.source, pattern.flags).test(value)) {
				return category;
			}
		}

		return replaceIpv6Addresses(value, REDACTION.address) !== value ? 'ipv6' : null;
	};
	const unsafeCaptureMatch = (
		value: unknown,
		section: UnsafeCaptureMatch['section'] = 'root',
	): UnsafeCaptureMatch | null => {
		if (typeof value === 'string') {
			const category = unsafeStringCategory(value);

			return category === null ? null : { category, section };
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				const match = unsafeCaptureMatch(item, section);

				if (match !== null) {
					return match;
				}
			}

			return null;
		}

		if (!isRecord(value)) {
			return null;
		}

		for (const [key, nestedValue] of Object.entries(value)) {
			const nestedSection = section === 'root' && key in capture ? (key as keyof HomeyShsCapture) : section;
			const keyCategory = unsafeStringCategory(key);

			if (keyCategory !== null) {
				return { category: keyCategory, section: nestedSection };
			}

			const match = unsafeCaptureMatch(nestedValue, nestedSection);

			if (match !== null) {
				return match;
			}
		}

		return null;
	};
	const unsafeMatch = unsafeCaptureMatch(capture);

	if (unsafeMatch !== null) {
		throw new Error(
			`Sanitized Homey capture still contains a secret, address, or email-like value ` +
				`(category: ${unsafeMatch.category}, section: ${unsafeMatch.section})`,
		);
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

	assertHomeyCaptureRedacted(capture);
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
