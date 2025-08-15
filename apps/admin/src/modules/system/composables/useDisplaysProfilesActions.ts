import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import { displaysStoreKey } from '../store/keys';
import { SystemApiException, SystemException } from '../system.exceptions';

import type { IUseDisplaysProfilesActions } from './types';

export const useDisplaysProfilesActions = (): IUseDisplaysProfilesActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const remove = async (id: IDisplayProfile['id']): Promise<void> => {
		const display = displaysStore.findById(id);

		if (display === null) {
			throw new SystemException("Something went wrong, display profile can't be loaded");
		}

		ElMessageBox.confirm(
			t('systemModule.texts.displaysProfiles.confirmRemove', { display: display.uid.slice(0, 8) }),
			t('systemModule.headings.displaysProfiles.remove'),
			{
				confirmButtonText: t('systemModule.buttons.yes.title'),
				cancelButtonText: t('systemModule.buttons.no.title'),
				type: 'warning',
			}
		)
			.then(async (): Promise<void> => {
				try {
					await displaysStore.remove({ id: display.id });

					flashMessage.success(
						t('systemModule.messages.displaysProfiles.removed', {
							display: display.uid,
						})
					);
				} catch (error: unknown) {
					if (error instanceof SystemApiException && error.code === 404) {
						const errorMessage = t('systemModule.messages.displaysProfiles.notFound', { display: display.uid.slice(0, 8) });

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof SystemApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('systemModule.messages.displaysProfiles.notRemoved', { display: display.uid.slice(0, 8) });

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(t('systemModule.messages.displaysProfiles.removeCanceled', { display: display.uid.slice(0, 8) }));
			});
	};

	return {
		remove,
	};
};
