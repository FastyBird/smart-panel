import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { SystemModuleLogEntryType  } from '../../../openapi.constants';
import { FormResult, type FormResultType } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';
import type { IConfigSystem } from '../store/config-system.store.types';
import { configSystemStoreKey } from '../store/keys';

import type { IConfigSystemEditForm, IUseConfigSystemEditForm } from './types';

interface IUseSystemEditFormProps {
	config: IConfigSystem;
	messages?: { success?: string; error?: string };
}

export const useConfigSystemEditForm = ({ config, messages }: IUseSystemEditFormProps): IUseConfigSystemEditForm => {
	const storesManager = injectStoresManager();

	const configSystemStore = storesManager.getStore(configSystemStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const logLevelsOptions: { value: SystemModuleLogEntryType; label: string }[] = Object.values(SystemModuleLogEntryType).map((value) => ({
		value,
		label: t(`configModule.logLevels.${value}`),
	}));

	const model = reactive<IConfigSystemEditForm>({
		logLevels: config.logLevels,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'saved'> => {
		formResult.value = FormResult.WORKING;

		const errorMessage = messages && messages.error ? messages.error : t('configModule.messages.configSystem.notEdited');

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new ConfigValidationException('Form not valid');

		try {
			await configSystemStore.edit({
				data: {
					logLevels: model.logLevels,
				},
			});
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof ConfigApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(errorMessage);
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(t(messages && messages.success ? messages.success : 'configModule.messages.configSystem.edited'));

		formChanged.value = false;

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(
		model,
		(val: IConfigSystemEditForm): void => {
			if (!isEqual(val.logLevels, config.logLevels)) {
				formChanged.value = true;
			} else {
				formChanged.value = false;
			}
		},
		{ deep: true }
	);

	return {
		logLevelsOptions,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
