import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage } from '../../../common';
import { DisplayProfileEditFormSchema } from '../schemas/displays-profiles.schemas';
import type { IDisplayProfileEditForm } from '../schemas/displays-profiles.types';
import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import { displaysStoreKey } from '../store/keys';
import { FormResult, type FormResultType } from '../system.constants';
import { SystemApiException, SystemValidationException } from '../system.exceptions';

import type { IUseDisplayProfileEditForm } from './types';

interface IUseDisplayProfileEditFormProps {
	display: IDisplayProfile;
	messages?: { success?: string; error?: string };
}

export const useDisplayProfileEditForm = ({ display, messages }: IUseDisplayProfileEditFormProps): IUseDisplayProfileEditForm => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<IDisplayProfileEditForm>(display as unknown as IDisplayProfileEditForm);

	let initialModel: Reactive<IDisplayProfileEditForm> = deepClone<Reactive<IDisplayProfileEditForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const errorMessage =
			messages && messages.error ? messages.error : t('systemModule.messages.displaysProfiles.notEdited', { display: display.uid.slice(0, 8) });

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new SystemValidationException('Form not valid');

		const parsedModel = DisplayProfileEditFormSchema.safeParse(model);

		if (!parsedModel.success) {
			console.error('Schema validation failed with:', parsedModel.error);

			throw new SystemValidationException('Failed to validate edit display profile model.');
		}

		try {
			await displaysStore.edit({
				id: display.id,
				data: parsedModel.data,
			});
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof SystemApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(errorMessage);
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(
			t(messages && messages.success ? messages.success : 'systemModule.messages.displaysProfiles.edited', { display: display.uid.slice(0, 8) })
		);

		formChanged.value = false;

		initialModel = deepClone<Reactive<IDisplayProfileEditForm>>(toRaw(model));

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
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
