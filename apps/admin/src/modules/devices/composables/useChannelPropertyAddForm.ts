import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesChannelPropertyCategory, DevicesChannelPropertyData_type, DevicesChannelPropertyPermissions } from '../../../openapi';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { channelChannelsPropertiesSpecificationMappers } from '../devices.mapping';
import { type IChannel, type IChannelProperty, channelsPropertiesStoreKey } from '../store';

import type { IChannelPropertyAddForm, IUseChannelPropertyAddForm } from './types';
import { useChannels } from './useChannels';

export const useChannelPropertyAddForm = (id: IChannelProperty['id'], channelId?: IChannel['id']): IUseChannelPropertyAddForm => {
	const storesManager = injectStoresManager();

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { channels, fetchChannels, areLoading: loadingChannels } = useChannels();

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const channel = computed<IChannel | null>((): IChannel | null => {
		return model.channel ? (channels.value.find((channel) => channel.id === model.channel) ?? null) : null;
	});

	const existingProperties = computed<DevicesChannelPropertyCategory[]>((): DevicesChannelPropertyCategory[] => {
		return channel.value ? propertiesStore.findForChannel(channel.value.id).map((row) => row.category) : [];
	});

	const mappedCategories = computed<{ required: DevicesChannelPropertyCategory[]; optional: DevicesChannelPropertyCategory[] } | null>(
		(): { required: DevicesChannelPropertyCategory[]; optional: DevicesChannelPropertyCategory[] } | null => {
			if (!channel.value) {
				return null;
			}

			if (!(channel.value.category in channelChannelsPropertiesSpecificationMappers)) {
				return null;
			}

			return channelChannelsPropertiesSpecificationMappers[channel.value.category];
		}
	);

	const categoriesOptions = computed<{ value: DevicesChannelPropertyCategory; label: string }[]>(
		(): { value: DevicesChannelPropertyCategory; label: string }[] => {
			if (mappedCategories.value === null) {
				return [];
			}

			return Object.values(DevicesChannelPropertyCategory)
				.filter((value) => mappedCategories.value?.required.includes(value) || mappedCategories.value?.optional.includes(value))
				.filter((value) => !existingProperties.value.includes(value))
				.map((value) => ({
					value,
					label: t(`devicesModule.categories.channelsProperties.${value}`),
				}));
		}
	);

	const channelsOptions = computed<{ value: IChannel['id']; label: string }[]>((): { value: IChannel['id']; label: string }[] => {
		return channels.value.map((channel) => ({ value: channel.id, label: channel.name }));
	});

	const permissionsOptions: { value: DevicesChannelPropertyPermissions; label: string }[] = Object.values(DevicesChannelPropertyPermissions).map(
		(value) => ({
			value,
			label: t(`devicesModule.permissions.${value}`),
		})
	);

	const dataTypesOptions: { value: DevicesChannelPropertyData_type; label: string }[] = Object.values(DevicesChannelPropertyData_type).map(
		(value) => ({
			value,
			label: t(`devicesModule.dataTypes.${value}`),
		})
	);

	const model = reactive<IChannelPropertyAddForm>({
		id: id,
		channel: channelId,
		category: undefined,
		name: '',
		permissions: [],
		dataType: DevicesChannelPropertyData_type.unknown,
		unit: '',
		format: null,
		invalid: '',
		step: '',
		enumValues: [],
		minValue: '',
		maxValue: '',
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesValidationException('Form not valid');

		const assignToChannel = channelId ?? model.channel;

		if (!assignToChannel) {
			throw new DevicesValidationException('Missing channel identifier');
		}

		if (!model.category) {
			throw new DevicesValidationException('Missing data type definition');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('devicesModule.messages.channelsProperties.notCreated', { device: model.name });

		let format: string[] | (number | null)[] | null = null;

		if (model.dataType === DevicesChannelPropertyData_type.enum) {
			format = model.enumValues;
		} else if (
			[
				DevicesChannelPropertyData_type.char,
				DevicesChannelPropertyData_type.uchar,
				DevicesChannelPropertyData_type.short,
				DevicesChannelPropertyData_type.ushort,
				DevicesChannelPropertyData_type.int,
				DevicesChannelPropertyData_type.uint,
				DevicesChannelPropertyData_type.float,
			].includes(model.dataType)
		) {
			format = [model.minValue !== '' ? Number(model.minValue) : null, model.maxValue !== '' ? Number(model.maxValue) : null];
		}

		try {
			await propertiesStore.add({
				id,
				channelId: assignToChannel,
				draft: false,
				data: {
					category: model.category,
					name: model.name?.trim() === '' ? null : model.name,
					permissions: model.permissions,
					dataType: model.dataType,
					unit: model.unit?.trim() === '' ? null : model.unit,
					format,
					invalid: model.invalid?.toString().trim() === '' ? null : model.invalid,
					step: model.step?.trim() === '' ? null : Number(model.step),
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

	fetchChannels().catch(() => {
		// Could be ignored
	});

	watch(model, (val: IChannelPropertyAddForm): void => {
		if (val.category !== DevicesChannelPropertyCategory.generic) {
			formChanged.value = true;
		} else if (val.channel !== channelId) {
			formChanged.value = true;
		} else if (val.name !== '') {
			formChanged.value = true;
		} else if (val.permissions.length > 0) {
			formChanged.value = true;
		} else if (val.dataType !== DevicesChannelPropertyData_type.unknown) {
			formChanged.value = true;
		} else if (val.unit !== '') {
			formChanged.value = true;
		} else if (val.enumValues.length > 0) {
			formChanged.value = true;
		} else if (val.minValue.toString() !== '') {
			formChanged.value = true;
		} else if (val.maxValue.toString() !== '') {
			formChanged.value = true;
		} else if (val.invalid !== '') {
			formChanged.value = true;
		} else if (val.step !== null) {
			formChanged.value = true;
		} else {
			formChanged.value = false;
		}
	});

	return {
		categoriesOptions,
		channelsOptions,
		permissionsOptions,
		dataTypesOptions,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
		loadingChannels,
	};
};
