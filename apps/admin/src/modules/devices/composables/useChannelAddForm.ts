import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { type IPluginElement, deepClone, getSchemaDefaults, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { DevicesModuleChannelCategory } from '../../../openapi.constants';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { deviceChannelsSpecificationMappers } from '../devices.mapping';
import { ChannelAddFormSchema } from '../schemas/channels.schemas';
import type { IChannelAddForm } from '../schemas/channels.types';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';
import { channelsStoreKey } from '../store/keys';

import type { IUseChannelAddForm } from './types';
import { useChannelsPlugin } from './useChannelsPlugin';
import { useDevices } from './useDevices';

interface IUseChannelAddFormProps {
	id: IChannel['id'];
	type: IPluginElement['type'];
	deviceId?: IDevice['id'];
}

export const useChannelAddForm = <TForm extends IChannelAddForm = IChannelAddForm>({
	id,
	type,
	deviceId,
}: IUseChannelAddFormProps): IUseChannelAddForm<TForm> => {
	const storesManager = injectStoresManager();

	const { element } = useChannelsPlugin({ type });

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const { devices, fetchDevices, areLoading: loadingDevices } = useDevices();

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

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

			return deviceChannelsSpecificationMappers[device.value.category] ?? null;
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
		return devices.value.filter((device) => device.type === type).map((device) => ({ value: device.id, label: device.name }));
	});

	const model = reactive<TForm>({
		...getSchemaDefaults(element.value?.schemas?.channelAddFormSchema || ChannelAddFormSchema),
		id,
		type,
		device: deviceId,
		category: DevicesModuleChannelCategory.generic,
		name: '',
		description: '',
	} as TForm);

	const initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

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

		const parsedModel = (element.value?.schemas?.channelAddFormSchema || ChannelAddFormSchema).safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			throw new DevicesValidationException('Failed to validate create channel model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('devicesModule.messages.channels.notCreated', { device: model.name });

		try {
			await channelsStore.add({
				id,
				deviceId: assignToDevice,
				draft: false,
				data: {
					...parsedModel.data,
					type,
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

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
	});

	watch(
		() => categoriesOptions.value,
		(categories): void => {
			if (categories.length) {
				model.category = categoriesOptions.value[0].value;

				initialModel.category = categoriesOptions.value[0].value;
			}
		},
		{ immediate: true }
	);

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
