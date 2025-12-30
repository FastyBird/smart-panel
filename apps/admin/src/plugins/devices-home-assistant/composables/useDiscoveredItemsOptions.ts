import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import type { IDiscoveryOptionGroup, IUseDiscoveredItemsOptions } from './types';
import { useDiscoveredDevices } from './useDiscoveredDevices';
import { useDiscoveredHelpers } from './useDiscoveredHelpers';

export const useDiscoveredItemsOptions = (): IUseDiscoveredItemsOptions => {
	const { devices, fetchDiscoveredDevices, areLoading: devicesLoading } = useDiscoveredDevices();
	const { helpers, fetchDiscoveredHelpers, areLoading: helpersLoading } = useDiscoveredHelpers();

	const areLoading = computed(() => devicesLoading.value || helpersLoading.value);

	const itemsOptions = computed<IDiscoveryOptionGroup[]>(() => {
		const groups: IDiscoveryOptionGroup[] = [];

		// Devices group
		const deviceOptions = orderBy(
			devices.value,
			[(d) => (d.name.trim() !== '' ? d.name : d.id)],
			['asc']
		).map((device) => ({
			value: device.id,
			label: device.name.trim() !== '' ? device.name : device.id,
			type: 'device' as const,
		}));

		if (deviceOptions.length > 0) {
			groups.push({
				label: 'Devices',
				options: deviceOptions,
			});
		}

		// Helpers group
		const helperOptions = orderBy(
			helpers.value,
			[(h) => (h.name.trim() !== '' ? h.name : h.entityId)],
			['asc']
		).map((helper) => ({
			value: helper.entityId,
			label: helper.name.trim() !== '' ? helper.name : helper.entityId,
			type: 'helper' as const,
		}));

		if (helperOptions.length > 0) {
			groups.push({
				label: 'Helpers',
				options: helperOptions,
			});
		}

		return groups;
	});

	// Fetch both devices and helpers
	Promise.all([fetchDiscoveredDevices(), fetchDiscoveredHelpers()]).catch(() => {
		// Could be ignored
	});

	return {
		itemsOptions,
		areLoading,
	};
};
