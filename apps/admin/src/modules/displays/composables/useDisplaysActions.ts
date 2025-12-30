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

			await displaysStore?.remove({ id });

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
				t('displaysModule.headings.bulkRemoveDisplay'),
				{
					confirmButtonText: t('displaysModule.buttons.yes.title'),
					cancelButtonText: t('displaysModule.buttons.no.title'),
					type: 'warning',
				}
			);

			let successCount = 0;
			let failCount = 0;

			for (const display of displays) {
				try {
					await displaysStore?.remove({ id: display.id });
					successCount++;
				} catch {
					failCount++;
				}
			}

			if (successCount > 0) {
				flashMessage.success(t('displaysModule.messages.bulkRemoved', { count: successCount }));
			}

			if (failCount > 0) {
				flashMessage.error(t('displaysModule.messages.bulkRemoveFailed', { count: failCount }));
			}
		} catch {
			flashMessage.info(t('displaysModule.messages.bulkRemoveCanceled'));
		}
	};

	return {
		remove,
		bulkRemove,
	};
};
