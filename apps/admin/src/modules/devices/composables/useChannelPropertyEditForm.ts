import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesChannelPropertyCategory, DevicesChannelPropertyData_type, DevicesChannelPropertyPermissions } from '../../../openapi';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { channelChannelsPropertiesSpecificationMappers } from '../devices.mapping';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import { channelsPropertiesStoreKey } from '../store/keys';

import type { IChannelPropertyEditForm, IUseChannelPropertyEditForm } from './types';
import { useChannels } from './useChannels';

interface IUseChannelPropertyEditFormProps {
	property: IChannelProperty;
	messages?: { success?: string; error?: string };
}

export const useChannelPropertyEditForm = ({ property, messages }: IUseChannelPropertyEditFormProps): IUseChannelPropertyEditForm => {
	const storesManager = injectStoresManager();

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { channels, fetchChannels, areLoading: loadingChannels } = useChannels();

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	let enumValues: string[] = [];
	let minValue: string = '';
	let maxValue: string = '';

	if (property.dataType === DevicesChannelPropertyData_type.enum) {
		enumValues = property.format ? property.format.map((item) => item.toString()) : [];
	} else if (
		[
			DevicesChannelPropertyData_type.char,
			DevicesChannelPropertyData_type.uchar,
			DevicesChannelPropertyData_type.short,
			DevicesChannelPropertyData_type.ushort,
			DevicesChannelPropertyData_type.int,
			DevicesChannelPropertyData_type.uint,
			DevicesChannelPropertyData_type.float,
		].includes(property.dataType)
	) {
		if (Array.isArray(property.format) && property.format.length === 2) {
			minValue = property.format[0] as string;
			maxValue = property.format[1] as string;
		}
	}

	const channel = computed<IChannel | null>((): IChannel | null => {
		return channels.value.find((channel) => channel.id === property.channel) ?? null;
	});

	const existingProperties = computed<DevicesChannelPropertyCategory[]>((): DevicesChannelPropertyCategory[] => {
		return channel.value
			? propertiesStore
					.findForChannel(channel.value.id)
					.filter((row) => row.id !== property.id)
					.map((row) => row.category)
			: [];
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

	const model = reactive<IChannelPropertyEditForm>({
		channel: property.channel,
		id: property.id,
		category: property.category,
		permissions: property.permissions,
		dataType: property.dataType,
		name: property.name ?? '',
		unit: property.unit ?? '',
		format: [],
		invalid: property.invalid ? property.invalid.toString() : '',
		step: property.step ? property.step.toString() : '',
		enumValues,
		minValue,
		maxValue,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = property.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: property.draft
					? t('devicesModule.messages.channelsProperties.notCreated', { property: property.name ?? property.category })
					: t('devicesModule.messages.channelsProperties.notEdited', { property: property.name ?? property.category });

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesValidationException('Form not valid');

		let format: string[] | number[] | null = null;

		if (property.dataType === DevicesChannelPropertyData_type.enum) {
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
			].includes(property.dataType)
		) {
			format = [model.minValue, model.maxValue];
		}

		try {
			await propertiesStore.edit({
				id: property.id,
				channelId: property.channel,
				data: {
					name: model.name?.trim() === '' ? null : model.name,
					unit: model.unit?.trim() === '' ? null : model.unit,
					format: format,
					invalid: model.invalid?.toString().trim() === '' ? null : model.invalid,
					step: model.step?.trim() === '' ? null : Number(model.step),
				},
			});

			if (property.draft) {
				await propertiesStore.save({
					id: property.id,
					channelId: property.channel,
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
				t(messages && messages.success ? messages.success : 'devicesModule.messages.channelsProperties.created', {
					property: property.name ?? property.category,
				})
			);

			return 'added';
		}

		flashMessage.success(
			t(messages && messages.success ? messages.success : 'devicesModule.messages.channelsProperties.edited', {
				property: property.name ?? property.category,
			})
		);

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	fetchChannels().catch(() => {
		// Could be ignored
	});

	watch(model, (val: IChannelPropertyEditForm): void => {
		if (val.name !== (property.name ?? '')) {
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
