import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';
import type { IConfigDisplay } from '../store/config-display.store.types';
import { configDisplayStoreKey } from '../store/keys';

import type { IConfigDisplayEditForm, IUseConfigDisplayEditForm } from './types';

interface IUseDisplayEditFormProps {
	config: IConfigDisplay;
	messages?: { success?: string; error?: string };
}

export const useConfigDisplayEditForm = ({ config, messages }: IUseDisplayEditFormProps): IUseConfigDisplayEditForm => {
	const storesManager = injectStoresManager();

	const configDisplayStore = storesManager.getStore(configDisplayStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const screenLockDurationOptions: { value: number; label: string }[] = [
		{
			value: 15,
			label: t(`configModule.screenLockDurations.15s`),
		},
		{
			value: 30,
			label: t(`configModule.screenLockDurations.30s`),
		},
		{
			value: 60,
			label: t(`configModule.screenLockDurations.60s`),
		},
		{
			value: 120,
			label: t(`configModule.screenLockDurations.120s`),
		},
		{
			value: 300,
			label: t(`configModule.screenLockDurations.300s`),
		},
		{
			value: 600,
			label: t(`configModule.screenLockDurations.600s`),
		},
		{
			value: 1800,
			label: t(`configModule.screenLockDurations.1800s`),
		},
		{
			value: 0,
			label: t(`configModule.screenLockDurations.0s`),
		},
	];

	const model = reactive<IConfigDisplayEditForm>({
		darkMode: config.darkMode,
		brightness: config.brightness,
		screenLockDuration: config.screenLockDuration,
		screenSaver: config.screenSaver,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'saved'> => {
		formResult.value = FormResult.WORKING;

		const errorMessage = messages && messages.error ? messages.error : t('configModule.messages.configDisplay.notEdited');

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new ConfigValidationException('Form not valid');

		try {
			await configDisplayStore.edit({
				data: {
					darkMode: model.darkMode,
					brightness: model.brightness,
					screenLockDuration: model.screenLockDuration,
					screenSaver: model.screenSaver,
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

		flashMessage.success(t(messages && messages.success ? messages.success : 'configModule.messages.configDisplay.edited'));

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (val: IConfigDisplayEditForm): void => {
		if (val.darkMode !== config.darkMode) {
			formChanged.value = true;
		} else if (val.brightness !== config.brightness) {
			formChanged.value = true;
		} else if (val.screenLockDuration !== config.screenLockDuration) {
			formChanged.value = true;
		} else if (val.screenSaver !== config.screenSaver) {
			formChanged.value = true;
		} else {
			formChanged.value = false;
		}
	});

	return {
		screenLockDurationOptions,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
