import { ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { injectStoresManager } from '../../../common';
import { weatherLocationsStoreKey } from '../store/keys';
import type { IWeatherLocation } from '../store/locations.store.types';

import type { IUseWeatherLocationsActions } from './types';

export const useLocationsActions = (): IUseWeatherLocationsActions => {
	const { t } = useI18n();

	const storesManager = injectStoresManager();

	const locationsStore = storesManager.getStore(weatherLocationsStoreKey);

	const remove = async (id: IWeatherLocation['id']): Promise<void> => {
		const location = locationsStore.findById(id);

		if (!location) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('weatherModule.messages.confirmDeleteLocation', { name: location.name }),
				t('weatherModule.headings.deleteLocation'),
				{
					confirmButtonText: t('weatherModule.buttons.yes'),
					cancelButtonText: t('weatherModule.buttons.no'),
					type: 'warning',
				}
			);

			await locationsStore.remove({ id });
		} catch {
			// User cancelled
		}
	};

	return {
		remove,
	};
};
