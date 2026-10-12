import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { tryOnMounted } from '@vueuse/core';

import { injectStoresManager } from '../../../common';
import { type IDevice, channelsPropertiesStoreKey, channelsStoreKey } from '../../../modules/devices';
import { useDeviceEditFormSubmit } from '../../../modules/devices/composables/useDeviceEditFormSubmit';
import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory, DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DevicesShellyNgValidationException } from '../devices-shelly-ng.exceptions';
import { ShellyNgDeviceEditFormSchema } from '../schemas/devices.schemas';
import type { IShellyNgDeviceEditForm, IShellyNgSupportedDevice } from '../schemas/devices.types';

import type { IUseDeviceEditForm } from './types';
import { useSupportedDevices } from './useSupportedDevices';

interface IUseDeviceEditFormProps {
	device: IDevice;
	messages?: { success?: string; error?: string };
}

type DeviceWithAddresses = IDevice & {
	addresses?: { interfaceType: string; address: string }[];
	hasEthernet?: boolean;
};

const extractAddresses = (d: DeviceWithAddresses): { wifi: string | null; ethernet: string | null } => ({
	wifi: d.addresses?.find((a) => a.interfaceType === 'wifi')?.address ?? null,
	ethernet: d.addresses?.find((a) => a.interfaceType === 'ethernet')?.address ?? null,
});

export const useDeviceEditForm = ({ device, messages }: IUseDeviceEditFormProps): IUseDeviceEditForm => {
	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);
	const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { t } = useI18n();

	const { supportedDevices, fetchDevices: fetchSupportedDevices } = useSupportedDevices();

	const deviceModel = computed<string | undefined>((): string | undefined => {
		const channel = channelsStore.findForDevice(device.id).find((c) => c.category === DevicesModuleChannelCategory.device_information);

		if (channel !== undefined) {
			const property = channelsPropertiesStore.findForChannel(channel.id).find((p) => p.category === DevicesModuleChannelPropertyCategory.model);

			// Property values are normalized by the store into
			// `{ value, lastUpdated, trend }`, so the scalar is nested.
			const value = property?.value?.value;

			return typeof value === 'string' ? value : undefined;
		}

		return undefined;
	});

	const deviceGroup = computed<IShellyNgSupportedDevice | null>((): IShellyNgSupportedDevice | null => {
		const model = deviceModel.value;

		if (typeof model !== 'string') {
			return null;
		}

		return supportedDevices.value.find((group) => group.models.includes(model.toUpperCase())) || null;
	});

	const categoriesOptions = computed<{ value: DevicesModuleDeviceCategory; label: string }[]>(
		(): { value: DevicesModuleDeviceCategory; label: string }[] => {
			return orderBy(deviceGroup.value?.categories || [], [(category: string) => t(`devicesModule.categories.devices.${category}`)], ['asc']).map(
				(value) => ({
					value,
					label: t(`devicesModule.categories.devices.${value}`),
				})
			);
		}
	);

	// Extract addresses from device data
	const addresses = extractAddresses(device as DeviceWithAddresses);

	const hasEthernet = computed<boolean>((): boolean => {
		return (device as DeviceWithAddresses).hasEthernet ?? false;
	});

	const model = reactive<IShellyNgDeviceEditForm>({
		...(device as unknown as IShellyNgDeviceEditForm),
		wifiAddress: addresses.wifi,
		ethernetAddress: addresses.ethernet,
	});

	const { formEl, formChanged, submit, clear, formResult } = useDeviceEditFormSubmit({
		device,
		model,
		messages,
		messagePrefix: 'devicesShellyNgPlugin',
		parseModel: () => ShellyNgDeviceEditFormSchema.safeParse(model),
		validationException: DevicesShellyNgValidationException,
		prepareData: (parsedModel, initialModel) => {
			const { wifiAddress, ethernetAddress, roomId, ...deviceData } = parsedModel;
			const fieldUpdates: Record<string, string | null> = {};

			if (wifiAddress !== initialModel.wifiAddress) {
				fieldUpdates.wifiAddress = wifiAddress ?? null;
			}

			if (ethernetAddress !== initialModel.ethernetAddress) {
				fieldUpdates.ethernetAddress = ethernetAddress ?? null;
			}

			if (roomId !== initialModel.roomId) {
				fieldUpdates.roomId = roomId ?? null;
			}

			return { ...deviceData, ...fieldUpdates };
		},
	});

	tryOnMounted((): void => {
		fetchSupportedDevices().catch(() => {
			// Could be ignored
		});
	});

	return {
		categoriesOptions,
		hasEthernet,
		supportedDevices,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
