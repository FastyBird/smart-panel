import { ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ExtensionsApiException } from '../extensions.exceptions';
import type { IExtension } from '../store/extensions.store.types';
import { extensionsStoreKey } from '../store/keys';

interface IUseExtensionActions {
	toggleEnabled: (type: IExtension['type'], enabled: boolean) => Promise<boolean>;
	bulkEnable: (extensions: IExtension[]) => Promise<void>;
	bulkDisable: (extensions: IExtension[]) => Promise<void>;
}

export const useExtensionActions = (): IUseExtensionActions => {
	const { t } = useI18n();

	const storesManager = injectStoresManager();
	const flashMessage = useFlashMessage();

	const extensionsStore = storesManager.getStore(extensionsStoreKey);

	const toggleEnabled = async (type: IExtension['type'], enabled: boolean): Promise<boolean> => {
		try {
			await extensionsStore.update({
				type,
				data: { enabled },
			});

			flashMessage.success(enabled ? t('extensionsModule.messages.extensionEnabled') : t('extensionsModule.messages.extensionDisabled'));

			return true;
		} catch (error: unknown) {
			if (error instanceof ExtensionsApiException) {
				if (error.code === 400) {
					flashMessage.error(t('extensionsModule.messages.notConfigurableError'));
				} else {
					flashMessage.error(t('extensionsModule.messages.updateError'));
				}
			} else {
				flashMessage.error(t('extensionsModule.messages.updateError'));
			}

			return false;
		}
	};

	const bulkEnable = async (extensions: IExtension[]): Promise<void> => {
		// Filter to only extensions that can be toggled and are currently disabled
		const togglableExtensions = extensions.filter((ext) => ext.canToggleEnabled && !ext.enabled);

		if (togglableExtensions.length === 0) {
			flashMessage.info(t('extensionsModule.messages.noExtensionsToEnable'));
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('extensionsModule.messages.confirmBulkEnable', { count: togglableExtensions.length }),
				t('extensionsModule.headings.bulkEnable'),
				{
					confirmButtonText: t('extensionsModule.buttons.yes'),
					cancelButtonText: t('extensionsModule.buttons.no'),
					type: 'info',
				}
			);

			let successCount = 0;
			let failCount = 0;

			for (const extension of togglableExtensions) {
				try {
					await extensionsStore.update({
						type: extension.type,
						data: { enabled: true },
					});
					successCount++;
				} catch {
					failCount++;
				}
			}

			if (successCount > 0) {
				flashMessage.success(t('extensionsModule.messages.bulkEnabled', { count: successCount }));
			}

			if (failCount > 0) {
				flashMessage.error(t('extensionsModule.messages.bulkEnableFailed', { count: failCount }));
			}
		} catch {
			flashMessage.info(t('extensionsModule.messages.bulkEnableCanceled'));
		}
	};

	const bulkDisable = async (extensions: IExtension[]): Promise<void> => {
		// Filter to only extensions that can be toggled and are currently enabled
		const togglableExtensions = extensions.filter((ext) => ext.canToggleEnabled && ext.enabled);

		if (togglableExtensions.length === 0) {
			flashMessage.info(t('extensionsModule.messages.noExtensionsToDisable'));
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('extensionsModule.messages.confirmBulkDisable', { count: togglableExtensions.length }),
				t('extensionsModule.headings.bulkDisable'),
				{
					confirmButtonText: t('extensionsModule.buttons.yes'),
					cancelButtonText: t('extensionsModule.buttons.no'),
					type: 'warning',
				}
			);

			let successCount = 0;
			let failCount = 0;

			for (const extension of togglableExtensions) {
				try {
					await extensionsStore.update({
						type: extension.type,
						data: { enabled: false },
					});
					successCount++;
				} catch {
					failCount++;
				}
			}

			if (successCount > 0) {
				flashMessage.success(t('extensionsModule.messages.bulkDisabled', { count: successCount }));
			}

			if (failCount > 0) {
				flashMessage.error(t('extensionsModule.messages.bulkDisableFailed', { count: failCount }));
			}
		} catch {
			flashMessage.info(t('extensionsModule.messages.bulkDisableCanceled'));
		}
	};

	return {
		toggleEnabled,
		bulkEnable,
		bulkDisable,
	};
};
