import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { type IPluginElement, deepClone, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { CONFIG_MODULE_PLUGIN_TYPE, FormResult, type FormResultType } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';
import type { IPluginsComponents, IPluginsSchemas } from '../config.types';
import { ConfigPluginEditFormSchema } from '../schemas/plugins.schemas';
import type { IConfigPluginEditForm } from '../schemas/plugins.types';
import type { IConfigPlugin } from '../store/config-plugins.store.types';
import { configPluginsStoreKey } from '../store/keys';

import type { IUseConfigPluginEditForm } from './types';
import { usePlugin } from './usePlugin';

interface IUseConfigPluginEditFormProps {
	config: IConfigPlugin;
	messages?: { success?: string; error?: string };
}

export const useConfigPluginEditForm = <TForm extends IConfigPluginEditForm = IConfigPluginEditForm>({
	config,
	messages,
}: IUseConfigPluginEditFormProps): IUseConfigPluginEditForm<TForm> => {
	const storesManager = injectStoresManager();

	const { plugin } = usePlugin({ name: config.type });

	const element = computed<IPluginElement<IPluginsComponents, IPluginsSchemas> | undefined>(
		(): IPluginElement<IPluginsComponents, IPluginsSchemas> | undefined => {
			return plugin.value?.elements?.find((element) => element.type === CONFIG_MODULE_PLUGIN_TYPE);
		}
	);

	const configPluginsStore = storesManager.getStore(configPluginsStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<TForm>(config as unknown as TForm);

	let initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const markSaved = (): void => {
		initialModel = deepClone<Reactive<TForm>>(toRaw(model));
		formChanged.value = false;
	};

	/**
	 * Replaces the model's contents with a configuration the backend has confirmed.
	 *
	 * Anything the answer does not carry is dropped rather than left in place: a redacted secret
	 * is absent from every response, and absent is exactly what the model should end up holding.
	 */
	const reconcile = (saved: IConfigPlugin): void => {
		const current = model as unknown as Record<string, unknown>;
		const next = saved as unknown as Record<string, unknown>;

		for (const key of Object.keys(current)) {
			if (!(key in next)) {
				delete current[key];
			}
		}

		Object.assign(current, next);
	};

	const submit = async (): Promise<'saved'> => {
		const errorMessage = messages && messages.error ? messages.error : t('configModule.messages.configPlugin.notEdited');

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new ConfigValidationException('Form not valid');

		const parsedModel = (element.value?.schemas?.pluginConfigEditFormSchema || ConfigPluginEditFormSchema).safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			throw new ConfigValidationException('Failed to validate create tile model.');
		}

		formResult.value = FormResult.WORKING;

		let saved: IConfigPlugin;

		try {
			saved = await configPluginsStore.edit({
				data: {
					...parsedModel.data,
					type: config.type,
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

		// The model is still the object that was submitted, and a secret is never in what comes
		// back. Left alone it would keep a saved credential in the field and send it again on the
		// next save, keep announcing a removal that has already happened, and leave a key that was
		// just stored with no way to remove it until the page is reloaded.
		reconcile(saved);

		markSaved();

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(t(messages && messages.success ? messages.success : 'configModule.messages.configPlugin.edited'));

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (): void => {
		formChanged.value = !isEqual(toRaw(model), initialModel);
	});

	return {
		model,
		formEl,
		formChanged,
		submit,
		clear,
		formResult,
		markSaved,
	};
};
