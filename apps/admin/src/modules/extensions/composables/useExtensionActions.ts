import { ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ExtensionsApiException } from '../extensions.exceptions';
import type { IExtension } from '../store/extensions.store.types';
import { extensionsStoreKey, servicesStoreKey } from '../store/keys';

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
	const servicesStore = storesManager.getStore(servicesStoreKey);

	const toggleEnabled = async (type: IExtension['type'], enabled: boolean): Promise<boolean> => {
		try {
			await extensionsStore.update({
				type,
				data: { enabled },
			});

			flashMessage.success(enabled ? t('extensionsModule.messages.extensionEnabled') : t('extensionsModule.messages.extensionDisabled'));

			// After enabling, re-fetch services to check for startup errors
			if (enabled) {
				setTimeout(() => {
					void servicesStore
						.fetch()
						.then(() => {
							const services = servicesStore.findAll().filter((s) => s.pluginName === type);

							for (const service of services) {
								if (service.lastError) {
									flashMessage.warning(service.lastError);
								}
							}
						})
						.catch(() => {
							// Silently ignore — this is a best-effort check for startup errors
						});
				}, 1500);
			}

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
		} catch {
			flashMessage.info(t('extensionsModule.messages.bulkEnableCanceled'));

			return;
		}

		// One request for the whole selection. Sending one per extension tripped the
		// backend's shared rate limit once a selection went past thirty, which left
		// the rest of the selection silently unprocessed.
		try {
			const result = await extensionsStore.bulkSetEnabled({
				types: togglableExtensions.map((extension) => extension.type),
				enabled: true,
			});

			if (result.succeeded.length > 0) {
				flashMessage.success(t('extensionsModule.messages.bulkEnabled', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('extensionsModule.messages.bulkEnableFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('extensionsModule.messages.bulkEnableFailed', { count: togglableExtensions.length }));
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
		} catch {
			flashMessage.info(t('extensionsModule.messages.bulkDisableCanceled'));

			return;
		}

		// One request for the whole selection. Sending one per extension tripped the
		// backend's shared rate limit once a selection went past thirty, which left
		// the rest of the selection silently unprocessed.
		try {
			const result = await extensionsStore.bulkSetEnabled({
				types: togglableExtensions.map((extension) => extension.type),
				enabled: false,
			});

			if (result.succeeded.length > 0) {
				flashMessage.success(t('extensionsModule.messages.bulkDisabled', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('extensionsModule.messages.bulkDisableFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('extensionsModule.messages.bulkDisableFailed', { count: togglableExtensions.length }));
		}
	};

	return {
		toggleEnabled,
		bulkEnable,
		bulkDisable,
	};
};
