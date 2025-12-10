import { inject } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { useFlashMessage } from '../../../common';
import type { IDisplay } from '../store/displays.store.types';
import { displaysStoreKey } from '../store/keys';

import type { IUseDisplaysActions } from './types';

export const useDisplaysActions = (): IUseDisplaysActions => {
	const displaysStore = inject(displaysStoreKey);

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

	return {
		remove,
	};
};
