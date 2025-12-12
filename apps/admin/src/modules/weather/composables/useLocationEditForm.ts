import { type ComputedRef, type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { FormResult, type FormResultType } from '../weather.constants';
import { WeatherApiException, WeatherValidationException } from '../weather.exceptions';
import { weatherLocationsStoreKey } from '../store/keys';
import { WeatherLocationEditFormSchema } from '../store/locations.store.schemas';
import type { IWeatherLocationEditForm, IWeatherLocation } from '../store/locations.store.types';

import type { IUseWeatherLocationEditForm } from './types';

interface IUseLocationEditFormProps {
	id: ComputedRef<IWeatherLocation['id']>;
}

export const useLocationEditForm = ({ id }: IUseLocationEditFormProps): IUseWeatherLocationEditForm => {
	const storesManager = injectStoresManager();

	const locationsStore = storesManager.getStore(weatherLocationsStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const location = locationsStore.findById(id.value);

	const model = reactive<IWeatherLocationEditForm>({
		name: location?.name ?? '',
	});

	const initialModel: Reactive<IWeatherLocationEditForm> = deepClone<Reactive<IWeatherLocationEditForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<void> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new WeatherValidationException('Form not valid');

		const parsedModel = WeatherLocationEditFormSchema.safeParse(model);

		if (!parsedModel.success) {
			logger.error('[WEATHER_MODULE] Schema validation failed:', parsedModel.error);

			throw new WeatherValidationException('Failed to validate update location model.');
		}

		formResult.value = FormResult.WORKING;

		const existingLocation = locationsStore.findById(id.value);

		if (!existingLocation) {
			throw new WeatherValidationException('Location not found.');
		}

		const errorMessage = t('weatherModule.messages.locations.notUpdated', { location: model.name });

		try {
			await locationsStore.edit({
				id: id.value,
				data: {
					type: existingLocation.type,
					...parsedModel.data,
				},
			});

			formResult.value = FormResult.OK;

			flashMessage.success(t('weatherModule.messages.locations.updated', { location: model.name }));

			// Update initial model to reflect saved state
			Object.assign(initialModel, deepClone(toRaw(model)));
			formChanged.value = false;
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

	// Watch for location changes and update model
	watch(
		() => locationsStore.findById(id.value),
		(newLocation) => {
			if (newLocation && !formChanged.value) {
				model.name = newLocation.name;
				Object.assign(initialModel, deepClone(toRaw(model)));
			}
		}
	);

	return {
		model,
		formEl,
		formChanged,
		submit,
	};
};
