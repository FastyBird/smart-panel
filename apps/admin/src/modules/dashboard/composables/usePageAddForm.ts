import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { cloneDeep, isEqual } from 'lodash';

import { type IPlugin, injectStoresManager, useFlashMessage } from '../../../common';
import { getSchemaDefaults } from '../../../common/utils/schemas.utils';
import { FormResult, type FormResultType } from '../dashboard.constants';
import { DashboardApiException, DashboardValidationException } from '../dashboard.exceptions';
import { PageAddFormSchema } from '../schemas/pages.schemas';
import type { IPageAddForm } from '../schemas/pages.types';
import { pagesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';

import type { IUsePageAddForm } from './types';
import { usePagesPlugin } from './usePagesPlugin';

interface IUsePageAddFormProps {
	id: IPage['id'];
	type: IPlugin['type'];
}

export const usePageAddForm = <TForm extends IPageAddForm = IPageAddForm>({ id, type }: IUsePageAddFormProps): IUsePageAddForm<TForm> => {
	const storesManager = injectStoresManager();

	const { element } = usePagesPlugin({ type });

	const pagesStore = storesManager.getStore(pagesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<TForm>({
		...getSchemaDefaults(element.value?.schemas?.pageAddFormSchema || PageAddFormSchema),
		id,
		type,
		title: '',
		icon: '',
		order: 0,
		showTopBar: true,
	} as TForm);

	const initialModel: Reactive<TForm> = cloneDeep<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DashboardValidationException('Form not valid');

		const parsedModel = (element.value?.schemas?.pageAddFormSchema || PageAddFormSchema).safeParse(model);

		if (!parsedModel.success) {
			console.error('Schema validation failed with:', parsedModel.error);

			throw new DashboardValidationException('Failed to validate create page model.');
		}

		formResult.value = FormResult.WORKING;

		const errorMessage = t('dashboardModule.messages.pages.notCreated', { page: model.title });

		try {
			await pagesStore.add({
				id,
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

		flashMessage.success(
			t('dashboardModule.messages.pages.created', {
				page: model.title,
			})
		);

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
