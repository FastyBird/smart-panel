import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { type IUser, usersStoreKey } from '../store';
import { FormResult, type FormResultType } from '../users.constants';
import { UsersApiException, UsersValidationException } from '../users.exceptions';

import type { IUseUserEditForm, IUserEditForm } from './types';

export const useUserEditForm = (user: IUser, messages?: { success?: string; error?: string }): IUseUserEditForm => {
	const storesManager = injectStoresManager();

	const usersStore = storesManager.getStore(usersStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<IUserEditForm>({
		username: user.username,
		password: 'secretpassword',
		email: user.email || '',
		firstName: user.firstName || '',
		lastName: user.lastName || '',
		role: user.role,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added' | 'saved'> => {
		formResult.value = FormResult.WORKING;

		const isDraft = user.draft;

		const errorMessage =
			messages && messages.error
				? messages.error
				: user.draft
					? t('usersModule.messages.notCreated', { user: user.username })
					: t('usersModule.messages.notEdited', { user: user.username });

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new UsersValidationException('Form not valid');

		try {
			await usersStore.edit({
				id: user.id,
				data: {
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

	watch(model, (val: IUserEditForm): void => {
		if (val.email !== user.email) {
			formChanged.value = true;
		} else if (val.firstName !== user.firstName) {
			formChanged.value = true;
		} else if (val.lastName !== user.lastName) {
			formChanged.value = true;
		} else if (val.role !== user.role) {
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
