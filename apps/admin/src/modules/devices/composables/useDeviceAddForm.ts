import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { type IPluginElement, deepClone, getSchemaDefaults, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { DevicesModuleDeviceCategory } from '../../../openapi';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { DeviceAddFormSchema } from '../schemas/devices.schemas';
import type { IDeviceAddForm } from '../schemas/devices.types';
import type { IDevice } from '../store/devices.store.types';
import { devicesStoreKey } from '../store/keys';

import type { IUseDeviceAddForm } from './types';
import { useDevicesPlugin } from './useDevicesPlugin';

interface IUseDeviceAddFormProps {
	id: IDevice['id'];
	type: IPluginElement['type'];
}

export const useDeviceAddForm = <TForm extends IDeviceAddForm = IDeviceAddForm>({ id, type }: IUseDeviceAddFormProps): IUseDeviceAddForm<TForm> => {
	const storesManager = injectStoresManager();

	const { element } = useDevicesPlugin({ type });

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[] = Object.values(DevicesModuleDeviceCategory).map((value) => ({
		value,
		label: t(`devicesModule.categories.devices.${value}`),
	}));

	const model = reactive<TForm>({
		...getSchemaDefaults(element.value?.schemas?.deviceAddFormSchema || DeviceAddFormSchema),
		id,
		type,
		category: DevicesModuleDeviceCategory.generic,
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

		const parsedModel = (element.value?.schemas?.deviceAddFormSchema || DeviceAddFormSchema).safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			throw new DevicesValidationException('Failed to validate create device model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('devicesModule.messages.devices.notCreated', { device: model.name });

		try {
			await devicesStore.add({
				id,
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
			t('devicesModule.messages.devices.created', {
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
