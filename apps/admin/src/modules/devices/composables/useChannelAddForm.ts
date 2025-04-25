import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesModuleChannelCategory } from '../../../openapi';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { deviceChannelsSpecificationMappers } from '../devices.mapping';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';
import { channelsStoreKey } from '../store/keys';

import type { IChannelAddForm, IUseChannelAddForm } from './types';
import { useDevices } from './useDevices';

interface IUseChannelAddFormProps {
	id: IChannel['id'];
	deviceId?: IDevice['id'];
}

export const useChannelAddForm = ({ id, deviceId }: IUseChannelAddFormProps): IUseChannelAddForm => {
	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const { devices, fetchDevices, areLoading: loadingDevices } = useDevices();

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const device = computed<IDevice | null>((): IDevice | null => {
		return model.device ? (devices.value.find((device) => device.id === model.device) ?? null) : null;
	});

	const existingChannels = computed<DevicesModuleChannelCategory[]>((): DevicesModuleChannelCategory[] => {
		return device.value ? channelsStore.findForDevice(device.value.id).map((row) => row.category) : [];
	});

	const mappedCategories = computed<{
		required: DevicesModuleChannelCategory[];
		optional: DevicesModuleChannelCategory[];
		multiple?: DevicesModuleChannelCategory[];
	} | null>(
		(): { required: DevicesModuleChannelCategory[]; optional: DevicesModuleChannelCategory[]; multiple?: DevicesModuleChannelCategory[] } | null => {
			if (!device.value) {
				return null;
			}

			if (!(device.value.category in deviceChannelsSpecificationMappers)) {
				return null;
			}

			return deviceChannelsSpecificationMappers[device.value.category];
		}
	);

	const categoriesOptions = computed<{ value: DevicesModuleChannelCategory; label: string }[]>(
		(): { value: DevicesModuleChannelCategory; label: string }[] => {
			if (mappedCategories.value === null) {
				return [];
			}

			return Object.values(DevicesModuleChannelCategory)
				.filter((value) => mappedCategories.value?.required.includes(value) || mappedCategories.value?.optional.includes(value))
				.filter((value) => !existingChannels.value.includes(value) || mappedCategories.value?.multiple?.includes(value))
				.map((value) => ({
					value,
					label: t(`devicesModule.categories.channels.${value}`),
				}));
		}
	);

	const devicesOptions = computed<{ value: IDevice['id']; label: string }[]>((): { value: IDevice['id']; label: string }[] => {
		return devices.value.map((device) => ({ value: device.id, label: device.name }));
	});

	const model = reactive<IChannelAddForm>({
		id: id,
		device: deviceId,
		category: undefined,
		name: '',
		description: '',
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesValidationException('Form not valid');

		const assignToDevice = deviceId ?? model.device;

		if (!assignToDevice) {
			throw new DevicesValidationException('Missing device identifier');
		}

		if (!model.category) {
			throw new DevicesValidationException('Missing data type definition');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('devicesModule.messages.channels.notCreated', { device: model.name });

		try {
			await channelsStore.add({
				id,
				deviceId: assignToDevice,
				draft: false,
				data: {
					category: model.category,
					name: model.name,
					description: model.description?.trim() === '' ? null : model.description,
				},
			});
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

		flashMessage.success(
			t('devicesModule.messages.channels.created', {
				device: model.name,
			})
		);

		return 'added';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	fetchDevices().catch(() => {
		// Could be ignored
	});

	watch(model, (val: IChannelAddForm): void => {
		if (val.category !== DevicesModuleChannelCategory.generic) {
			formChanged.value = true;
		} else if (val.device !== deviceId) {
			formChanged.value = true;
		} else if (val.name !== '') {
			formChanged.value = true;
		} else if (val.description !== '') {
			formChanged.value = true;
		} else {
			formChanged.value = false;
		}
	});

	return {
		categoriesOptions,
		devicesOptions,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
		loadingDevices,
	};
};
