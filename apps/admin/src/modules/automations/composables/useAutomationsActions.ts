import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { storeToRefs } from 'pinia';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import {
	AutomationsApiException,
	AutomationsException,
	AutomationsGraphInvalidException,
	AutomationsRevisionConflictException,
} from '../automations.exceptions';
import type { IAutomation } from '../store/automations.store.types';
import { automationsStoreKey } from '../store/keys';

import type { IUseAutomationsActions } from './types';

export const useAutomationsActions = (): IUseAutomationsActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const automationsStore = storesManager.getStore(automationsStoreKey);

	const { semaphore } = storeToRefs(automationsStore);

	const updating = computed<IAutomation['id'][]>((): IAutomation['id'][] => semaphore.value.updating);

	const findOrThrow = (id: IAutomation['id']): IAutomation => {
		const automation = automationsStore.findById(id);

		if (automation === null) {
			throw new AutomationsException("Something went wrong, automation can't be loaded");
		}

		return automation;
	};

	const remove = async (id: IAutomation['id']): Promise<void> => {
		const automation = findOrThrow(id);

		try {
			await ElMessageBox.confirm(t('automations.texts.confirmRemove', { automation: automation.name }), t('automations.headings.remove'), {
				confirmButtonText: t('automations.buttons.yes.title'),
				cancelButtonText: t('automations.buttons.no.title'),
				type: 'warning',
			});
		} catch {
			flashMessage.info(t('automations.messages.removeCanceled', { automation: automation.name }));

			return;
		}

		try {
			await automationsStore.remove({ id: automation.id });

			flashMessage.success(t('automations.messages.removed', { automation: automation.name }));
		} catch (error: unknown) {
			if (error instanceof AutomationsApiException && error.code === 422) {
				flashMessage.error(error.message);
			} else {
				flashMessage.error(t('automations.messages.notRemoved', { automation: automation.name }));
			}
		}
	};

	/**
	 * Enables or disables an automation and tells whether it worked. The two refusals the user can do
	 * something about get their own message: an automation changed elsewhere in the meantime, and one
	 * the backend will not run because its flow is not complete.
	 */
	const setEnabled = async (id: IAutomation['id'], enabled: boolean): Promise<boolean> => {
		const automation = findOrThrow(id);

		try {
			await automationsStore.edit({ id: automation.id, data: { enabled } });
		} catch (error: unknown) {
			if (error instanceof AutomationsRevisionConflictException) {
				flashMessage.warning(t('automations.messages.changedElsewhere', { automation: automation.name }));
			} else if (error instanceof AutomationsGraphInvalidException) {
				flashMessage.error(t('automations.messages.notEnabledIncomplete', { automation: automation.name }));
			} else {
				flashMessage.error(t(enabled ? 'automations.messages.notEnabled' : 'automations.messages.notDisabled', { automation: automation.name }));
			}

			return false;
		}

		flashMessage.success(t(enabled ? 'automations.messages.enabled' : 'automations.messages.disabled', { automation: automation.name }));

		return true;
	};

	return {
		updating,
		remove,
		setEnabled,
	};
};
