import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DashboardApiException, DashboardException } from '../dashboard.exceptions';
import { tilesStoreKey } from '../store/keys';
import type { ITile } from '../store/tiles.store.types';

import type { IUseTilesActions } from './types';

interface IUseTilesActionsProps {
	parent: string;
	parentId: string;
}

export const useTilesActions = (props: IUseTilesActionsProps): IUseTilesActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const tilesStore = storesManager.getStore(tilesStoreKey);

	const findById = (parent: string, id: ITile['id']): ITile | null => {
		return tilesStore.findById(parent, id);
	};

	const edit = async (payload: {
		id: ITile['id'];
		parent: { type: string; id: string };
		data: { type: string } & Record<string, unknown>;
	}): Promise<ITile> => {
		return tilesStore.edit(payload);
	};

	const save = async (payload: { id: ITile['id']; parent: { type: string; id: string } }): Promise<ITile> => {
		return tilesStore.save(payload);
	};

	const removeDirectly = async (payload: { id: ITile['id']; parent: { type: string; id: string } }): Promise<boolean> => {
		return tilesStore.remove(payload);
	};

	const remove = async (id: ITile['id']): Promise<void> => {
		const tile = tilesStore.findById(props.parent, id);

		if (tile === null) {
			throw new DashboardException("Something went wrong, tile can't be loaded");
		}

		ElMessageBox.confirm(t('dashboardModule.texts.tiles.confirmRemove'), t('dashboardModule.headings.tiles.remove'), {
			confirmButtonText: t('dashboardModule.buttons.yes.title'),
			cancelButtonText: t('dashboardModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				try {
					await tilesStore.remove({ id: tile.id, parent: { type: props.parent, id: props.parentId } });

					flashMessage.success(t('dashboardModule.messages.tiles.removed'));
				} catch (error: unknown) {
					if (error instanceof DashboardApiException && error.code === 404) {
						const errorMessage = t('dashboardModule.messages.tiles.notFound');

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof DashboardApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('dashboardModule.messages.tiles.notRemoved');

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(t('dashboardModule.messages.tiles.removeCanceled'));
			});
	};

	return {
		findById,
		edit,
		save,
		remove,
		removeDirectly,
	};
};
