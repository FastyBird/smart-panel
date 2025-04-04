import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesDeviceCategory } from '../../../openapi';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { type IDevice, devicesStoreKey } from '../store';

import type { IDeviceEditForm, IUseDeviceEditForm } from './types';

export const useDeviceEditForm = (device: IDevice, messages?: { success?: string; error?: string }): IUseDeviceEditForm => {
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

	const model = reactive<IDeviceEditForm>({
		id: device.id,
		type: device.type,
		category: device.category,
		name: device.name,
		description: device.description ?? '',
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = device.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: device.draft
					? t('devicesModule.messages.devices.notCreated', { device: device.name })
					: t('devicesModule.messages.devices.notEdited', { device: device.name });

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesValidationException('Form not valid');

		try {
			await devicesStore.edit({
				id: device.id,
				data: {
					name: model.name,
					description: model.description?.trim() === '' ? null : model.description,
				},
			});

			if (device.draft) {
				await devicesStore.save({
					id: device.id,
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
				t(messages && messages.success ? messages.success : 'devicesModule.messages.devices.created', {
					device: device.name,
				})
			);

			return 'added';
		}

		flashMessage.success(
			t(messages && messages.success ? messages.success : 'devicesModule.messages.devices.edited', {
				device: device.name,
			})
		);

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (val: IDeviceEditForm): void => {
		if (val.name !== device.name) {
			formChanged.value = true;
		} else if (val.description !== device.description) {
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
