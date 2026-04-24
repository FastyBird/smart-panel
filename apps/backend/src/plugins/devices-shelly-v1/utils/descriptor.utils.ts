import { DESCRIPTORS, DeviceDescriptor } from '../devices-shelly-v1.constants';

/**
 * Resolve the descriptor for a Shelly Gen 1 device's reported type. Used by every
 * caller that needs to map a device-reported model code (e.g. `SHSW-1`) onto a
 * descriptor in `DESCRIPTORS`: discovery wizard, device mapper, device platform,
 * and any future caller. Keeping this in one place is critical — divergent matching
 * strategies cause user-visible inconsistencies (e.g. the wizard reporting
 * `unsupported` for a device the main connector adopts cleanly).
 *
 * Matching is two-pass and case-insensitive:
 * 1. **Model substring match.** Each descriptor lists canonical model codes
 *    (`SHSW-1`, `SHSW-PM`, …). A device whose `type` *contains* one of those codes
 *    matches that descriptor — covers Shelly's habit of suffixing variants
 *    (`SHSW-1-extra`).
 * 2. **Key / friendly-name fallback.** If no model matches, look for the
 *    descriptor key (`SHELLY1`, `SHELLY1PM`, …) inside the type, or the friendly
 *    name (`Shelly 1`) inside the type. This recovers devices that report a name
 *    rather than a model code.
 */
export const findShellyV1Descriptor = (deviceType: string | null | undefined): DeviceDescriptor | null => {
	if (typeof deviceType !== 'string' || deviceType.length === 0) {
		return null;
	}

	const normalizedType = deviceType.toUpperCase();

	for (const descriptor of Object.values(DESCRIPTORS)) {
		if (descriptor.models.some((model) => normalizedType.includes(model.toUpperCase()))) {
			return descriptor;
		}
	}

	for (const [key, descriptor] of Object.entries(DESCRIPTORS)) {
		if (normalizedType.includes(key) || descriptor.name.toUpperCase().includes(normalizedType)) {
			return descriptor;
		}
	}

	return null;
};
