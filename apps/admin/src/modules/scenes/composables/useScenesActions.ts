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

			let successCount = 0;
			let failCount = 0;

			for (const scene of scenes) {
				try {
					await scenesStore.remove({ id: scene.id });
					successCount++;
				} catch {
					failCount++;
				}
			}

			if (successCount > 0) {
				flashMessage.success(t('scenes.messages.bulkRemoved', { count: successCount }));
			}

			if (failCount > 0) {
				flashMessage.error(t('scenes.messages.bulkRemoveFailed', { count: failCount }));
			}
		} catch {
			// User cancelled - do nothing
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

			let successCount = 0;
			let failCount = 0;

			for (const scene of scenes) {
				try {
					await scenesStore.edit({
						id: scene.id,
						data: {
							enabled: true,
						},
					});
					successCount++;
				} catch {
					failCount++;
				}
			}

			if (successCount > 0) {
				flashMessage.success(t('scenes.messages.bulkEnabled', { count: successCount }));
			}

			if (failCount > 0) {
				flashMessage.error(t('scenes.messages.bulkEnableFailed', { count: failCount }));
			}
		} catch {
			flashMessage.info(t('scenes.messages.bulkEnableCanceled'));
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

			let successCount = 0;
			let failCount = 0;

			for (const scene of scenes) {
				try {
					await scenesStore.edit({
						id: scene.id,
						data: {
							enabled: false,
						},
					});
					successCount++;
				} catch {
					failCount++;
				}
			}

			if (successCount > 0) {
				flashMessage.success(t('scenes.messages.bulkDisabled', { count: successCount }));
			}

			if (failCount > 0) {
				flashMessage.error(t('scenes.messages.bulkDisableFailed', { count: failCount }));
			}
		} catch {
			flashMessage.info(t('scenes.messages.bulkDisableCanceled'));
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
