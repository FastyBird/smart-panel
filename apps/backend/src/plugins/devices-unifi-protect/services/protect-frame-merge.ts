import { PROTECT_ID_PATTERN } from '../client/protect-endpoints';
import { PROTECT_MAX_FRAME_BYTES } from '../devices-unifi-protect.constants';
import { ProtectMappedDevice } from '../mappings/mapping-evaluator';
import { ProtectMappingScalar, ProtectResolvedMappings } from '../mappings/mapping.types';

export type ProtectFrameAction = 'add' | 'update' | 'remove';

export interface ProtectFrame {
	action: ProtectFrameAction;
	id: string;
	modelKey: string;
	item: Readonly<Record<string, unknown>>;
}

export type ProtectFrameRejection = 'too_large' | 'not_json' | 'invalid_shape' | 'too_deep';

const MAX_DEPTH = 8;
const MAX_KEYS = 512;
const MODEL_KEY_PATTERN = /^[A-Za-z]{1,32}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ACTIONS: readonly string[] = ['add', 'update', 'remove'];
const CONNECTION_STATE = 'connection_state';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value) as unknown;

	return prototype === Object.prototype || prototype === null;
};

/** True when nesting of objects and arrays exceeds the limit (one bounded walk, no recursion). */
const exceedsDepth = (root: unknown): boolean => {
	const stack: { value: unknown; depth: number }[] = [{ value: root, depth: 1 }];

	while (stack.length > 0) {
		const { value, depth } = stack.pop() as { value: unknown; depth: number };

		if (typeof value !== 'object' || value === null) {
			continue;
		}

		if (depth > MAX_DEPTH) {
			return true;
		}

		for (const child of Array.isArray(value) ? value : Object.values(value)) {
			stack.push({ value: child, depth: depth + 1 });
		}
	}

	return false;
};

/** Never throws. */
export function parseProtectFrame(text: string): { frame: ProtectFrame } | { rejected: ProtectFrameRejection } {
	if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > PROTECT_MAX_FRAME_BYTES) {
		return { rejected: 'too_large' };
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(text);
	} catch {
		return { rejected: 'not_json' };
	}

	if (!isPlainObject(parsed) || typeof parsed.type !== 'string' || !ACTIONS.includes(parsed.type)) {
		return { rejected: 'invalid_shape' };
	}

	const item = parsed.item;

	if (!isPlainObject(item)) {
		return { rejected: 'invalid_shape' };
	}

	const { id, modelKey } = item;

	if (
		typeof id !== 'string' ||
		!PROTECT_ID_PATTERN.test(id) ||
		typeof modelKey !== 'string' ||
		!MODEL_KEY_PATTERN.test(modelKey)
	) {
		return { rejected: 'invalid_shape' };
	}

	if (exceedsDepth(item)) {
		return { rejected: 'too_deep' };
	}

	return { frame: { action: parsed.type as ProtectFrameAction, id, modelKey, item } };
}

/** Copy with the safety limits applied; anything deeper than the limit is dropped. */
const sanitize = (value: unknown, depth: number): unknown => {
	if (Array.isArray(value)) {
		return depth >= MAX_DEPTH ? [] : value.map((entry) => sanitize(entry, depth + 1));
	}

	if (isPlainObject(value)) {
		return depth >= MAX_DEPTH ? {} : mergeAt({}, value, depth);
	}

	return value;
};

const mergeAt = (
	cached: Readonly<Record<string, unknown>>,
	partial: Readonly<Record<string, unknown>>,
	depth: number,
): Record<string, unknown> => {
	const result: Record<string, unknown> = {};
	let count = 0;

	for (const key of Object.keys(cached)) {
		if (FORBIDDEN_KEYS.has(key) || count >= MAX_KEYS) {
			continue;
		}

		result[key] = sanitize(cached[key], depth + 1);
		count++;
	}

	for (const key of Object.keys(partial)) {
		if (FORBIDDEN_KEYS.has(key)) {
			continue;
		}

		const exists = Object.hasOwn(result, key);

		if (!exists && count >= MAX_KEYS) {
			continue;
		}

		const incoming = partial[key];
		const current = exists ? result[key] : undefined;

		if (depth >= MAX_DEPTH && (isPlainObject(incoming) || Array.isArray(incoming))) {
			continue;
		}

		result[key] =
			isPlainObject(incoming) && isPlainObject(current)
				? mergeAt(current, incoming, depth + 1)
				: sanitize(incoming, depth + 1);

		if (!exists) {
			count++;
		}
	}

	return result;
};

/**
 * New object; plain objects merge recursively, everything else (arrays included) replaces. Skips
 * `__proto__`/`constructor`/`prototype`; depth is limited to 8 and objects to 512 keys (extra keys are dropped).
 */
export function mergeProtectItem(
	cached: Readonly<Record<string, unknown>>,
	partial: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
	return mergeAt(cached, partial, 1);
}

/** Mapping names the sync may write: value source `path`, minus `connection_state`. */
export function syncableMappingNames(mappings: ProtectResolvedMappings): ReadonlySet<string> {
	const names = new Set<string>();

	for (const property of mappings.properties) {
		if (property.value !== null && 'path' in property.value && property.name !== CONNECTION_STATE) {
			names.add(property.name);
		}
	}

	return names;
}

export interface ProtectValueChange {
	channelIdentifier: string;
	mappingName: string;
	value: Exclude<ProtectMappingScalar, null>;
}

const valueKey = (channelIdentifier: string, mappingName: string): string => `${channelIdentifier}\u0000${mappingName}`;

export function mappedValueMap(device: ProtectMappedDevice): Map<string, ProtectMappingScalar> {
	const values = new Map<string, ProtectMappingScalar>();

	for (const channel of device.channels) {
		for (const property of channel.properties) {
			values.set(valueKey(channel.identifier, property.mappingName), property.value);
		}
	}

	return values;
}

/** Syncable, non-null values of `next` that differ from `previous`; a null `previous` reports all of them. */
export function diffMappedValues(
	previous: ReadonlyMap<string, ProtectMappingScalar> | null,
	next: ProtectMappedDevice,
	syncable: ReadonlySet<string>,
): ProtectValueChange[] {
	const changes: ProtectValueChange[] = [];

	for (const channel of next.channels) {
		for (const property of channel.properties) {
			if (property.value === null || !syncable.has(property.mappingName)) {
				continue;
			}

			const key = valueKey(channel.identifier, property.mappingName);

			if (previous !== null && previous.has(key) && previous.get(key) === property.value) {
				continue;
			}

			changes.push({
				channelIdentifier: channel.identifier,
				mappingName: property.mappingName,
				value: property.value,
			});
		}
	}

	return changes;
}

/** The mapped connection_state value ('connected' | 'init' | 'disconnected' | 'unknown') or null. */
export function mappedConnectionState(device: ProtectMappedDevice): string | null {
	for (const channel of device.channels) {
		for (const property of channel.properties) {
			if (property.mappingName === CONNECTION_STATE) {
				return typeof property.value === 'string' ? property.value : null;
			}
		}
	}

	return null;
}
