import { useI18n } from 'vue-i18n';

import { injectStoresManager, useFlashMessage } from '../../../common';
import type { IAutomation } from '../store/automations.store.types';
import { automationTransferStoreKey } from '../store/keys';

import type { IUseAutomationExport } from './types';

/** Offers a text as a file to save; the object URL is let go a moment later, once the browser has taken it */
export const downloadTextFile = (content: string, fileName: string, contentType: string): void => {
	const blob = new Blob([content], { type: contentType });
	const objectUrl = URL.createObjectURL(blob);

	const link = document.createElement('a');

	link.href = objectUrl;
	link.download = fileName;
	link.click();

	setTimeout((): void => URL.revokeObjectURL(objectUrl), 2_000);
};

/**
 * An automation as a YAML file, for sharing or backup. The backend writes the document: it is the stored automation,
 * so changes not saved yet are not in it.
 */
export const useAutomationExport = (): IUseAutomationExport => {
	const storesManager = injectStoresManager();

	const transferStore = storesManager.getStore(automationTransferStoreKey);

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const exporting = (id: IAutomation['id']): boolean => transferStore.exporting(id);

	const fetchYaml = async (id: IAutomation['id']): Promise<string | null> => {
		try {
			return (await transferStore.exportYaml({ id })).content;
		} catch {
			return null;
		}
	};

	const exportAutomation = async (id: IAutomation['id']): Promise<boolean> => {
		try {
			const exported = await transferStore.exportYaml({ id });

			downloadTextFile(exported.content, exported.fileName, exported.contentType);

			return true;
		} catch {
			flashMessage.error(t('automations.transfer.messages.exportFailed'));

			return false;
		}
	};

	return {
		exporting,
		fetchYaml,
		exportAutomation,
	};
};
