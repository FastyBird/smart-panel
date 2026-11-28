import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

export interface IUseConfigDiscard {
	/** Asks before unsaved settings are dropped; resolves true when they may go */
	confirmDiscard: () => Promise<boolean>;
}

export const useConfigDiscard = (): IUseConfigDiscard => {
	const { t } = useI18n();

	const confirmDiscard = async (): Promise<boolean> => {
		try {
			await ElMessageBox.confirm(t('configModule.texts.misc.confirmDiscard'), t('configModule.headings.misc.discard'), {
				confirmButtonText: t('configModule.buttons.discard.title'),
				cancelButtonText: t('configModule.buttons.keepEditing.title'),
				type: 'warning',
			});

			return true;
		} catch {
			return false;
		}
	};

	return { confirmDiscard };
};
