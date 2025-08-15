import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import type { IDisplayInstance } from '../store/displays-instances.store.types';
import { displaysInstancesStoreKey } from '../store/keys';
import { UsersApiException, UsersException } from '../users.exceptions';

import type { IUseDisplaysInstancesActions } from './types';

export const useDisplaysInstancesActions = (): IUseDisplaysInstancesActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysInstancesStoreKey);

	const remove = async (id: IDisplayInstance['id']): Promise<void> => {
		const display = displaysStore.findById(id);

		if (display === null) {
			throw new UsersException("Something went wrong, display can't be loaded");
		}

		ElMessageBox.confirm(t('usersModule.texts.confirmRemove', { display: display.uid }), t('usersModule.headings.remove'), {
			confirmButtonText: t('usersModule.buttons.yes.title'),
			cancelButtonText: t('usersModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				try {
					await displaysStore.remove({ id: display.id });

					flashMessage.success(
						t('usersModule.messages.removed', {
							display: display.uid,
						})
					);
				} catch (error: unknown) {
					if (error instanceof UsersApiException && error.code === 404) {
						const errorMessage = t('usersModule.messages.notFound', {
							display: display.uid,
						});

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof UsersApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('usersModule.messages.notRemoved', {
								display: display.uid,
							});

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(
					t('usersModule.messages.removeCanceled', {
						display: display.uid,
					})
				);
			});
	};

	return {
		remove,
	};
};
