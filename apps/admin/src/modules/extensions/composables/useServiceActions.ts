import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { ExtensionsApiException } from '../extensions.exceptions';
import { servicesStoreKey } from '../store/keys';

interface IUseServiceActions {
	startService: (pluginName: string, serviceId: string) => Promise<boolean>;
	stopService: (pluginName: string, serviceId: string) => Promise<boolean>;
	restartService: (pluginName: string, serviceId: string) => Promise<boolean>;
	isActing: (pluginName: string, serviceId: string) => boolean;
}

export const useServiceActions = (): IUseServiceActions => {
	const { t } = useI18n();

	const storesManager = injectStoresManager();
	const flashMessage = useFlashMessage();

	const servicesStore = storesManager.getStore(servicesStoreKey);

	const startService = async (pluginName: string, serviceId: string): Promise<boolean> => {
		try {
			await servicesStore.start({ pluginName, serviceId });

			flashMessage.success(t('extensionsModule.services.messages.started'));

			return true;
		} catch (error: unknown) {
			if (error instanceof ExtensionsApiException) {
				flashMessage.error(t('extensionsModule.services.messages.startError'));
			} else {
				flashMessage.error(t('extensionsModule.services.messages.startError'));
			}

			return false;
		}
	};

	const stopService = async (pluginName: string, serviceId: string): Promise<boolean> => {
		try {
			await servicesStore.stop({ pluginName, serviceId });

			flashMessage.success(t('extensionsModule.services.messages.stopped'));

			return true;
		} catch (error: unknown) {
			if (error instanceof ExtensionsApiException) {
				flashMessage.error(t('extensionsModule.services.messages.stopError'));
			} else {
				flashMessage.error(t('extensionsModule.services.messages.stopError'));
			}

			return false;
		}
	};

	const restartService = async (pluginName: string, serviceId: string): Promise<boolean> => {
		try {
			await servicesStore.restart({ pluginName, serviceId });

			flashMessage.success(t('extensionsModule.services.messages.restarted'));

			return true;
		} catch (error: unknown) {
			if (error instanceof ExtensionsApiException) {
				flashMessage.error(t('extensionsModule.services.messages.restartError'));
			} else {
				flashMessage.error(t('extensionsModule.services.messages.restartError'));
			}

			return false;
		}
	};

	const isActing = (pluginName: string, serviceId: string): boolean => {
		return servicesStore.acting(pluginName, serviceId);
	};

	return {
		startService,
		stopService,
		restartService,
		isActing,
	};
};
