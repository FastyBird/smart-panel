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
		} catch {
			// User cancelled - do nothing
			return;
		}

		// One request for the whole selection. Sending one per space tripped the backend's shared rate
		// limit once a selection went past thirty, which left the rest of the selection silently
		// unprocessed.
		try {
			const result = await spacesStore.bulkRemove({ ids: spaces.map((space) => space.id) });

			if (result.succeeded.length > 0) {
				flashMessage.success(t('spacesModule.messages.bulkRemoved', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('spacesModule.messages.bulkRemoveFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('spacesModule.messages.bulkRemoveFailed', { count: spaces.length }));
		}
	};

	return {
		remove,
		bulkRemove,
	};
};
