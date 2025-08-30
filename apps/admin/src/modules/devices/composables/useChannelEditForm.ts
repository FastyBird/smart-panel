import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { cloneDeep, isEqual } from 'lodash';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesModuleChannelCategory } from '../../../openapi';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { deviceChannelsSpecificationMappers } from '../devices.mapping';
import { ChannelEditFormSchema } from '../schemas/channels.schemas';
import type { IChannelEditForm } from '../schemas/channels.types';
import type { IChannel } from '../store/channels.store.types';
import type { IDevice } from '../store/devices.store.types';
import { channelsStoreKey } from '../store/keys';

import type { IUseChannelEditForm } from './types';
import { useChannelsPlugin } from './useChannelsPlugin';
import { useDevices } from './useDevices';

interface IUseChannelEditFormProps {
	channel: IChannel;
	messages?: { success?: string; error?: string };
}

export const useChannelEditForm = <TForm extends IChannelEditForm = IChannelEditForm>({
	channel,
	messages,
}: IUseChannelEditFormProps): IUseChannelEditForm<TForm> => {
	const storesManager = injectStoresManager();

	const { element } = useChannelsPlugin({ type: channel.type });

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const { devices, fetchDevices, areLoading: loadingDevices } = useDevices();

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const device = computed<IDevice | null>((): IDevice | null => {
		return devices.value.find((device) => device.id === channel.device) ?? null;
	});

	const existingChannels = computed<DevicesModuleChannelCategory[]>((): DevicesModuleChannelCategory[] => {
		return device.value
			? channelsStore
					.findForDevice(device.value.id)
					.filter((row) => row.id !== channel.id)
					.map((row) => row.category)
			: [];
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

	const model = reactive<TForm>(channel as unknown as TForm);

	let initialModel: Reactive<TForm> = cloneDeep<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = channel.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: channel.draft
					? t('devicesModule.messages.channels.notCreated', { channel: channel.name })
					: t('devicesModule.messages.channels.notEdited', { channel: channel.name });

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesValidationException('Form not valid');

		const parsedModel = (element.value?.schemas?.channelEditFormSchema || ChannelEditFormSchema).safeParse(model);

		if (!parsedModel.success) {
			console.error('Schema validation failed with:', parsedModel.error);

			throw new DevicesValidationException('Failed to validate edit channel model.');
		}

		try {
			await channelsStore.edit({
				id: channel.id,
				data: {
					...parsedModel.data,
					type: channel.type,
				},
			});

			if (channel.draft) {
				await channelsStore.save({
					id: channel.id,
					deviceId: channel.device,
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
				t(messages && messages.success ? messages.success : 'devicesModule.messages.channels.created', {
					channel: channel.name,
				})
			);

			return 'added';
		}

		flashMessage.success(
			t(messages && messages.success ? messages.success : 'devicesModule.messages.channels.edited', {
				channel: channel.name,
			})
		);

		formChanged.value = false;

		initialModel = cloneDeep<Reactive<TForm>>(toRaw(model));

		return 'saved';
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
