import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { cloneDeep, isEqual } from 'lodash';

import { type IPlugin, injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../dashboard.constants';
import { DashboardApiException, DashboardValidationException } from '../dashboard.exceptions';
import { DataSourceAddFormSchema } from '../schemas/dataSources.schemas';
import type { IDataSourceAddForm } from '../schemas/dataSources.types';
import type { IDataSource } from '../store/data-sources.store.types';
import { dataSourcesStoreKey } from '../store/keys';

import type { IUseDataSourceAddForm } from './types';
import { useDataSourcesPlugin } from './useDataSourcesPlugin';

interface IUseDataSourceAddFormProps {
	id: IDataSource['id'];
	type: IPlugin['type'];
	parent: string;
	parentId: string;
	onlyDraft?: boolean;
}

export const useDataSourceAddForm = <TForm extends IDataSourceAddForm = IDataSourceAddForm>({
	id,
	type,
	parent,
	parentId,
	onlyDraft = false,
}: IUseDataSourceAddFormProps): IUseDataSourceAddForm<TForm> => {
	const storesManager = injectStoresManager();

	const { plugin } = useDataSourcesPlugin({ type });

	const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<TForm>({
		id,
		type,
	} as TForm);

	const initialModel: Reactive<TForm> = cloneDeep<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DashboardValidationException('Form not valid');

		const parsedModel = (plugin.value?.schemas?.dataSourceAddFormSchema || DataSourceAddFormSchema).safeParse(model);

		if (!parsedModel.success) {
			console.error('Schema validation failed with:', parsedModel.error);

			throw new DashboardValidationException('Failed to validate create data source model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('dashboardModule.messages.dataSources.notCreated');

		try {
			await dataSourcesStore.add({
				id,
				parent: {
					type: parent,
					id: parentId,
				},
				draft: onlyDraft,
				data: {
					...parsedModel.data,
					type,
				},
			});
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof DashboardApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(errorMessage);
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(t('dashboardModule.messages.dataSources.created'));

		return 'added';
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
