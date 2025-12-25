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

		try {
			await ElMessageBox.confirm(
				t('spacesModule.messages.confirmRemove', { name: space.name }),
				t('spacesModule.headings.removeSpace'),
				{
					confirmButtonText: t('spacesModule.buttons.yes.title'),
					cancelButtonText: t('spacesModule.buttons.no.title'),
					type: 'warning',
				}
			);

			await spacesStore.remove({ id });

			flashMessage.success(t('spacesModule.messages.removed'));

			return true;
		} catch (error: unknown) {
			if (error instanceof SpacesApiException) {
				flashMessage.error(error.message);
			}

			return false;
		}
	};

	return {
		remove,
	};
};
