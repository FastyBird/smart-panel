import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

export interface IUseDiscardGuard {
	/** Asks whether to throw away a changed form; true when the answer is yes */
	confirmDiscard: () => Promise<boolean>;
}

export const useDiscardGuard = (): IUseDiscardGuard => {
	const { t } = useI18n();

	const confirmDiscard = async (): Promise<boolean> => {
		try {
			await ElMessageBox.confirm(t('devicesModule.texts.misc.confirmDiscard'), t('devicesModule.headings.misc.discard'), {
				confirmButtonText: t('devicesModule.buttons.yes.title'),
				cancelButtonText: t('devicesModule.buttons.no.title'),
				type: 'warning',
			});

			return true;
		} catch {
			return false;
		}
	};

	return { confirmDiscard };
};
