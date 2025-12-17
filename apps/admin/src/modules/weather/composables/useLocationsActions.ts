import { ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { weatherLocationsStoreKey } from '../store/keys';
import type { IWeatherLocation } from '../store/locations.store.types';

import type { IUseWeatherLocationsActions } from './types';

export const useLocationsActions = (): IUseWeatherLocationsActions => {
	const { t } = useI18n();
	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const locationsStore = storesManager.getStore(weatherLocationsStoreKey);

	const remove = async (id: IWeatherLocation['id']): Promise<void> => {
		const location = locationsStore.findById(id);

		if (!location) {
			return;
		}

		ElMessageBox.confirm(
			t('weatherModule.messages.locations.confirmDeleteLocation', { name: location.name }),
			t('weatherModule.headings.deleteLocation'),
			{
				confirmButtonText: t('weatherModule.buttons.yes.title'),
				cancelButtonText: t('weatherModule.buttons.no.title'),
				type: 'warning',
			}
		)
			.then(async (): Promise<void> => {
				try {
					await locationsStore.remove({ id });

					flashMessage.success(t('weatherModule.messages.locations.deleted'));
				} catch {
					flashMessage.error(t('weatherModule.messages.locations.notDeleted'));
				}
			})
			.catch((): void => {
				flashMessage.info(
					t('weatherModule.messages.locations.deleteCanceled', {
						location: location.name,
					})
				);
			});
	};

	return {
		remove,
	};
};
