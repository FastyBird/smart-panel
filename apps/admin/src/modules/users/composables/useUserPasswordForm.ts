import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { FormInstance } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { usersStoreKey } from '../store/keys';
import type { IUser } from '../store/users.store.types';
import { FormResult, type FormResultType } from '../users.constants';
import { UsersApiException, UsersValidationException } from '../users.exceptions';

import type { IUseUserPasswordForm, IUserPasswordForm } from './types';

interface IUseUserPasswordFormProps {
	user: IUser;
	messages?: { success?: string; error?: string };
}

export const useUserPasswordForm = ({ user, messages }: IUseUserPasswordFormProps): IUseUserPasswordForm => {
	const storesManager = injectStoresManager();

	const usersStore = storesManager.getStore(usersStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const formResult = ref<FormResultType>(FormResult.NONE);

	let timer: number;

	const model = reactive<IUserPasswordForm>({
		password: '',
		repeatPassword: '',
	});

	const formEl = ref<FormInstance | undefined>(undefined);

	const formChanged = ref<boolean>(false);

	const submit = async (): Promise<'saved'> => {
		formResult.value = FormResult.WORKING;

		const errorMessage = messages && messages.error ? messages.error : t('usersModule.messages.notEdited', { user: user.username });

		formEl.value!.clearValidate();

		const valid = await formEl.value!.validate();

		if (!valid) throw new UsersValidationException('Form not valid');

		try {
			await usersStore.edit({
				id: user.id,
				data: {
					password: model.password,
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

	watch(model, (val: IUserPasswordForm): void => {
		if (val.password !== '') {
			formChanged.value = true;
		} else if (val.repeatPassword !== '') {
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
