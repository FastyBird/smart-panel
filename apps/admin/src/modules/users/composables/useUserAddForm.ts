import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { UsersUserRole } from '../../../openapi';
import { type IUser, usersStoreKey } from '../store';
import { FormResult, type FormResultType } from '../users.constants';
import { UsersApiException, UsersValidationException } from '../users.exceptions';

import type { IUseUserAddForm, IUserAddForm } from './types';

interface IUseUserAddFormProps {
	id: IUser['id'];
}

export const useUserAddForm = ({ id }: IUseUserAddFormProps): IUseUserAddForm => {
	const storesManager = injectStoresManager();

	const usersStore = storesManager.getStore(usersStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<IUserAddForm>({
		username: '',
		password: '',
		repeatPassword: '',
		email: '',
		firstName: '',
		lastName: '',
		role: UsersUserRole.user,
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'added'> => {
		formResult.value = FormResult.WORKING;

		const errorMessage = t('usersModule.messages.notCreated', { user: model.username });

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new UsersValidationException('Form not valid');

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

	watch(model, (val: IUserAddForm): void => {
		if (val.username !== '') {
			formChanged.value = true;
		} else if (val.password !== '') {
			formChanged.value = true;
		} else if (val.email !== '') {
			formChanged.value = true;
		} else if (val.firstName !== '') {
			formChanged.value = true;
		} else if (val.lastName !== '') {
			formChanged.value = true;
		} else if (val.role !== UsersUserRole.user) {
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
