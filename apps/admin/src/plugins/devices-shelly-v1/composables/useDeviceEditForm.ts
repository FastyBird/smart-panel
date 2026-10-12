import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { tryOnMounted } from '@vueuse/core';

import { injectStoresManager } from '../../../common';
import { type IDevice, channelsPropertiesStoreKey, channelsStoreKey } from '../../../modules/devices';
import { useDeviceEditFormSubmit } from '../../../modules/devices/composables/useDeviceEditFormSubmit';
import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory, DevicesModuleDeviceCategory } from '../../../openapi.constants';
import { DevicesShellyV1ValidationException } from '../devices-shelly-v1.exceptions';
import { ShellyV1DeviceEditFormSchema } from '../schemas/devices.schemas';
import type { IShellyV1DeviceEditForm, IShellyV1SupportedDevice } from '../schemas/devices.types';

import type { IUseDeviceEditForm } from './types';
import { useSupportedDevices } from './useSupportedDevices';

interface IUseDeviceEditFormProps {
	device: IDevice;
	messages?: { success?: string; error?: string };
}

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

	const deviceGroup = computed<IShellyV1SupportedDevice | null>((): IShellyV1SupportedDevice | null => {
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

	const model = reactive<IShellyV1DeviceEditForm>(device as unknown as IShellyV1DeviceEditForm);

	const { formEl, formChanged, submit, clear, formResult } = useDeviceEditFormSubmit({
		device,
		model,
		messages,
		messagePrefix: 'devicesShellyV1Plugin',
		parseModel: () => ShellyV1DeviceEditFormSchema.safeParse(model),
		validationException: DevicesShellyV1ValidationException,
	});

	tryOnMounted((): void => {
		fetchSupportedDevices().catch(() => {
			// Could be ignored
		});
	});

	return {
		categoriesOptions,
		supportedDevices,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
