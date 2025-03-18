import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { type IUser, usersStoreKey } from '../store';
import { FormResult, type FormResultType } from '../users.constants';
import { UsersApiException } from '../users.exceptions';

import type { IUseUserEditForm, IUserEditForm } from './types';

export const useUserEditForm = (user: IUser, messages?: { success?: string; error?: string }): IUseUserEditForm => {
	const storesManager = injectStoresManager();

	const usersStore = storesManager.getStore(usersStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const submit = async (model: IUserEditForm): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = user.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: user.draft
					? t('usersModule.messages.notCreated', { user: user.username })
					: t('usersModule.messages.notEdited', { user: user.username });

		try {
			await usersStore.edit({
				id: user.id,
				data: {
					username: model.username,
					password: model.password,
					email: !model.email || model.email.trim() === '' ? null : model.email,
					firstName: !model.firstName || model.firstName.trim() === '' ? null : model.firstName,
					lastName: !model.lastName || model.lastName.trim() === '' ? null : model.lastName,
					role: model.role,
				},
			});

			if (user.draft) {
				await usersStore.save({
					id: user.id,
				});
			}
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

		if (isDraft) {
			flashMessage.success(
				t(messages && messages.success ? messages.success : 'usersModule.messages.created', {
					user: user.username,
				})
			);

			return 'added';
		}

		flashMessage.success(
			t(messages && messages.success ? messages.success : 'usersModule.messages.edited', {
				user: user.username,
			})
		);

		return 'saved';
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
