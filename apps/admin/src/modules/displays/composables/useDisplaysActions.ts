import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import type { IDisplay } from '../store/displays.store.types';
import { displaysStoreKey } from '../store/keys';

import type { IUseDisplaysActions } from './types';

export const useDisplaysActions = (): IUseDisplaysActions => {
	const storesManager = injectStoresManager();

	const displaysStore = storesManager.getStore(displaysStoreKey);

	const { t } = useI18n();
	const flashMessage = useFlashMessage();

	const remove = async (id: IDisplay['id']): Promise<void> => {
		const display = displaysStore?.findById(id);

		if (!display) {
			flashMessage.error(t('displaysModule.messages.notFound'));
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('displaysModule.messages.confirmRemove', { name: display.name || display.macAddress }),
				t('displaysModule.headings.removeDisplay'),
				{
					confirmButtonText: t('displaysModule.buttons.yes.title'),
					cancelButtonText: t('displaysModule.buttons.no.title'),
					type: 'warning',
				}
			);

			await displaysStore.remove({ id });

			flashMessage.success(t('displaysModule.messages.removed'));
		} catch {
			// User cancelled or error occurred
		}
	};

	const bulkRemove = async (displays: IDisplay[]): Promise<void> => {
		if (displays.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('displaysModule.messages.confirmBulkRemove', { count: displays.length }),
				t('displaysModule.headings.removeBulkDisplays'),
				{
					confirmButtonText: t('displaysModule.buttons.yes.title'),
					cancelButtonText: t('displaysModule.buttons.no.title'),
					type: 'warning',
				}
			);
		} catch {
			// User cancelled - do nothing
			return;
		}

		// One request for the whole selection. Sending one per display tripped the
		// backend's shared rate limit once a selection went past thirty, which left
		// the rest of the selection silently unprocessed.
		try {
			const result = await displaysStore.bulkRemove({ ids: displays.map((display) => display.id) });

			if (result.succeeded.length > 0) {
				flashMessage.success(t('displaysModule.messages.bulkRemoved', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('displaysModule.messages.bulkRemoveFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('displaysModule.messages.bulkRemoveFailed', { count: displays.length }));
		}
	};

	return {
		remove,
		bulkRemove,
	};
};
