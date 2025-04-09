import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../dashboard.constants';
import { DashboardApiException, DashboardValidationException } from '../dashboard.exceptions';
import { DataSourceUpdateSchema } from '../schemas/dataSources.schemas';
import type { IDataSource } from '../store/dataSources.store.types';
import { dataSourcesStoreKey } from '../store/keys';

import type { IDataSourceEditForm, IUseDataSourceEditForm } from './types';
import { useDataSourcesPlugin } from './useDataSourcesPlugin';

interface IUseDataSourceEditFormProps {
	dataSource: IDataSource;
	messages?: { success?: string; error?: string };
}

export const useDataSourceEditForm = ({ dataSource, messages }: IUseDataSourceEditFormProps): IUseDataSourceEditForm => {
	const storesManager = injectStoresManager();

	const { plugin } = useDataSourcesPlugin({ type: dataSource.type });

	const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<IDataSourceEditForm>({
		id: dataSource.id,
		type: dataSource.type,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = dataSource.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: dataSource.draft
					? t('dashboardModule.messages.dataSources.notCreated')
					: t('dashboardModule.messages.dataSources.notEdited');

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DashboardValidationException('Form not valid');

		const parsedModel = (plugin.value?.schemas?.dataSourceEditSchema || DataSourceUpdateSchema).safeParse(model);

		if (!parsedModel.success) {
			throw new DashboardValidationException('Failed to validate create dataSource model.');
		}

		try {
			await dataSourcesStore.edit({
				id: dataSource.id,
				parent: dataSource.parent,
				data: {
					...parsedModel.data,
					type: dataSource.type,
				},
			});

			if (dataSource.draft) {
				await dataSourcesStore.save({
					id: dataSource.id,
					parent: dataSource.parent,
				});
			}
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

		if (isDraft) {
			flashMessage.success(t(messages && messages.success ? messages.success : 'dashboardModule.messages.dataSources.created'));

			return 'added';
		}

		flashMessage.success(t(messages && messages.success ? messages.success : 'dashboardModule.messages.dataSources.edited'));

		return 'saved';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	watch(model, (): void => {
		formChanged.value = false;
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
