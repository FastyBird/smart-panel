import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { type IPluginElement, deepClone, injectStoresManager, useFlashMessage } from '../../../common';
import { getSchemaDefaults } from '../../../common/utils/schemas.utils';
import {
	DevicesModuleChannelCategory,
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyData_type,
	DevicesModuleChannelPropertyPermissions,
} from '../../../openapi';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { type ChannelPropertySpec, channelChannelsPropertiesSpecificationMappers, getChannelPropertySpecification } from '../devices.mapping';
import { ChannelPropertyAddFormSchema } from '../schemas/channels.properties.schemas';
import type { IChannelPropertyAddForm } from '../schemas/channels.properties.types';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import type { IChannel } from '../store/channels.store.types';
import { channelsPropertiesStoreKey } from '../store/keys';

import type { IUseChannelPropertyAddForm } from './types';
import { useChannels } from './useChannels';
import { useChannelsPropertiesPlugin } from './useChannelsPropertiesPlugin';

interface IUseChannelPropertyAddFormProps {
	id: IChannelProperty['id'];
	type: IPluginElement['type'];
	channelId?: IChannel['id'];
}

export const useChannelPropertyAddForm = <TForm extends IChannelPropertyAddForm = IChannelPropertyAddForm>({
	id,
	type,
	channelId,
}: IUseChannelPropertyAddFormProps): IUseChannelPropertyAddForm<TForm> => {
	const storesManager = injectStoresManager();

	const { element } = useChannelsPropertiesPlugin({ type });

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const { channels, fetchChannels, areLoading: loadingChannels } = useChannels();

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const channel = computed<IChannel | null>((): IChannel | null => {
		return model.channel ? (channels.value.find((channel) => channel.id === model.channel) ?? null) : null;
	});

	const existingProperties = computed<DevicesModuleChannelPropertyCategory[]>((): DevicesModuleChannelPropertyCategory[] => {
		return channel.value ? propertiesStore.findForChannel(channel.value.id).map((row) => row.category) : [];
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

	const model = reactive<TForm>({
		...getSchemaDefaults(element.value?.schemas?.channelPropertyAddFormSchema || ChannelPropertyAddFormSchema),
		id,
		type,
		channel: channelId,
		category: DevicesModuleChannelPropertyCategory.generic,
		name: '',
		permissions: [] as DevicesModuleChannelPropertyPermissions[],
		dataType: DevicesModuleChannelPropertyData_type.unknown,
		unit: null,
		format: null,
		invalid: null,
		step: null,
		enumValues: [] as string[],
		minValue: undefined,
		maxValue: undefined,
		enterValue: false,
		value: undefined,
	} as TForm);

	const initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

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

		if (model.name === '') {
			model.name = null;
		}

		if (!model.category) {
			throw new DevicesValidationException('Missing data type definition');
		}

		if (model.dataType === DevicesModuleChannelPropertyData_type.enum) {
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
			].includes(model.dataType)
		) {
			model.format = [
				typeof model.minValue === 'string' && model.minValue !== ''
					? Number(model.minValue)
					: typeof model.minValue === 'number'
						? model.minValue
						: null,
				typeof model.maxValue === 'string' && model.maxValue !== ''
					? Number(model.maxValue)
					: typeof model.maxValue === 'number'
						? model.maxValue
						: null,
			];
		}

		if (!model.enterValue) {
			delete model.value;
		}

		const parsedModel = (element.value?.schemas?.channelPropertyAddFormSchema || ChannelPropertyAddFormSchema).safeParse(model);

		if (!parsedModel.success) {
			console.error('Schema validation failed with:', parsedModel.error);

			throw new DevicesValidationException('Failed to validate create channel property model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('devicesModule.messages.channelsProperties.notCreated', { device: model.name });

		try {
			await propertiesStore.add({
				id,
				channelId: assignToChannel,
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
			t('devicesModule.messages.channelsProperties.created', {
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

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
	});

	watch(
		(): DevicesModuleChannelPropertyCategory => model.category,
		(val: DevicesModuleChannelPropertyCategory): void => {
			const spec: ChannelPropertySpec | undefined = getChannelPropertySpecification(
				channel.value?.category ?? DevicesModuleChannelCategory.generic,
				val
			);

			if (!spec) {
				return;
			}

			initialModel.permissions = spec.permissions;
			initialModel.dataType = spec.data_type;
			initialModel.unit = spec.unit;
			model.permissions = spec.permissions;
			model.dataType = spec.data_type;
			model.unit = spec.unit;

			if (typeof spec.invalid !== 'undefined') {
				initialModel.invalid = spec.invalid;
				model.invalid = spec.invalid;
			}

			if (typeof spec.step !== 'undefined') {
				initialModel.step = spec.step;
				model.step = spec.step;
			}

			if (initialModel.dataType === DevicesModuleChannelPropertyData_type.enum) {
				initialModel.enumValues = (spec.format ?? []) as string[];
				initialModel.minValue = undefined;
				initialModel.maxValue = undefined;
				model.enumValues = (spec.format ?? []) as string[];
				model.minValue = undefined;
				model.maxValue = undefined;
			} else if (
				[
					DevicesModuleChannelPropertyData_type.char,
					DevicesModuleChannelPropertyData_type.uchar,
					DevicesModuleChannelPropertyData_type.short,
					DevicesModuleChannelPropertyData_type.ushort,
					DevicesModuleChannelPropertyData_type.int,
					DevicesModuleChannelPropertyData_type.uint,
					DevicesModuleChannelPropertyData_type.float,
				].includes(model.dataType)
			) {
				initialModel.enumValues = [];
				initialModel.minValue = spec.format?.[0] as number | undefined;
				initialModel.maxValue = spec.format?.[1] as number | undefined;
				model.enumValues = [];
				model.minValue = spec.format?.[0] as number | undefined;
				model.maxValue = spec.format?.[1] as number | undefined;
			} else {
				initialModel.enumValues = [];
				initialModel.minValue = undefined;
				initialModel.maxValue = undefined;
				model.enumValues = [];
				model.minValue = undefined;
				model.maxValue = undefined;
			}

			formChanged.value = !isEqual(toRaw(model), initialModel);
		},
		{
			immediate: true,
		}
	);

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
