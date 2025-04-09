import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { type IPlugin, injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../dashboard.constants';
import { DashboardApiException, DashboardValidationException } from '../dashboard.exceptions';
import { DataSourceCreateSchema } from '../schemas/dataSources.schemas';
import type { IDataSource } from '../store/dataSources.store.types';
import { dataSourcesStoreKey } from '../store/keys';

import type { IDataSourceAddForm, IUseDataSourceAddForm } from './types';
import { useDataSourcesPlugin } from './useDataSourcesPlugin';

interface IUseDataSourceAddFormProps {
	id: IDataSource['id'];
	type: IPlugin['type'];
	parent: string;
	parentId: string;
}

export const useDataSourceAddForm = ({ id, type, parent, parentId }: IUseDataSourceAddFormProps): IUseDataSourceAddForm => {
	const storesManager = injectStoresManager();

	const { plugin } = useDataSourcesPlugin({ type });

	const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<IDataSourceAddForm>({
		id,
		type,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DashboardValidationException('Form not valid');

		const parsedModel = (plugin.value?.schemas?.dataSourceCreateSchema || DataSourceCreateSchema).safeParse(model);

		if (!parsedModel.success) {
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
				draft: false,
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

	watch(model, (val: IDataSourceAddForm): void => {
		if (val.type !== '') {
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
