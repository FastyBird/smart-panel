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

	const add = async (payload: {
		id: IWeatherLocation['id'];
		draft: boolean;
		data: { name: string; type: string } & Record<string, unknown>;
	}): Promise<IWeatherLocation> => {
		return locationsStore.add(payload);
	};

	const edit = async (payload: {
		id: IWeatherLocation['id'];
		data: { type: string; name?: string } & Record<string, unknown>;
	}): Promise<IWeatherLocation> => {
		return locationsStore.edit(payload);
	};

	const remove = async (id: IWeatherLocation['id']): Promise<void> => {
		const location = locationsStore.findById(id);

		if (!location) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('weatherModule.messages.locations.confirmDeleteLocation', { name: location.name }),
				t('weatherModule.headings.deleteLocation'),
				{
					confirmButtonText: t('weatherModule.buttons.yes.title'),
					cancelButtonText: t('weatherModule.buttons.no.title'),
					type: 'warning',
				}
			);

			try {
				await locationsStore.remove({ id });

				flashMessage.success(t('weatherModule.messages.locations.deleted'));
			} catch {
				flashMessage.error(t('weatherModule.messages.locations.notDeleted'));
			}
		} catch {
			flashMessage.info(
				t('weatherModule.messages.locations.deleteCanceled', {
					location: location.name,
				})
			);
		}
	};

	const bulkRemove = async (locations: IWeatherLocation[]): Promise<void> => {
		if (locations.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('weatherModule.messages.locations.confirmBulkDelete', { count: locations.length }),
				t('weatherModule.headings.bulkDeleteLocations'),
				{
					confirmButtonText: t('weatherModule.buttons.yes.title'),
					cancelButtonText: t('weatherModule.buttons.no.title'),
					type: 'warning',
				}
			);

			let successCount = 0;
			let failCount = 0;

			for (const location of locations) {
				try {
					await locationsStore.remove({ id: location.id });
					successCount++;
				} catch {
					failCount++;
				}
			}

			if (successCount > 0) {
				flashMessage.success(t('weatherModule.messages.locations.bulkDeleted', { count: successCount }));
			}

			if (failCount > 0) {
				flashMessage.error(t('weatherModule.messages.locations.bulkDeleteFailed', { count: failCount }));
			}
		} catch {
			flashMessage.info(t('weatherModule.messages.locations.bulkDeleteCanceled'));
		}
	};

	return {
		add,
		edit,
		remove,
		bulkRemove,
	};
};
