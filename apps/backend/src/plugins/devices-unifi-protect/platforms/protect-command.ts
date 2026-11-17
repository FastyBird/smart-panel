import { PROTECT_PATCHABLE_FIELDS, ProtectPatchResource } from '../client/protect-patch';

export type ProtectCommandOutcome =
	| 'confirmed'
	| 'not_controllable'
	| 'invalid_value'
	| 'conflict'
	| 'unavailable'
	| 'busy'
	| 'rejected'
	| 'unauthorized'
	| 'not_found'
	| 'rate_limited'
	| 'failed'
	| 'not_confirmed'
	| 'skipped';

export interface ProtectPropertyOutcome {
	propertyId: string;
	mappingName: string | null;
	outcome: ProtectCommandOutcome;
}

export type ProtectWritableMappingName =
	| 'light_on'
	| 'light_brightness'
	| 'floodlight_indicator_on'
	| 'camera_indicator_on'
	| 'microphone_volume';

type RawObject = Readonly<Record<string, unknown>>;

export interface ProtectWritableMapping {
	modelKey: 'camera' | 'light';
	resource: ProtectPatchResource;
	channelIdentifier: 'light' | 'indicator' | 'microphone';
	/** One of PROTECT_PATCHABLE_FIELDS[resource]. */
	path: string;
	/** C1 capability column, evaluated on the cached console object. */
	supported(raw: RawObject): boolean;
	/** The Protect leaf for a panel value; null = invalid. */
	toProtect(value: string | number | boolean): boolean | number | null;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value) as unknown;

	// Realm-independent: a plain object's prototype is null or the root of its own chain.
	return prototype === null || Object.getPrototypeOf(prototype) === null;
};

const FORBIDDEN_SEGMENTS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

/** Reads a dotted path through own plain-object properties only. */
export const readProtectPath = (raw: RawObject | null, path: string): unknown => {
	let current: unknown = raw;

	for (const segment of path.split('.')) {
		if (
			!isPlainObject(current) ||
			FORBIDDEN_SEGMENTS.includes(segment) ||
			!Object.prototype.hasOwnProperty.call(current, segment)
		) {
			return undefined;
		}

		current = current[segment];
	}

	return current;
};

export const brightnessToLedLevel = (percent: number): number =>
	Math.min(6, Math.max(1, Math.round((percent * 6) / 100)));

const toBoolean = (value: string | number | boolean): boolean | null => (typeof value === 'boolean' ? value : null);

const toPercentInteger = (value: string | number | boolean): number | null =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;

const toLedLevel = (value: string | number | boolean): number | null => {
	const percent = toPercentInteger(value);

	return percent === null ? null : brightnessToLedLevel(percent);
};

const hasType = (raw: RawObject, path: string, type: 'boolean' | 'number'): boolean =>
	typeof readProtectPath(raw, path) === type;

export const PROTECT_WRITABLE_MAPPINGS: Readonly<Record<ProtectWritableMappingName, ProtectWritableMapping>> = {
	light_on: {
		modelKey: 'light',
		resource: 'lights',
		channelIdentifier: 'light',
		path: 'isLightForceEnabled',
		supported: (raw) => hasType(raw, 'isLightForceEnabled', 'boolean'),
		toProtect: toBoolean,
	},
	light_brightness: {
		modelKey: 'light',
		resource: 'lights',
		channelIdentifier: 'light',
		path: 'lightDeviceSettings.ledLevel',
		supported: (raw) => hasType(raw, 'lightDeviceSettings.ledLevel', 'number'),
		toProtect: toLedLevel,
	},
	floodlight_indicator_on: {
		modelKey: 'light',
		resource: 'lights',
		channelIdentifier: 'indicator',
		path: 'lightDeviceSettings.isIndicatorEnabled',
		supported: (raw) => hasType(raw, 'lightDeviceSettings.isIndicatorEnabled', 'boolean'),
		toProtect: toBoolean,
	},
	camera_indicator_on: {
		modelKey: 'camera',
		resource: 'cameras',
		channelIdentifier: 'indicator',
		path: 'ledSettings.isEnabled',
		supported: (raw) => readProtectPath(raw, 'featureFlags.hasLedStatus') === true,
		toProtect: toBoolean,
	},
	microphone_volume: {
		modelKey: 'camera',
		resource: 'cameras',
		channelIdentifier: 'microphone',
		path: 'micVolume',
		supported: (raw) => readProtectPath(raw, 'featureFlags.hasMic') === true,
		toProtect: toPercentInteger,
	},
};

export interface ProtectPatchField {
	path: string;
	value: boolean | number;
}

/** Strict equality per path; a null object never matches. */
export const protectFieldsMatch = (raw: RawObject | null, fields: readonly ProtectPatchField[]): boolean =>
	raw !== null && fields.every((field) => readProtectPath(raw, field.path) === field.value);

/** Nested body in PROTECT_PATCHABLE_FIELDS order. */
export const buildProtectPatchBody = (
	resource: ProtectPatchResource,
	fields: readonly ProtectPatchField[],
): Record<string, unknown> => {
	const body: Record<string, unknown> = {};

	for (const path of PROTECT_PATCHABLE_FIELDS[resource]) {
		const field = fields.find((candidate) => candidate.path === path);

		if (!field) {
			continue;
		}

		const [head, tail] = path.split('.');

		if (tail === undefined) {
			body[head] = field.value;
		} else {
			const inner = (body[head] ??= {}) as Record<string, unknown>;

			inner[tail] = field.value;
		}
	}

	return body;
};

export interface ProtectCommandInput {
	propertyId: string;
	mappingName: string | null;
	channelIdentifier: string;
	protectDeviceId: string;
	modelKey: string | null;
	/** Already validated by validatePropertyCommandValue. */
	value: string | number | boolean;
	/** Synchronizer cache entry. */
	cached: RawObject | null;
}

export interface ProtectDeviceCommand {
	/** `${modelKey}\u0000${protectDeviceId}` */
	key: string;
	protectDeviceId: string;
	modelKey: 'camera' | 'light';
	resource: ProtectPatchResource;
	fields: ProtectPatchField[];
	propertyIds: string[];
	/** propertyId -> mapping name */
	mappingNames: Map<string, string>;
}

export type ProtectCommandPlan =
	| { ok: true; commands: ProtectDeviceCommand[] }
	| { ok: false; outcomes: ProtectPropertyOutcome[] };

const fail = (
	inputs: readonly ProtectCommandInput[],
	index: number,
	outcome: ProtectCommandOutcome,
): ProtectCommandPlan => ({
	ok: false,
	outcomes: inputs.map((entry, position) => ({
		propertyId: entry.propertyId,
		mappingName: entry.mappingName,
		outcome: position === index ? outcome : 'skipped',
	})),
});

const lookupMapping = (name: string | null): ProtectWritableMapping | null =>
	name !== null && Object.prototype.hasOwnProperty.call(PROTECT_WRITABLE_MAPPINGS, name)
		? PROTECT_WRITABLE_MAPPINGS[name as ProtectWritableMappingName]
		: null;

/** Pure: validates every input, then groups them into one PATCH per Protect device. Fails closed. */
export function planProtectCommands(inputs: readonly ProtectCommandInput[]): ProtectCommandPlan {
	const converted: { mapping: ProtectWritableMapping; value: boolean | number }[] = [];

	for (let index = 0; index < inputs.length; index++) {
		const entry = inputs[index];
		const mapping = lookupMapping(entry.mappingName);

		if (
			mapping === null ||
			entry.channelIdentifier !== mapping.channelIdentifier ||
			(entry.modelKey !== null && entry.modelKey !== mapping.modelKey)
		) {
			return fail(inputs, index, 'not_controllable');
		}

		if (entry.cached === null || entry.cached.state !== 'CONNECTED') {
			return fail(inputs, index, 'unavailable');
		}

		if (!mapping.supported(entry.cached)) {
			return fail(inputs, index, 'not_controllable');
		}

		const value = mapping.toProtect(entry.value);

		if (value === null) {
			return fail(inputs, index, 'invalid_value');
		}

		converted.push({ mapping, value });
	}

	const commands = new Map<string, ProtectDeviceCommand>();
	const requested = new Map<string, boolean | number>();
	const writers = new Map<string, string>();

	for (let index = 0; index < inputs.length; index++) {
		const entry = inputs[index];
		const { mapping, value } = converted[index];
		const key = `${mapping.modelKey}\u0000${entry.protectDeviceId}`;
		const fieldKey = `${key}\u0000${mapping.path}`;

		let command = commands.get(key);

		if (!command) {
			command = {
				key,
				protectDeviceId: entry.protectDeviceId,
				modelKey: mapping.modelKey,
				resource: mapping.resource,
				fields: [],
				propertyIds: [],
				mappingNames: new Map(),
			};
			commands.set(key, command);
		}

		const propertyKey = `${key}\u0000${entry.propertyId}`;
		const previousValue = requested.get(propertyKey);

		if (command.propertyIds.includes(entry.propertyId)) {
			if (previousValue !== value) {
				return fail(inputs, index, 'conflict');
			}

			continue;
		}

		if (writers.has(fieldKey)) {
			return fail(inputs, index, 'conflict');
		}

		writers.set(fieldKey, entry.propertyId);
		requested.set(propertyKey, value);
		command.propertyIds.push(entry.propertyId);
		command.mappingNames.set(entry.propertyId, entry.mappingName);
		command.fields.push({ path: mapping.path, value });
	}

	for (const command of commands.values()) {
		const order = PROTECT_PATCHABLE_FIELDS[command.resource];

		command.fields.sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path));
	}

	return { ok: true, commands: [...commands.values()] };
}
