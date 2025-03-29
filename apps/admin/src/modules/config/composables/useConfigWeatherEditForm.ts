import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ConfigWeatherUnit, PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type } from '../../../openapi';
import { FormResult, type FormResultType } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';
import { type IConfigWeather, configWeatherStoreKey } from '../store';

import type { IConfigWeatherEditForm, IUseConfigWeatherEditForm } from './types';

export const useConfigWeatherEditForm = (config: IConfigWeather, messages?: { success?: string; error?: string }): IUseConfigWeatherEditForm => {
	const storesManager = injectStoresManager();

	const configWeatherStore = storesManager.getStore(configWeatherStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const locationTypeOptions: { value: PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type; label: string }[] = Object.values(
		PathsWeatherModuleWeatherCurrentGetParametersQueryLocation_type
	).map((value) => ({
		value,
		label: t(`configModule.locationTypes.${value}`),
	}));

	const unitOptions: { value: ConfigWeatherUnit; label: string }[] = Object.values(ConfigWeatherUnit).map((value) => ({
		value,
		label: t(`configModule.weatherUnits.${value}`),
	}));

	const model = reactive<IConfigWeatherEditForm>({
		location: config.location || '',
		locationType: config.locationType,
		unit: config.unit,
		openWeatherApiKey: config.openWeatherApiKey || '',
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'saved'> => {
		formResult.value = FormResult.WORKING;

		const errorMessage = messages && messages.error ? messages.error : t('configModule.messages.configWeather.notEdited');

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new ConfigValidationException('Form not valid');

		try {
			await configWeatherStore.edit({
				data: {
					location: model.location?.trim() === '' ? null : model.location,
					locationType: model.locationType,
					unit: model.unit,
					openWeatherApiKey: model.openWeatherApiKey?.trim() === '' ? null : model.openWeatherApiKey,
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

		flashMessage.success(t(messages && messages.success ? messages.success : 'configModule.messages.configWeather.edited'));

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (val: IConfigWeatherEditForm): void => {
		if (val.location !== config.location) {
			formChanged.value = true;
		} else if (val.locationType !== config.locationType) {
			formChanged.value = true;
		} else if (val.unit !== config.unit) {
			formChanged.value = true;
		} else if (val.openWeatherApiKey !== config.openWeatherApiKey) {
			formChanged.value = true;
		} else {
			formChanged.value = false;
		}
	});

	return {
		locationTypeOptions,
		unitOptions,
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
	};
};
