import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { DevicesModuleDeviceCategory } from '../../../openapi.constants';
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

		const data = { ...parsedModel.data };

		// `model` is the same underlying object as `device` (bound via `reactive()`, not cloned), so
		// `device.roomId` already reflects any edit made to `model.roomId` and cannot serve as the
		// pre-edit value here. `initialModel` is the untouched snapshot taken when this edit session
		// began, so it is the only correct baseline for "did the room change". Room IDs are compared
		// by value, not identity, since both sides are a UUID string or `null`, never a shared object
		// reference. A patch that leaves the room untouched must not carry `roomId` at all — including
		// when it is already `null` — because the backend's hidden-device guard treats a present
		// `roomId` key as a placement change regardless of its value.
		if (isEqual(data.roomId, initialModel.roomId)) {
			delete data.roomId;
		}

		formResult.value = FormResult.WORKING;

		try {
			await devicesStore.edit({
				id: device.id,
				data: {
					...data,
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
