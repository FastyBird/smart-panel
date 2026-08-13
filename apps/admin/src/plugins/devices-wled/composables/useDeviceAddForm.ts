import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';
import { orderBy } from 'natural-orderby';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { deepClone, getErrorReason, getSchemaDefaults, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../common';
import { FormResult, type FormResultType, type IDevice, devicesStoreKey } from '../../../modules/devices';
import {
	DevicesModuleDeviceCategory,
	DevicesWledPluginAdoptDeviceCategory,
	type DevicesWledPluginAdoptDiscoveryOperation,
} from '../../../openapi.constants';
import { DEVICES_WLED_PLUGIN_PREFIX, DEVICES_WLED_TYPE } from '../devices-wled.constants';
import { DevicesWledApiException, DevicesWledValidationException } from '../devices-wled.exceptions';
import { WledDeviceAddFormSchema } from '../schemas/devices.schemas';
import type { IWledDeviceAddForm } from '../schemas/devices.types';

import type { IUseDeviceAddForm } from './types';

interface IUseDeviceAddFormProps {
	id: IDevice['id'];
}

// WLED LED controllers typically fall into these categories
const WLED_CATEGORIES = [DevicesModuleDeviceCategory.lighting];

export const useDeviceAddForm = ({ id }: IUseDeviceAddFormProps): IUseDeviceAddForm => {
	const storesManager = injectStoresManager();
	const backend = useBackend();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const categoriesOptions = computed<{ value: DevicesModuleDeviceCategory; label: string }[]>(
		(): { value: DevicesModuleDeviceCategory; label: string }[] => {
			return orderBy(WLED_CATEGORIES, [(category: string) => t(`devicesModule.categories.devices.${category}`)], ['asc']).map((value) => ({
				value,
				label: t(`devicesModule.categories.devices.${value}`),
			}));
		}
	);

	const model = reactive<IWledDeviceAddForm>({
		...getSchemaDefaults(WledDeviceAddFormSchema),
		id,
		type: DEVICES_WLED_TYPE,
		category: DevicesModuleDeviceCategory.lighting,
		name: '',
		description: '',
		hostname: '',
		enabled: true,
	});

	const initialModel: Reactive<IWledDeviceAddForm> = deepClone<Reactive<IWledDeviceAddForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesWledValidationException('Form not valid');

		const parsedModel = WledDeviceAddFormSchema.safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			throw new DevicesWledValidationException('Failed to validate create device model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('devicesWledPlugin.messages.devices.notCreated', { device: model.name });

		try {
			const { data, error, response } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_WLED_PLUGIN_PREFIX}/discovery/adopt`, {
				body: {
					data: {
						devices: [
							{
								host: parsedModel.data.hostname,
								name: parsedModel.data.name,
								category: DevicesWledPluginAdoptDeviceCategory.lighting,
								description: parsedModel.data.description || null,
								enabled: parsedModel.data.enabled,
							},
						],
					},
				},
			});

			if (typeof data === 'undefined') {
				const reason = error ? getErrorReason<DevicesWledPluginAdoptDiscoveryOperation>(error, errorMessage) : errorMessage;
				throw new DevicesWledApiException(reason, response.status);
			}

			const result = data.data[0];
			if (!result || result.status === 'failed') {
				throw new DevicesWledApiException(result?.error ?? errorMessage, 422);
			}

			try {
				await devicesStore.fetch();
			} catch (error: unknown) {
				logger.warn('WLED device was created, but the device store could not be refreshed', {
					message: error instanceof Error ? error.message : String(error),
				});
			}
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof DevicesWledApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(errorMessage);
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(
			t('devicesWledPlugin.messages.devices.created', {
				device: model.name,
			})
		);

		return 'added';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
	});

	return {
		categoriesOptions,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
