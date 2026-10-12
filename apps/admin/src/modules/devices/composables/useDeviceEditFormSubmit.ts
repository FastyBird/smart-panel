import { type Reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { FormResult, type FormResultType } from '../devices.constants';
import { DevicesApiException, DevicesValidationException } from '../devices.exceptions';
import type { IDeviceEditForm } from '../schemas/devices.types';
import { devicesStoreKey } from '../store/keys';

import type { IUseDeviceEditFormSubmitProps } from './useDeviceEditFormSubmit.types';

/** Shared edit lifecycle; plugins retain their model, schema, and payload-specific fields. */
export const useDeviceEditFormSubmit = <TForm extends IDeviceEditForm, TData extends IDeviceEditForm>({
	device,
	model,
	messages,
	messagePrefix,
	parseModel,
	validationException,
	prepareData,
}: IUseDeviceEditFormSubmitProps<TForm, TData>) => {
	const devicesStore = injectStoresManager().getStore(devicesStoreKey);
	const { t } = useI18n();
	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formEl = ref<FormInstance | undefined>(undefined);
	const formChanged = ref<boolean>(false);
	const formResult = ref<FormResultType>(FormResult.NONE);
	let initialModel = deepClone<Reactive<TForm>>(toRaw(model));
	let timer: number;

	const clear = (): void => {
		window.clearTimeout(timer);
		formResult.value = FormResult.NONE;
	};

	const submit = async (): Promise<'added' | 'saved'> => {
		const isDraft = device.draft;
		const errorMessage = messages?.error || t(`${messagePrefix}.messages.devices.${isDraft ? 'notCreated' : 'notEdited'}`, { device: device.name });

		formEl.value!.clearValidate();
		const valid = await formEl.value!.validate();

		if (!valid) throw new DevicesValidationException('Form not valid');

		const parsedModel = parseModel();

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);
			throw new validationException('Failed to validate edit device model.');
		}

		formResult.value = FormResult.WORKING;

		try {
			const data = prepareData ? prepareData(parsedModel.data, initialModel) : { ...parsedModel.data };

			// The model may share the device's object, so compare placement with the session snapshot.
			// Omit an unchanged room (even null): a present key triggers backend placement validation.
			if (!prepareData && isEqual(data.roomId, initialModel.roomId)) {
				delete data.roomId;
			}

			await devicesStore.edit({ id: device.id, data: { ...data, type: device.type } });

			if (device.draft) {
				await devicesStore.save({ id: device.id });
			}
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;
			timer = window.setTimeout(clear, 2000);
			flashMessage.error(error instanceof DevicesApiException && error.code === 422 ? error.message : errorMessage);
			throw error;
		}

		formResult.value = FormResult.OK;
		timer = window.setTimeout(clear, 2000);
		flashMessage.success(t(messages?.success || `${messagePrefix}.messages.devices.${isDraft ? 'created' : 'edited'}`, { device: device.name }));

		if (isDraft) return 'added';

		formChanged.value = false;
		initialModel = deepClone<Reactive<TForm>>(toRaw(model));
		return 'saved';
	};

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
	});

	return { formEl, formChanged, formResult, submit, clear };
};
