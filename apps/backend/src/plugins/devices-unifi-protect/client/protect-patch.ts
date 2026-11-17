export const PROTECT_PATCH_RESOURCES = ['cameras', 'lights'] as const;

export type ProtectPatchResource = (typeof PROTECT_PATCH_RESOURCES)[number];

/** The only leaves a PATCH may carry (C1, C5), in body order. */
export const PROTECT_PATCHABLE_FIELDS: Readonly<Record<ProtectPatchResource, readonly string[]>> = {
	cameras: ['ledSettings.isEnabled', 'micVolume'],
	lights: ['isLightForceEnabled', 'lightDeviceSettings.ledLevel', 'lightDeviceSettings.isIndicatorEnabled'],
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	const prototype = Object.getPrototypeOf(value) as unknown;

	return prototype === Object.prototype || prototype === null;
};

type LeafRule = (value: unknown) => boolean;

const isBoolean: LeafRule = (value) => typeof value === 'boolean';

const integerBetween =
	(min: number, max: number): LeafRule =>
	(value) =>
		typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

/** The value kind and range of every patchable leaf, keyed by its dotted path. */
const LEAF_RULES: Readonly<Record<string, LeafRule>> = {
	isLightForceEnabled: isBoolean,
	'lightDeviceSettings.isIndicatorEnabled': isBoolean,
	'ledSettings.isEnabled': isBoolean,
	micVolume: integerBetween(0, 100),
	'lightDeviceSettings.ledLevel': integerBetween(1, 6),
};

/**
 * True when the body is a non-empty plain object, depth at most 2, every leaf path is allow-listed for the resource and
 * every leaf has its field's kind and range. A top-level key containing a dot is refused.
 */
export function isAllowedProtectPatch(resource: ProtectPatchResource, body: unknown): body is Record<string, unknown> {
	if (!(PROTECT_PATCH_RESOURCES as readonly string[]).includes(resource) || !isPlainObject(body)) {
		return false;
	}

	const allowed = PROTECT_PATCHABLE_FIELDS[resource];
	const keys = Object.keys(body);

	if (keys.length === 0) {
		return false;
	}

	const leafOk = (path: string, value: unknown): boolean =>
		allowed.includes(path) && Object.hasOwn(LEAF_RULES, path) && LEAF_RULES[path](value);

	return keys.every((key) => {
		if (key.includes('.')) {
			return false;
		}

		const value = body[key];

		if (!isPlainObject(value)) {
			return leafOk(key, value);
		}

		const inner = Object.keys(value);

		return inner.length > 0 && inner.every((name) => leafOk(`${key}.${name}`, value[name]));
	});
}
