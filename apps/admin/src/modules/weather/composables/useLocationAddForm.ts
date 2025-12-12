import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { FormResult, type FormResultType } from '../weather.constants';
import { WeatherApiException, WeatherValidationException } from '../weather.exceptions';
import { weatherLocationsStoreKey } from '../store/keys';
import { WeatherLocationAddFormSchema } from '../store/locations.store.schemas';
import type { IWeatherLocationAddForm, IWeatherLocation } from '../store/locations.store.types';

import type { IUseWeatherLocationAddForm } from './types';

interface IUseLocationAddFormProps {
	id: IWeatherLocation['id'];
	type: string;
}

export const useLocationAddForm = ({ id, type }: IUseLocationAddFormProps): IUseWeatherLocationAddForm => {
	const storesManager = injectStoresManager();

	const locationsStore = storesManager.getStore(weatherLocationsStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<IWeatherLocationAddForm>({
		id,
		type,
		name: '',
	});

	const initialModel: Reactive<IWeatherLocationAddForm> = deepClone<Reactive<IWeatherLocationAddForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<void> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new WeatherValidationException('Form not valid');

		const parsedModel = WeatherLocationAddFormSchema.safeParse(model);

		if (!parsedModel.success) {
			logger.error('[WEATHER_MODULE] Schema validation failed:', parsedModel.error);

			throw new WeatherValidationException('Failed to validate create location model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('weatherModule.messages.locations.notCreated', { location: model.name });

		try {
			await locationsStore.add({
				id,
				draft: false,
				data: {
					...parsedModel.data,
					type,
				},
			});

			formResult.value = FormResult.OK;

			flashMessage.success(t('weatherModule.messages.locations.created', { location: model.name }));
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof WeatherApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(errorMessage);
			}

			throw error;
		}
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(
		() => model,
		() => {
			formChanged.value = !isEqual(toRaw(model), initialModel);
		},
		{ deep: true }
	);

	return {
		model,
		formEl,
		formChanged,
		submit,
	};
};
