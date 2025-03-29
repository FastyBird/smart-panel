import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { type IUser, usersStoreKey } from '../store';
import { UsersApiException, UsersException } from '../users.exceptions';

import type { IUseUsersActions } from './types';

export const useUsersActions = (): IUseUsersActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const usersStore = storesManager.getStore(usersStoreKey);

	const remove = async (id: IUser['id']): Promise<void> => {
		const user = usersStore.findById(id);

		if (user === null) {
			throw new UsersException("Something went wrong, user can't be loaded");
		}

		ElMessageBox.confirm(t('usersModule.messages.confirmRemove', { user: user.username }), t('usersModule.headings.remove'), {
			confirmButtonText: t('usersModule.buttons.yes.title'),
			cancelButtonText: t('usersModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				try {
					await usersStore.remove({ id: user.id });

					flashMessage.success(
						t('usersModule.messages.removed', {
							user: user.username,
						})
					);
				} catch (error: unknown) {
					if (error instanceof UsersApiException && error.code === 404) {
						const errorMessage = t('usersModule.messages.notFound', {
							user: user.username,
						});

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof UsersApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('usersModule.messages.notRemoved', {
								user: user.username,
							});

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(
					t('usersModule.messages.removeCanceled', {
						user: user.username,
					})
				);
			});
	};

	return {
		remove,
	};
};
