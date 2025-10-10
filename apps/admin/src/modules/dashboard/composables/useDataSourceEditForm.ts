import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { isEqual } from 'lodash';

import { deepClone, injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../dashboard.constants';
import { DashboardApiException, DashboardValidationException } from '../dashboard.exceptions';
import { DataSourceEditFormSchema } from '../schemas/dataSources.schemas';
import type { IDataSourceEditForm } from '../schemas/dataSources.types';
import type { IDataSource } from '../store/data-sources.store.types';
import { dataSourcesStoreKey } from '../store/keys';

import type { IUseDataSourceEditForm } from './types';
import { useDataSourcesPlugin } from './useDataSourcesPlugin';

interface IUseDataSourceEditFormProps {
	dataSource: IDataSource;
	messages?: { success?: string; error?: string };
	onlyDraft?: boolean;
}

export const useDataSourceEditForm = <TForm extends IDataSourceEditForm = IDataSourceEditForm>({
	dataSource,
	messages,
	onlyDraft = false,
}: IUseDataSourceEditFormProps): IUseDataSourceEditForm<TForm> => {
	const storesManager = injectStoresManager();

	const { element } = useDataSourcesPlugin({ type: dataSource.type });

	const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<TForm>(dataSource as unknown as TForm);

	let initialModel: Reactive<TForm> = deepClone<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = dataSource.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: dataSource.draft && !onlyDraft
					? t('dashboardModule.messages.dataSources.notCreated')
					: t('dashboardModule.messages.dataSources.notEdited');

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DashboardValidationException('Form not valid');

		const parsedModel = (element.value?.schemas?.dataSourceEditFormSchema || DataSourceEditFormSchema).safeParse(model);

		if (!parsedModel.success) {
			console.error('Schema validation failed with:', parsedModel.error);

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

			if (dataSource.draft && !onlyDraft) {
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

		if (isDraft && !onlyDraft) {
			flashMessage.success(t(messages && messages.success ? messages.success : 'dashboardModule.messages.dataSources.created'));

			return 'added';
		}

		flashMessage.success(t(messages && messages.success ? messages.success : 'dashboardModule.messages.dataSources.edited'));

		formChanged.value = false;

		initialModel = deepClone<Reactive<TForm>>(toRaw(model));

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
