import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { DevicesModuleDeviceCategory } from '../../../openapi';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import { DeviceEditFormSchema } from '../schemas/devices.schemas';
import type { IDeviceEditForm } from '../schemas/devices.types';
import type { IDevice } from '../store/devices.store.types';
import { devicesStoreKey } from '../store/keys';

import type { IUseDeviceEditForm } from './types';
import { useDevicesPlugin } from './useDevicesPlugin';

interface IUseDeviceEditFormProps {
	device: IDevice;
	messages?: { success?: string; error?: string };
}

export const useDeviceEditForm = <TForm extends IDeviceEditForm = IDeviceEditForm>({
	device,
	messages,
}: IUseDeviceEditFormProps): IUseDeviceEditForm<TForm> => {
	const storesManager = injectStoresManager();

	const { element } = useDevicesPlugin({ type: device.type });

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

	const model = reactive<TForm>(device as unknown as TForm);

	let initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

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

		const parsedModel = (element.value?.schemas?.deviceEditFormSchema || DeviceEditFormSchema).safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			throw new DevicesValidationException('Failed to validate edit device model.');
		}

		try {
			await devicesStore.edit({
				id: device.id,
				data: {
					...parsedModel.data,
					type: device.type,
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

		formChanged.value = false;

		initialModel = deepClone<Reactive<TForm>>(toRaw(model));

		return 'saved';
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
