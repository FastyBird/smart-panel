import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { type IPlugin, injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../dashboard.constants';
import { DashboardApiException, DashboardValidationException } from '../dashboard.exceptions';
import { PageCreateSchema } from '../schemas/pages.schemas';
import { pagesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';

import type { IPageAddForm, IUsePageAddForm } from './types';
import { usePagesPlugin } from './usePagesPlugin';

interface IUsePageAddFormProps {
	id: IPage['id'];
	type: IPlugin['type'];
}

export const usePageAddForm = ({ id, type }: IUsePageAddFormProps): IUsePageAddForm => {
	const storesManager = injectStoresManager();

	const { plugin } = usePagesPlugin({ type });

	const pagesStore = storesManager.getStore(pagesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<IPageAddForm>({
		id,
		type,
		title: '',
		icon: '',
		order: 0,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DashboardValidationException('Form not valid');

		const parsedModel = (plugin.value?.schemas?.pageCreateSchema || PageCreateSchema).safeParse(model);

		if (!parsedModel.success) {
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

	watch(model, (val: IPageAddForm): void => {
		if (val.type !== '') {
			formChanged.value = true;
		} else if (val.title !== '') {
			formChanged.value = true;
		} else if (val.icon !== '') {
			formChanged.value = true;
		} else if (val.order !== 0) {
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
