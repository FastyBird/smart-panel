import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../automations.constants';
import { AutomationsApiException, AutomationsRevisionConflictException, AutomationsValidationException } from '../automations.exceptions';
import type { IAutomationEditForm } from '../schemas/automations.types';
import type { IAutomation } from '../store/automations.store.types';
import { automationsStoreKey } from '../store/keys';

import type { IUseAutomationEditForm } from './types';
import { useAutomationModes } from './useAutomationModes';

interface IUseAutomationEditFormProps {
	automation: IAutomation;
}

/**
 * Edits the basic details of an automation: its name, description, space and run mode. The flow itself
 * is never sent from here, so it stays as the backend holds it.
 */
export const useAutomationEditForm = ({ automation }: IUseAutomationEditFormProps): IUseAutomationEditForm => {
	const storesManager = injectStoresManager();

	const automationsStore = storesManager.getStore(automationsStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const { modeOptions } = useAutomationModes();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<IAutomationEditForm>({
		id: automation.id,
		name: automation.name,
		description: automation.description ?? '',
		spaceId: automation.spaceId,
		mode: automation.mode,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'saved'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new AutomationsValidationException('Form not valid');

		formResult.value = FormResult.WORKING;

		try {
			await automationsStore.edit({
				id: automation.id,
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

			if (error instanceof AutomationsRevisionConflictException) {
				flashMessage.warning(t('automations.messages.changedElsewhere', { automation: automation.name }));
			} else if (error instanceof AutomationsApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(t('automations.messages.notEdited', { automation: automation.name }));
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(t('automations.messages.edited', { automation: model.name }));

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (val: IAutomationEditForm): void => {
		formChanged.value =
			val.name !== automation.name ||
			(val.description ?? '') !== (automation.description ?? '') ||
			(val.spaceId ?? null) !== automation.spaceId ||
			val.mode !== automation.mode;
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
