import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import type { IHomeAssistantDiscoveredDevice } from '../store/home-assistant-discovered-devices.store.types';

import type { IUseDiscoveredDevicesOptions } from './types';
import { useDiscoveredDevices } from './useDiscoveredDevices';

export const useDiscoveredDevicesOptions = (): IUseDiscoveredDevicesOptions => {
	const { devices, fetchDiscoveredDevices, areLoading } = useDiscoveredDevices();

	const devicesOptions = computed<{ value: IHomeAssistantDiscoveredDevice['id']; label: IHomeAssistantDiscoveredDevice['name'] }[]>(
		(): { value: IHomeAssistantDiscoveredDevice['id']; label: IHomeAssistantDiscoveredDevice['name'] }[] => {
			return orderBy<IHomeAssistantDiscoveredDevice>(
				devices.value,
				[(device: IHomeAssistantDiscoveredDevice) => (device.name.trim() !== '' ? device.name : device.id)],
				['asc']
			).map((device) => ({
				value: device.id,
				label: device.name.trim() !== '' ? device.name : device.id,
			}));
		}
	);

	fetchDiscoveredDevices().catch(() => {
		// Could be ignored
	});

	return {
		devicesOptions,
		areLoading,
	};
};
