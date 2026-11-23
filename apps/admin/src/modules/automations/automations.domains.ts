import type { Domain } from '../../common/components/domain-icon.types';
import { deviceCategoryDomain } from '../../common/components/domain-icon.utils';
import type { DevicesModuleDeviceCategory } from '../../openapi.constants';

/*
 * The domain a block works with (spec section 7: the host adds `domain-icon`), from the devices its configuration
 * names. A block with devices of one domain shows it; a block with none, or with devices of several, shows none.
 */

export { deviceCategoryDomain };

/** Every device a block's configuration names (`device_id`, at any depth: a list of writes names one per row) */
export const configDeviceIds = (config: unknown): string[] => {
	const ids = new Set<string>();

	const visit = (value: unknown): void => {
		if (Array.isArray(value)) {
			value.forEach(visit);
		} else if (value !== null && typeof value === 'object') {
			for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
				if (key === 'device_id' && typeof item === 'string' && item !== '') {
					ids.add(item);
				} else {
					visit(item);
				}
			}
		}
	};

	visit(config);

	return [...ids];
};

/** The one domain of the named devices, given how to find a device's category */
export const configDomain = (
	config: unknown,
	categoryOf: (deviceId: string) => DevicesModuleDeviceCategory | null | undefined
): Domain | undefined => {
	const domains = new Set(configDeviceIds(config).map((id) => deviceCategoryDomain(categoryOf(id))));

	if (domains.size !== 1) {
		return undefined;
	}

	return [...domains][0];
};
