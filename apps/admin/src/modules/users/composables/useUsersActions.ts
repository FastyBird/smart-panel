import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { usersStoreKey } from '../store/keys';
import type { IUser } from '../store/users.store.types';
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

		ElMessageBox.confirm(t('usersModule.texts.confirmRemove', { user: user.username }), t('usersModule.headings.remove'), {
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

	const bulkRemove = async (users: IUser[]): Promise<void> => {
		if (users.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(t('usersModule.texts.confirmBulkRemove', { count: users.length }), t('usersModule.headings.removeBulk'), {
				confirmButtonText: t('usersModule.buttons.yes.title'),
				cancelButtonText: t('usersModule.buttons.no.title'),
				type: 'warning',
			});
		} catch {
			// User cancelled - do nothing
			return;
		}

		// One request for the whole selection. Sending one per user tripped the
		// backend's shared rate limit once a selection went past thirty, which left
		// the rest of the selection silently unprocessed.
		try {
			const result = await usersStore.bulkRemove({ ids: users.map((user) => user.id) });

			if (result.succeeded.length > 0) {
				flashMessage.success(t('usersModule.messages.bulkRemoved', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('usersModule.messages.bulkRemoveFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('usersModule.messages.bulkRemoveFailed', { count: users.length }));
		}
	};

	return {
		remove,
		bulkRemove,
	};
};
