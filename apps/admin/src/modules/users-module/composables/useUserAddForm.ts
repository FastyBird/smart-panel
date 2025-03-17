import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { usersStoreKey } from '../store';
import { FormResult, type FormResultType } from '../users.constants';
import { UsersApiException } from '../users.exceptions';

import type { IUseUserAddForm, IUserAddForm } from './types';

export const useUserAddForm = (id: string): IUseUserAddForm => {
	const storesManager = injectStoresManager();

	const usersStore = storesManager.getStore(usersStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const submit = async (model: IUserAddForm): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const errorMessage = t('usersModule.messages.notCreated', { user: model.username });

		try {
			await usersStore.add({
				id,
				draft: false,
				data: {
					username: model.username,
					password: model.password,
					email: model.email?.trim() === '' ? null : model.email,
					firstName: model.firstName?.trim() === '' ? null : model.firstName,
					lastName: model.lastName?.trim() === '' ? null : model.lastName,
					role: model.role,
				},
			});
		} catch (error: unknown) {
			formResult.value = FormResult.ERROR;

			timer = window.setTimeout(clear, 2000);

			if (error instanceof UsersApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(errorMessage);
			}

			throw error;
		}

		formResult.value = FormResult.OK;

		timer = window.setTimeout(clear, 2000);

		flashMessage.success(
			t('usersModule.messages.created', {
				user: model.username,
			})
		);

		return 'added';
	};

	const clear = (): void => {
		window.clearTimeout(timer);

		formResult.value = FormResult.NONE;
	};

	return {
		submit,
		clear,
		formResult,
	};
};
