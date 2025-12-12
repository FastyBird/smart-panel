import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { tryOnMounted } from '@vueuse/core';

import { deepClone, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import {
	DevicesApiException,
	DevicesValidationException,
	FormResult,
	type FormResultType,
	type IDevice,
	channelsPropertiesStoreKey,
	channelsStoreKey,
	devicesStoreKey,
} from '../../../modules/devices';
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

	const devicesStore = storesManager.getStore(devicesStoreKey);
	const channelsStore = storesManager.getStore(channelsStoreKey);
	const channelsPropertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const { supportedDevices, fetchDevices: fetchSupportedDevices } = useSupportedDevices();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const deviceModel = computed<string | undefined>((): string | undefined => {
		const channel = channelsStore.findForDevice(device.id).find((c) => c.category === DevicesModuleChannelCategory.device_information);

		if (channel !== undefined) {
			const property = channelsPropertiesStore.findForChannel(channel.id).find((p) => p.category === DevicesModuleChannelPropertyCategory.model);

			return typeof property?.value === 'string' ? property?.value : undefined;
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

	let initialModel: Reactive<IShellyV1DeviceEditForm> = deepClone<Reactive<IShellyV1DeviceEditForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = device.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: device.draft
					? t('devicesShellyV1Plugin.messages.devices.notCreated', { device: device.name })
					: t('devicesShellyV1Plugin.messages.devices.notEdited', { device: device.name });

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesValidationException('Form not valid');

		const parsedModel = ShellyV1DeviceEditFormSchema.safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			throw new DevicesShellyV1ValidationException('Failed to validate edit device model.');
		}

		try {
			await devicesStore.edit({
				id: device.id,
				data: {
					...parsedModel.data,
					type: device.type,
				},
			});

			if (device.draft) {
				await devicesStore.save({
					id: device.id,
				});
			}
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof DevicesApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(errorMessage);
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		if (isDraft) {
			flashMessage.success(
				t(messages && messages.success ? messages.success : 'devicesShellyV1Plugin.messages.devices.created', {
					device: device.name,
				})
			);

			return 'added';
		}

		flashMessage.success(
			t(messages && messages.success ? messages.success : 'devicesShellyV1Plugin.messages.devices.edited', {
				device: device.name,
			})
		);

		formChanged.value = false;

		initialModel = deepClone<Reactive<IShellyV1DeviceEditForm>>(toRaw(model));

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	tryOnMounted((): void => {
		fetchSupportedDevices().catch(() => {
			// Could be ignored
		});
	});

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
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
