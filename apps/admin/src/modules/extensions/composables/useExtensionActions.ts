import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ExtensionsApiException } from '../extensions.exceptions';
import type { IExtension } from '../store/extensions.store.types';
import { extensionsStoreKey } from '../store/keys';

interface IUseExtensionActions {
	toggleEnabled: (type: IExtension['type'], enabled: boolean) => Promise<boolean>;
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

			flashMessage.success(
				enabled
					? t('extensionsModule.messages.extensionEnabled')
					: t('extensionsModule.messages.extensionDisabled')
			);

			return true;
		} catch (error: unknown) {
			if (error instanceof ExtensionsApiException) {
				if (error.code === 400) {
					flashMessage.error(t('extensionsModule.messages.coreExtensionError'));
				} else {
					flashMessage.error(t('extensionsModule.messages.updateError'));
				}
			} else {
				flashMessage.error(t('extensionsModule.messages.updateError'));
			}

			return false;
		}
	};

	return {
		toggleEnabled,
	};
};
