import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { SpacesApiException } from '../spaces.exceptions';
import type { ISpace } from '../store/spaces.store.types';
import { spacesStoreKey } from '../store/keys';

import type { IUseSpacesActions } from './types';

export const useSpacesActions = (): IUseSpacesActions => {
	const { t } = useI18n();
	const flashMessage = useFlashMessage();
	const storesManager = injectStoresManager();

	const spacesStore = storesManager.getStore(spacesStoreKey);

	const remove = async (id: ISpace['id']): Promise<boolean> => {
		const space = spacesStore.findById(id);

		if (!space) {
			flashMessage.error(t('spacesModule.messages.notFound'));
			return false;
		}

		return ElMessageBox.confirm(
			t('spacesModule.messages.confirmRemove', { name: space.name }),
			t('spacesModule.headings.removeSpace'),
			{
				confirmButtonText: t('spacesModule.buttons.yes.title'),
				cancelButtonText: t('spacesModule.buttons.no.title'),
				type: 'warning',
			}
		)
			.then(async (): Promise<boolean> => {
				try {
					await spacesStore.remove({ id });

					flashMessage.success(t('spacesModule.messages.removed', { space: space.name }));

					return true;
				} catch (error: unknown) {
					if (error instanceof SpacesApiException) {
						flashMessage.error(error.message);
					}

					return false;
				}
			})
			.catch((): boolean => {
				flashMessage.info(
					t('spacesModule.messages.removeCanceled', {
						space: space.name,
					})
				);

				return false;
			});
	};

	const bulkRemove = async (spaces: ISpace[]): Promise<void> => {
		if (spaces.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('spacesModule.messages.confirmBulkRemove', { count: spaces.length }),
				t('spacesModule.headings.bulkRemoveSpace'),
				{
					confirmButtonText: t('spacesModule.buttons.yes.title'),
					cancelButtonText: t('spacesModule.buttons.no.title'),
					type: 'warning',
				}
			);

			let successCount = 0;
			let failCount = 0;

			for (const space of spaces) {
				try {
					await spacesStore.remove({ id: space.id });
					successCount++;
				} catch {
					failCount++;
				}
			}

			if (successCount > 0) {
				flashMessage.success(t('spacesModule.messages.bulkRemoved', { count: successCount }));
			}

			if (failCount > 0) {
				flashMessage.error(t('spacesModule.messages.bulkRemoveFailed', { count: failCount }));
			}
		} catch {
			// User cancelled - do nothing
		}
	};

	return {
		remove,
		bulkRemove,
	};
};
