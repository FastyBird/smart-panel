import { onBeforeUnmount, type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../displays.constants';
import { DisplaysApiException, DisplaysValidationException } from '../displays.exceptions';
import type { IDisplay } from '../store/displays.store.types';
import { displaysStoreKey } from '../store/keys';

import type {
	DistanceUnit,
	IDisplayEditForm,
	IUseDisplayEditForm,
	PrecipitationUnit,
	PressureUnit,
	TemperatureUnit,
	WindSpeedUnit,
} from './types';

interface IUseDisplayEditFormProps {
	display: IDisplay;
	messages?: { success?: string; error?: string };
}

export const useDisplayEditForm = ({ display, messages }: IUseDisplayEditFormProps): IUseDisplayEditForm => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number | undefined = undefined;

	const model = reactive<IDisplayEditForm>({
		id: display.id,
		name: display.name,
		role: display.role,
		// Room assignment (only for role=room displays)
		roomId: display.roomId,
		unitSize: display.unitSize,
		rows: display.rows,
		cols: display.cols,
		brightness: display.brightness,
		screenLockDuration: display.screenLockDuration,
		darkMode: display.darkMode,
		screenSaver: display.screenSaver,
		// Audio settings
		speaker: display.speaker,
		speakerVolume: display.speakerVolume,
		microphone: display.microphone,
		microphoneVolume: display.microphoneVolume,
		// Home page configuration
		homeMode: display.homeMode,
		homePageId: display.homePageId,
		// Unit overrides (empty string = use system default; mapped to null on submit)
		temperatureUnit: display.temperatureUnit ?? '',
		windSpeedUnit: display.windSpeedUnit ?? '',
		pressureUnit: display.pressureUnit ?? '',
		precipitationUnit: display.precipitationUnit ?? '',
		distanceUnit: display.distanceUnit ?? '',
	});

	let initialModel: Reactive<IDisplayEditForm> = deepClone<Reactive<IDisplayEditForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'saved'> => {
		formResult.value = FormResult.WORKING;

		const errorMessage =
			messages && messages.error ? messages.error : t('displaysModule.messages.notEdited', { display: display.name || display.macAddress });

		if (!formEl.value) {
			throw new DisplaysValidationException('Form element is not available');
		}

		formEl.value.clearValidate();

		const valid = await formEl.value.validate();

		if (!valid) throw new DisplaysValidationException('Form not valid');

		try {
			const updateData: {
				name: string | null;
				role: 'room' | 'master' | 'entry';
				roomId: string | null;
				unitSize?: number;
				rows?: number;
				cols?: number;
				brightness: number;
				screenLockDuration: number;
				darkMode: boolean;
				screenSaver: boolean;
				speaker?: boolean;
				speakerVolume?: number;
				microphone?: boolean;
				microphoneVolume?: number;
				homeMode: 'auto_space' | 'explicit';
				homePageId: string | null;
				temperatureUnit: TemperatureUnit | null;
				windSpeedUnit: WindSpeedUnit | null;
				pressureUnit: PressureUnit | null;
				precipitationUnit: PrecipitationUnit | null;
				distanceUnit: DistanceUnit | null;
			} = {
				name: model.name || null,
				role: model.role,
				// Room assignment: clear if not room role
				roomId: model.role === 'room' ? model.roomId : null,
				unitSize: model.unitSize,
				rows: model.rows,
				cols: model.cols,
				brightness: model.brightness,
				screenLockDuration: model.screenLockDuration,
				darkMode: model.darkMode,
				screenSaver: model.screenSaver,
				homeMode: model.homeMode,
				// Home page: clear if not explicit mode
				homePageId: model.homeMode === 'explicit' ? model.homePageId : null,
				// Unit overrides
				temperatureUnit: model.temperatureUnit || null,
				windSpeedUnit: model.windSpeedUnit || null,
				pressureUnit: model.pressureUnit || null,
				precipitationUnit: model.precipitationUnit || null,
				distanceUnit: model.distanceUnit || null,
			};

			// Only include audio settings if the display supports them
			if (display.audioOutputSupported) {
				updateData.speaker = model.speaker;
				updateData.speakerVolume = model.speakerVolume;
			}

			if (display.audioInputSupported) {
				updateData.microphone = model.microphone;
				updateData.microphoneVolume = model.microphoneVolume;
			}

			await displaysStore.edit({
				id: display.id,
				data: updateData,
			});
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof DisplaysApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(errorMessage);
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(
			t(messages && messages.success ? messages.success : 'displaysModule.messages.edited', {
				display: display.name || display.macAddress,
			})
		);

		formChanged.value = false;

		initialModel = deepClone<Reactive<IDisplayEditForm>>(toRaw(model));

		return 'saved';
	};

	const clear = (): void => {
		if (timer !== undefined) {
			window.clearTimeout(timer);
			timer = undefined;
		}

		formResult.value = FormResult.NONE;
	};

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
	});

	onBeforeUnmount(() => {
		clear();
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
