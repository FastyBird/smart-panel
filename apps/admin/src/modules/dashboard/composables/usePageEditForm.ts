import { type Reactive, reactive, ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';
import { cloneDeep, isEqual } from 'lodash';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType } from '../dashboard.constants';
import { DashboardApiException, DashboardValidationException } from '../dashboard.exceptions';
import { PageEditFormSchema } from '../schemas/pages.schemas';
import type { IPageEditForm } from '../schemas/pages.types';
import { pagesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';

import type { IUsePageEditForm } from './types';
import { usePagesPlugin } from './usePagesPlugin';

interface IUsePageEditFormProps {
	page: IPage;
	messages?: { success?: string; error?: string };
}

export const usePageEditForm = <TForm extends IPageEditForm = IPageEditForm>({ page, messages }: IUsePageEditFormProps): IUsePageEditForm<TForm> => {
	const storesManager = injectStoresManager();

	const { plugin } = usePagesPlugin({ type: page.type });

	const pagesStore = storesManager.getStore(pagesStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<TForm>(page as unknown as TForm);

	let initialModel: Reactive<TForm> = cloneDeep<Reactive<TForm>>(toRaw(model));

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = page.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: page.draft
					? t('dashboardModule.messages.pages.notCreated', { page: page.title })
					: t('dashboardModule.messages.pages.notEdited', { page: page.title });

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new DashboardValidationException('Form not valid');

		const parsedModel = (plugin.value?.schemas?.pageEditFormSchema || PageEditFormSchema).safeParse(model);

		if (!parsedModel.success) {
			console.error('Schema validation failed with:', parsedModel.error);

			throw new DashboardValidationException('Failed to validate edit page model.');
		}

		try {
			await pagesStore.edit({
				id: page.id,
				data: {
					...parsedModel.data,
					type: page.type,
				},
			});

			if (page.draft) {
				await pagesStore.save({
					id: page.id,
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
			flashMessage.success(
				t(messages && messages.success ? messages.success : 'dashboardModule.messages.pages.created', {
					page: page.title,
				})
			);

			return 'added';
		}

		flashMessage.success(
			t(messages && messages.success ? messages.success : 'dashboardModule.messages.pages.edited', {
				page: page.title,
			})
		);

		formChanged.value = false;

		initialModel = cloneDeep<Reactive<TForm>>(toRaw(model));

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
