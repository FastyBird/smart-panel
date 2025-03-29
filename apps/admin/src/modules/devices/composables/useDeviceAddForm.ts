import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { type IPlugin, injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesDeviceCategory } from '../../../openapi';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { type IDevice, devicesStoreKey } from '../store';

import type { IDeviceAddForm, IUseDeviceAddForm } from './types';

export const useDeviceAddForm = (id: IDevice['id'], type: IPlugin['type']): IUseDeviceAddForm => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const categoriesOptions: { value: DevicesDeviceCategory; label: string }[] = Object.values(DevicesDeviceCategory).map((value) => ({
		value,
		label: t(`devicesModule.categories.devices.${value}`),
	}));

	const model = reactive<IDeviceAddForm>({
		id,
		type,
		category: DevicesDeviceCategory.generic,
		name: '',
		description: '',
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesValidationException('Form not valid');

		formResult.value = FormResult.WORKING;

		const errorMessage = t('devicesModule.messages.devices.notCreated', { device: model.name });

		try {
			await devicesStore.add({
				id,
				draft: false,
				data: {
					type,
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

	watch(model, (val: IDeviceAddForm): void => {
		if (val.type !== '') {
			formChanged.value = true;
		} else if (val.category !== DevicesDeviceCategory.generic) {
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
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
