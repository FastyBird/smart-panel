import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';
import type { IConfigAudio } from '../store/config-audio.store.types';
import { configAudioStoreKey } from '../store/keys';

import type { IConfigAudioEditForm, IUseConfigAudioEditForm } from './types';
import { cloneDeep } from 'lodash';

interface IUseAudioEditFormProps {
	config: IConfigAudio;
	messages?: { success?: string; error?: string };
}

export const useConfigAudioEditForm = ({ config, messages }: IUseAudioEditFormProps): IUseConfigAudioEditForm => {
	const storesManager = injectStoresManager();

	const configAudioStore = storesManager.getStore(configAudioStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<IConfigAudioEditForm>({
		speaker: config.speaker,
		speakerVolume: config.speakerVolume,
		microphone: config.microphone,
		microphoneVolume: config.microphoneVolume,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'saved'> => {
		formResult.value = FormResult.WORKING;

		const errorMessage = messages && messages.error ? messages.error : t('configModule.messages.configAudio.notEdited');

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new ConfigValidationException('Form not valid');

		try {
			await configAudioStore.edit({
				data: {
					speaker: model.speaker,
					speakerVolume: model.speakerVolume,
					microphone: model.microphone,
					microphoneVolume: model.microphoneVolume,
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

		flashMessage.success(t(messages && messages.success ? messages.success : 'configModule.messages.configAudio.edited'));

		formChanged.value = false;

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (val: IConfigAudioEditForm): void => {
		if (val.speaker !== config.speaker) {
			formChanged.value = true;
		} else if (val.speakerVolume !== config.speakerVolume) {
			formChanged.value = true;
		} else if (val.microphone !== config.microphone) {
			formChanged.value = true;
		} else if (val.microphoneVolume !== config.microphoneVolume) {
			formChanged.value = true;
		} else {
			formChanged.value = false;
		}
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
