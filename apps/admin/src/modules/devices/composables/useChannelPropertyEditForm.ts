import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { cloneDeep, isEqual } from 'lodash';

import { injectStoresManager, useFlashMessage } from '../../../common';
import {
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyData_type,
	DevicesModuleChannelPropertyPermissions,
} from '../../../openapi';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { channelChannelsPropertiesSpecificationMappers } from '../devices.mapping';
import { ChannelPropertyEditFormSchema } from '../schemas/channels.properties.schemas';
import type { IChannelPropertyEditForm } from '../schemas/channels.properties.types';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import { channelsPropertiesStoreKey } from '../store/keys';

import type { IUseChannelPropertyEditForm } from './types';
import { useChannels } from './useChannels';
import { useChannelsPropertiesPlugin } from './useChannelsPropertiesPlugin';

interface IUseChannelPropertyEditFormProps {
	property: IChannelProperty;
	messages?: { success?: string; error?: string };
}

export const useChannelPropertyEditForm = <TForm extends IChannelPropertyEditForm = IChannelPropertyEditForm>({
	property,
	messages,
}: IUseChannelPropertyEditFormProps): IUseChannelPropertyEditForm<TForm> => {
	const storesManager = injectStoresManager();

	const { plugin } = useChannelsPropertiesPlugin({ type: property.type });

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { channels, fetchChannels, areLoading: loadingChannels } = useChannels();

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	let enumValues: string[] = [];
	let minValue: number | undefined = undefined;
	let maxValue: number | undefined = undefined;

	if (property.dataType === DevicesModuleChannelPropertyData_type.enum) {
		enumValues = property.format ? property.format.map((item) => item?.toString() || '') : [];
	} else if (
		[
			DevicesModuleChannelPropertyData_type.char,
			DevicesModuleChannelPropertyData_type.uchar,
			DevicesModuleChannelPropertyData_type.short,
			DevicesModuleChannelPropertyData_type.ushort,
			DevicesModuleChannelPropertyData_type.int,
			DevicesModuleChannelPropertyData_type.uint,
			DevicesModuleChannelPropertyData_type.float,
		].includes(property.dataType)
	) {
		if (Array.isArray(property.format) && property.format.length === 2) {
			minValue = property.format[0] as number;
			maxValue = property.format[1] as number;
		}
	}

	const channel = computed<IChannel | null>((): IChannel | null => {
		return channels.value.find((channel) => channel.id === property.channel) ?? null;
	});

	const existingProperties = computed<DevicesModuleChannelPropertyCategory[]>((): DevicesModuleChannelPropertyCategory[] => {
		return channel.value
			? propertiesStore
					.findForChannel(channel.value.id)
					.filter((row) => row.id !== property.id)
					.map((row) => row.category)
			: [];
	});

	const mappedCategories = computed<{ required: DevicesModuleChannelPropertyCategory[]; optional: DevicesModuleChannelPropertyCategory[] } | null>(
		(): { required: DevicesModuleChannelPropertyCategory[]; optional: DevicesModuleChannelPropertyCategory[] } | null => {
			if (!channel.value) {
				return null;
			}

			if (!(channel.value.category in channelChannelsPropertiesSpecificationMappers)) {
				return null;
			}

			return channelChannelsPropertiesSpecificationMappers[channel.value.category];
		}
	);

	const categoriesOptions = computed<{ value: DevicesModuleChannelPropertyCategory; label: string }[]>(
		(): { value: DevicesModuleChannelPropertyCategory; label: string }[] => {
			if (mappedCategories.value === null) {
				return [];
			}

			return Object.values(DevicesModuleChannelPropertyCategory)
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

	const permissionsOptions: { value: DevicesModuleChannelPropertyPermissions; label: string }[] = Object.values(
		DevicesModuleChannelPropertyPermissions
	).map((value) => ({
		value,
		label: t(`devicesModule.permissions.${value}`),
	}));

	const dataTypesOptions: { value: DevicesModuleChannelPropertyData_type; label: string }[] = Object.values(
		DevicesModuleChannelPropertyData_type
	).map((value) => ({
		value,
		label: t(`devicesModule.dataTypes.${value}`),
	}));

	const model = reactive<TForm>({ ...property, format: toRaw(property.format), enumValues, minValue, maxValue } as unknown as TForm);

	let initialModel: Reactive<TForm> = cloneDeep<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = property.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: property.draft
					? t('devicesModule.messages.channelsProperties.notCreated', {
							property: property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`),
						})
					: t('devicesModule.messages.channelsProperties.notEdited', {
							property: property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`),
						});

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesValidationException('Form not valid');

		if (model.name === '') {
			model.name = null;
		}

		if (property.dataType === DevicesModuleChannelPropertyData_type.enum) {
			model.format = model.enumValues;
		} else if (
			[
				DevicesModuleChannelPropertyData_type.char,
				DevicesModuleChannelPropertyData_type.uchar,
				DevicesModuleChannelPropertyData_type.short,
				DevicesModuleChannelPropertyData_type.ushort,
				DevicesModuleChannelPropertyData_type.int,
				DevicesModuleChannelPropertyData_type.uint,
				DevicesModuleChannelPropertyData_type.float,
			].includes(property.dataType)
		) {
			model.format = [model.minValue ?? null, model.maxValue ?? null];
		}

		const parsedModel = (plugin.value?.schemas?.channelPropertyEditFormSchema || ChannelPropertyEditFormSchema).safeParse(model);

		if (!parsedModel.success) {
			console.error('Schema validation failed with:', parsedModel.error);

			throw new DevicesValidationException('Failed to validate edit channel property model.');
		}

		try {
			await propertiesStore.edit({
				id: property.id,
				channelId: property.channel,
				data: {
					...parsedModel.data,
					type: property.type,
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
					property: property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`),
				})
			);

			return 'added';
		}

		flashMessage.success(
			t(messages && messages.success ? messages.success : 'devicesModule.messages.channelsProperties.edited', {
				property: property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`),
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

	fetchChannels().catch(() => {
		// Could be ignored
	});

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
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
