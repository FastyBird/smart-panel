import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { scenesStoreKey } from '../store/keys';
import type { IScene, IScenesAddActionPayload, IScenesEditActionPayload } from '../store/scenes.store.types';

interface IUseScenesActions {
	addScene: (payload: IScenesAddActionPayload) => Promise<IScene>;
	editScene: (payload: IScenesEditActionPayload) => Promise<IScene>;
	removeScene: (id: IScene['id']) => Promise<void>;
	bulkRemove: (scenes: IScene[]) => Promise<void>;
	bulkEnable: (scenes: IScene[]) => Promise<void>;
	bulkDisable: (scenes: IScene[]) => Promise<void>;
}

export const useScenesActions = (): IUseScenesActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();
	const scenesStore = storesManager.getStore(scenesStoreKey);

	const addScene = async (payload: IScenesAddActionPayload): Promise<IScene> => {
		return scenesStore.add(payload);
	};

	const editScene = async (payload: IScenesEditActionPayload): Promise<IScene> => {
		return scenesStore.edit(payload);
	};

	const removeScene = async (id: IScene['id']): Promise<void> => {
		await scenesStore.remove({ id });
	};

	const bulkRemove = async (scenes: IScene[]): Promise<void> => {
		if (scenes.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('scenes.texts.confirmBulkRemove', { count: scenes.length }),
				t('scenes.headings.bulkRemove'),
				{
					confirmButtonText: t('scenes.buttons.yes.title'),
					cancelButtonText: t('scenes.buttons.no.title'),
					type: 'warning',
				}
			);

		} catch {
			// User cancelled - do nothing
			return;
		}

		// One request for the whole selection. Sending one per scene tripped the
		// backend's shared rate limit once a selection went past thirty, which left
		// the rest of the selection silently unprocessed.
		try {
			const result = await scenesStore.bulkRemove({ ids: scenes.map((scene) => scene.id) });

			if (result.succeeded.length > 0) {
				flashMessage.success(t('scenes.messages.bulkRemoved', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('scenes.messages.bulkRemoveFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('scenes.messages.bulkRemoveFailed', { count: scenes.length }));
		}
	};

	const bulkEnable = async (scenes: IScene[]): Promise<void> => {
		if (scenes.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('scenes.texts.confirmBulkEnable', { count: scenes.length }),
				t('scenes.headings.bulkEnable'),
				{
					confirmButtonText: t('scenes.buttons.yes.title'),
					cancelButtonText: t('scenes.buttons.no.title'),
					type: 'info',
				}
			);

		} catch {
			flashMessage.info(t('scenes.messages.bulkEnableCanceled'));

			return;
		}

		// See bulkRemove: one request for the whole selection.
		try {
			const result = await scenesStore.bulkSetEnabled({ ids: scenes.map((scene) => scene.id), enabled: true });

			if (result.succeeded.length > 0) {
				flashMessage.success(t('scenes.messages.bulkEnabled', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('scenes.messages.bulkEnableFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('scenes.messages.bulkEnableFailed', { count: scenes.length }));
		}
	};

	const bulkDisable = async (scenes: IScene[]): Promise<void> => {
		if (scenes.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('scenes.texts.confirmBulkDisable', { count: scenes.length }),
				t('scenes.headings.bulkDisable'),
				{
					confirmButtonText: t('scenes.buttons.yes.title'),
					cancelButtonText: t('scenes.buttons.no.title'),
					type: 'warning',
				}
			);

		} catch {
			flashMessage.info(t('scenes.messages.bulkDisableCanceled'));

			return;
		}

		// See bulkRemove: one request for the whole selection.
		try {
			const result = await scenesStore.bulkSetEnabled({ ids: scenes.map((scene) => scene.id), enabled: false });

			if (result.succeeded.length > 0) {
				flashMessage.success(t('scenes.messages.bulkDisabled', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('scenes.messages.bulkDisableFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('scenes.messages.bulkDisableFailed', { count: scenes.length }));
		}
	};

	return {
		addScene,
		editScene,
		removeScene,
		bulkRemove,
		bulkEnable,
		bulkDisable,
	};
};
