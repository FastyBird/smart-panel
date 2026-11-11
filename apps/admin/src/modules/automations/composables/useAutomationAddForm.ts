import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { AutomationMode, FormResult, type FormResultType } from '../automations.constants';
import { AutomationsApiException, AutomationsValidationException } from '../automations.exceptions';
import type { IAutomationAddForm } from '../schemas/automations.types';
import type { IAutomation } from '../store/automations.store.types';
import { automationsStoreKey } from '../store/keys';

import type { IUseAutomationAddForm } from './types';
import { useAutomationModes } from './useAutomationModes';

interface IUseAutomationAddFormProps {
	id: IAutomation['id'];
}

/**
 * Creates an automation from its basic details. It is created disabled and with an empty flow: an
 * automation without a trigger cannot be enabled, and the flow is drawn in the editor afterwards.
 */
export const useAutomationAddForm = ({ id }: IUseAutomationAddFormProps): IUseAutomationAddForm => {
	const storesManager = injectStoresManager();

	const automationsStore = storesManager.getStore(automationsStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const { modeOptions } = useAutomationModes();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<IAutomationAddForm>({
		id,
		name: '',
		description: '',
		spaceId: null,
		mode: AutomationMode.restart,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new AutomationsValidationException('Form not valid');

		formResult.value = FormResult.WORKING;

		try {
			await automationsStore.add({
				id,
				data: {
					name: model.name,
					description: model.description ?? null,
					spaceId: model.spaceId ?? null,
					mode: model.mode,
				},
			});
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof AutomationsApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(t('automations.messages.notCreated', { automation: model.name }));
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(t('automations.messages.created', { automation: model.name }));

		return 'added';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (val: IAutomationAddForm): void => {
		formChanged.value = val.name !== '' || (val.description ?? '') !== '' || (val.spaceId ?? null) !== null || val.mode !== AutomationMode.restart;
	});

	return {
		modeOptions,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
