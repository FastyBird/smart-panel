import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DashboardApiException, DashboardException } from '../dashboard.exceptions';
import type { ICard } from '../store/cards.store.types';
import { tilesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';
import type { ITile, TileParentTypeMap } from '../store/tiles.store.types';

import type { IUseTilesActions } from './types';

interface IUsePageTilesActionsProps {
	parent: 'page';
	pageId: IPage['id'];
}

interface IUseCardTilesActionsProps {
	parent: 'card';
	pageId: IPage['id'];
	cardId: ICard['id'];
}

type IUseTilesActionsProps = IUsePageTilesActionsProps | IUseCardTilesActionsProps;

export const useTilesActions = <T extends keyof TileParentTypeMap>(props: IUseTilesActionsProps & { parent: T }): IUseTilesActions => {
	const is = {
		page: (p: IUseTilesActionsProps): p is IUsePageTilesActionsProps => p.parent === 'page',
		card: (p: IUseTilesActionsProps): p is IUseCardTilesActionsProps => p.parent === 'card',
	};

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const tilesStore = storesManager.getStore(tilesStoreKey);

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
					if (is.card(props)) {
						await tilesStore.remove({ parent: props.parent, id: tile.id, pageId: props.pageId, cardId: props.cardId });
					} else {
						await tilesStore.remove({ parent: props.parent, id: tile.id, pageId: props.pageId });
					}

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
		remove,
	};
};
