import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ConfigLanguageLanguage, ConfigLanguageTime_format } from '../../../openapi';
import { FormResult, type FormResultType } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';
import { type IConfigLanguage, configLanguageStoreKey } from '../store';

import type { IConfigLanguageEditForm, IUseConfigLanguageEditForm } from './types';

export const useConfigLanguageEditForm = (config: IConfigLanguage, messages?: { success?: string; error?: string }): IUseConfigLanguageEditForm => {
	const storesManager = injectStoresManager();

	const configLanguageStore = storesManager.getStore(configLanguageStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const languageOptions: { value: ConfigLanguageLanguage; label: string }[] = Object.values(ConfigLanguageLanguage).map((value) => ({
		value,
		label: t(`configModule.languages.${value}`),
	}));

	const timeFormatOptions: { value: ConfigLanguageTime_format; label: string }[] = Object.values(ConfigLanguageTime_format).map((value) => ({
		value,
		label: t(`configModule.timeFormats.${value}`),
	}));

	const timezoneOptions: { value: string; label: string }[] = [
		{
			value: 'Africa/Cairo',
			label: 'Africa/Cairo',
		},
		{
			value: 'Africa/Johannesburg',
			label: 'Africa/Johannesburg',
		},
		{
			value: 'America/New_York',
			label: 'America/New_York',
		},
		{
			value: 'America/Los_Angeles',
			label: 'America/Los_Angeles',
		},
		{
			value: 'Asia/Dubai',
			label: 'Asia/Dubai',
		},
		{
			value: 'Asia/Tokyo',
			label: 'Asia/Tokyo',
		},
		{
			value: 'Asia/Kolkata',
			label: 'Asia/Kolkata',
		},
		{
			value: 'Australia/Sydney',
			label: 'Australia/Sydney',
		},
		{
			value: 'Europe/London',
			label: 'Europe/London',
		},
		{
			value: 'Europe/Berlin',
			label: 'Europe/Berlin',
		},
		{
			value: 'Europe/Prague',
			label: 'Europe/Prague',
		},
	];

	const model = reactive<IConfigLanguageEditForm>({
		language: config.language,
		timezone: config.timezone,
		timeFormat: config.timeFormat,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'saved'> => {
		formResult.value = FormResult.WORKING;

		const errorMessage = messages && messages.error ? messages.error : t('configModule.messages.configLanguage.notEdited');

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new ConfigValidationException('Form not valid');

		try {
			await configLanguageStore.edit({
				data: {
					language: model.language,
					timezone: model.timezone,
					timeFormat: model.timeFormat,
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

		flashMessage.success(t(messages && messages.success ? messages.success : 'configModule.messages.configLanguage.edited'));

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (val: IConfigLanguageEditForm): void => {
		if (val.language !== config.language) {
			formChanged.value = true;
		} else if (val.timezone !== config.timezone) {
			formChanged.value = true;
		} else if (val.timeFormat !== config.timeFormat) {
			formChanged.value = true;
		} else {
			formChanged.value = false;
		}
	});

	return {
		languageOptions,
		timezoneOptions,
		timeFormatOptions,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
