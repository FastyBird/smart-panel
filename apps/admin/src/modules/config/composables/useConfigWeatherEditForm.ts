import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import {
	ConfigModuleWeatherCityIdLocationType,
	ConfigModuleWeatherCityNameLocationType,
	ConfigModuleWeatherLatLonLocationType,
	ConfigModuleWeatherUnit,
	ConfigModuleWeatherZipCodeLocationType,
} from '../../../openapi.constants';
import { FormResult, type FormResultType } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';
import type { IConfigWeather } from '../store/config-weather.store.types';
import { configWeatherStoreKey } from '../store/keys';

import type { IConfigWeatherEditForm, IUseConfigWeatherEditForm } from './types';

interface IUseLanguageEditFormProps {
	config: IConfigWeather;
	messages?: { success?: string; error?: string };
}

export const useConfigWeatherEditForm = ({ config, messages }: IUseLanguageEditFormProps): IUseConfigWeatherEditForm => {
	const storesManager = injectStoresManager();

	const configWeatherStore = storesManager.getStore(configWeatherStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const locationTypeOptions: {
		value:
			| ConfigModuleWeatherLatLonLocationType
			| ConfigModuleWeatherCityNameLocationType
			| ConfigModuleWeatherCityIdLocationType
			| ConfigModuleWeatherZipCodeLocationType;
		label: string;
	}[] = [
		...Object.values(ConfigModuleWeatherLatLonLocationType),
		...Object.values(ConfigModuleWeatherCityNameLocationType),
		...Object.values(ConfigModuleWeatherCityIdLocationType),
		...Object.values(ConfigModuleWeatherZipCodeLocationType),
	].map((value) => ({
		value,
		label: t(`configModule.locationTypes.${value}`),
	}));

	const unitOptions: { value: ConfigModuleWeatherUnit; label: string }[] = Object.values(ConfigModuleWeatherUnit).map((value) => ({
		value,
		label: t(`configModule.weatherUnits.${value}`),
	}));

	const model = reactive<IConfigWeatherEditForm>({
		longitude: config.longitude || null,
		latitude: config.latitude || null,
		cityName: config.cityName || null,
		cityId: config.cityId || null,
		zipCode: config.zipCode || null,
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
					longitude: !model.longitude ? null : model.longitude,
					latitude: !model.latitude ? null : model.latitude,
					cityName: !model.cityName || model.cityName?.trim() === '' ? null : model.cityName,
					cityId: !model.cityId ? null : model.cityId,
					zipCode: !model.zipCode || model.zipCode?.trim() === '' ? null : model.zipCode,
					locationType: model.locationType,
					unit: model.unit,
					openWeatherApiKey: !model.openWeatherApiKey || model.openWeatherApiKey?.trim() === '' ? null : model.openWeatherApiKey,
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

		formChanged.value = false;

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (val: IConfigWeatherEditForm): void => {
		if (val.longitude !== config.longitude) {
			formChanged.value = true;
		} else if (val.latitude !== config.latitude) {
			formChanged.value = true;
		} else if (val.cityName !== config.cityName) {
			formChanged.value = true;
		} else if (val.cityId !== config.cityId) {
			formChanged.value = true;
		} else if (val.zipCode !== config.zipCode) {
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
