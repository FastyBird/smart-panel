import { type Reactive, computed, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { type IModuleElement, deepClone, injectStoresManager, useFlashMessage, useLogger } from '../../../common';
import { CONFIG_MODULE_MODULE_TYPE, FormResult, type FormResultType } from '../config.constants';
import { ConfigApiException, ConfigValidationException } from '../config.exceptions';
import type { IModulesComponents, IModulesSchemas } from '../config.types';
import { ConfigModuleEditFormSchema } from '../schemas/modules.schemas';
import type { IConfigModuleEditForm } from '../schemas/modules.types';
import type { IConfigModule } from '../store/config-modules.store.types';
import { configModulesStoreKey } from '../store/keys';

import type { IUseConfigModuleEditForm } from './types';
import { useModule } from './useModule';

interface IUseConfigModuleEditFormProps {
	config: IConfigModule;
	messages?: { success?: string; error?: string };
}

export const useConfigModuleEditForm = <TForm extends IConfigModuleEditForm = IConfigModuleEditForm>({
	config,
	messages,
}: IUseConfigModuleEditFormProps): IUseConfigModuleEditForm<TForm> => {
	const storesManager = injectStoresManager();

	const { module } = useModule({ name: config.type });

	const element = computed<IModuleElement<IModulesComponents, IModulesSchemas> | undefined>(
		(): IModuleElement<IModulesComponents, IModulesSchemas> | undefined => {
			return module.value?.elements?.find((element) => element.type === CONFIG_MODULE_MODULE_TYPE);
		}
	);

	const configModulesStore = storesManager.getStore(configModulesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();
	const logger = useLogger();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<TForm>(config as unknown as TForm);

	const initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'saved'> => {
		formResult.value = FormResult.WORKING;

		const errorMessage = messages && messages.error ? messages.error : t('configModule.messages.configModule.notEdited');

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new ConfigValidationException('Form not valid');

		const parsedModel = (element.value?.schemas?.moduleConfigEditFormSchema || ConfigModuleEditFormSchema).safeParse(model);

		if (!parsedModel.success) {
			logger.error('Schema validation failed with:', parsedModel.error);

			throw new ConfigValidationException('Failed to validate create module model.');
		}

		try {
			await configModulesStore.edit({
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

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(t(messages && messages.success ? messages.success : 'configModule.messages.configModule.edited'));

		formChanged.value = false;

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
	};
};

