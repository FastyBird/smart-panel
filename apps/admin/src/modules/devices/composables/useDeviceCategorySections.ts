import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue';

import { type IModule, injectModulesManager } from '../../../common';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import type { IDeviceCategorySection, IDevicesModuleElementComponents } from '../devices.types';
import type { IDevice } from '../store/devices.store.types';

/**
 * The category sections modules registered for the device's category, sorted by `order` (registration order on ties).
 */
export const useDeviceCategorySections = (device: MaybeRefOrGetter<IDevice | null>): ComputedRef<IDeviceCategorySection[]> => {
	const modulesManager = injectModulesManager();

	return computed<IDeviceCategorySection[]>(() => {
		const current = toValue(device);

		if (!current) {
			return [];
		}

		const sections: IDeviceCategorySection[] = [];

		for (const module of modulesManager.getModules<IModule<IDevicesModuleElementComponents>>()) {
			for (const element of module.elements ?? []) {
				const section = element.components?.deviceCategorySection;

				if (element.modules?.includes(DEVICES_MODULE_NAME) && section && section.categories.includes(current.category)) {
					sections.push(section);
				}
			}
		}

		return sections
			.map((section, index) => ({ section, index }))
			.sort((a, b) => (a.section.order ?? 0) - (b.section.order ?? 0) || a.index - b.index)
			.map(({ section }) => section);
	});
};
