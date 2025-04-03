import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesChannelCategory } from '../../../openapi';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { deviceChannelsSpecificationMappers } from '../devices.mapping';
import { type IChannel, type IDevice, channelsStoreKey } from '../store';

import type { IChannelEditForm, IUseChannelEditForm } from './types';
import { useDevices } from './useDevices';

export const useChannelEditForm = (channel: IChannel, messages?: { success?: string; error?: string }): IUseChannelEditForm => {
	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const { devices, fetchDevices, areLoading: loadingDevices } = useDevices();

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const device = computed<IDevice | null>((): IDevice | null => {
		return devices.value.find((device) => device.id === channel.device) ?? null;
	});

	const existingChannels = computed<DevicesChannelCategory[]>((): DevicesChannelCategory[] => {
		return device.value
			? channelsStore
					.findForDevice(device.value.id)
					.filter((row) => row.id !== channel.id)
					.map((row) => row.category)
			: [];
	});

	const mappedCategories = computed<{
		required: DevicesChannelCategory[];
		optional: DevicesChannelCategory[];
		multiple?: DevicesChannelCategory[];
	} | null>((): { required: DevicesChannelCategory[]; optional: DevicesChannelCategory[]; multiple?: DevicesChannelCategory[] } | null => {
		if (!device.value) {
			return null;
		}

		if (!(device.value.category in deviceChannelsSpecificationMappers)) {
			return null;
		}

		return deviceChannelsSpecificationMappers[device.value.category];
	});

	const categoriesOptions = computed<{ value: DevicesChannelCategory; label: string }[]>((): { value: DevicesChannelCategory; label: string }[] => {
		if (mappedCategories.value === null) {
			return [];
		}

		return Object.values(DevicesChannelCategory)
			.filter((value) => mappedCategories.value?.required.includes(value) || mappedCategories.value?.optional.includes(value))
			.filter((value) => !existingChannels.value.includes(value) || mappedCategories.value?.multiple?.includes(value))
			.map((value) => ({
				value,
				label: t(`devicesModule.categories.channels.${value}`),
			}));
	});

	const devicesOptions = computed<{ value: IDevice['id']; label: string }[]>((): { value: IDevice['id']; label: string }[] => {
		return devices.value.map((device) => ({ value: device.id, label: device.name }));
	});

	const model = reactive<IChannelEditForm>({
		device: channel.device,
		id: channel.id,
		category: channel.category,
		name: channel.name,
		description: channel.description ?? '',
	});

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

		try {
			await channelsStore.edit({
				id: channel.id,
				data: {
					name: model.name,
					description: model.description?.trim() === '' ? null : model.description,
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

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	fetchDevices().catch(() => {
		// Could be ignored
	});

	watch(model, (val: IChannelEditForm): void => {
		if (val.name !== channel.name) {
			formChanged.value = true;
		} else if (val.description !== channel.description) {
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
