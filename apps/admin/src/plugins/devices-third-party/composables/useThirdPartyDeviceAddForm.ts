import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesApiException, DevicesValidationException, FormResult, type FormResultType, devicesStoreKey } from '../../../modules/devices';
import { DevicesModuleDeviceCategory } from '../../../openapi';
import type { IThirdPartyDevice } from '../store/devices.store.types';

import type { IThirdPartyDeviceAddForm, IUseThirdPartyDeviceAddForm } from './types';

interface IUseThirdPartyDeviceAddFormProps {
	id: IThirdPartyDevice['id'];
}

export const useThirdPartyDeviceAddForm = ({ id }: IUseThirdPartyDeviceAddFormProps): IUseThirdPartyDeviceAddForm => {
	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const categoriesOptions: { value: DevicesModuleDeviceCategory; label: string }[] = Object.values(DevicesModuleDeviceCategory).map((value) => ({
		value,
		label: t(`devicesModule.categories.devices.${value}`),
	}));

	const model = reactive<IThirdPartyDeviceAddForm>({
		id,
		type: 'third-party',
		category: DevicesModuleDeviceCategory.generic,
		name: '',
		description: '',
		serviceAddress: '',
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesValidationException('Form not valid');

		formResult.value = FormResult.WORKING;

		const errorMessage = t('thirdPartyDevicesPlugin.messages.devices.notCreated', { device: model.name });

		try {
			await devicesStore.add({
				id,
				draft: false,
				data: {
					type: model.type,
					category: model.category,
					name: model.name,
					description: model.description?.trim() === '' ? null : model.description,
					serviceAddress: model.serviceAddress,
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
			t('thirdPartyDevicesPlugin.messages.devices.created', {
				device: model.name,
			})
		);

		return 'added';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (val: IThirdPartyDeviceAddForm): void => {
		if (val.type !== '') {
			formChanged.value = true;
		} else if (val.category !== DevicesModuleDeviceCategory.generic) {
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
