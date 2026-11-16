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

const isAllowedLeaf = (value: unknown): boolean =>
	typeof value === 'boolean' ||
	(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 100);

/**
 * True when the body is a non-empty plain object, depth at most 2, every leaf path is allow-listed for the resource and
 * every leaf is a boolean or a safe integer 0-100.
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

	return keys.every((key) => {
		const value = body[key];

		if (!isPlainObject(value)) {
			return allowed.includes(key) && isAllowedLeaf(value);
		}

		const inner = Object.keys(value);

		return inner.length > 0 && inner.every((name) => allowed.includes(`${key}.${name}`) && isAllowedLeaf(value[name]));
	});
}
