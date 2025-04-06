import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DashboardApiException, DashboardException } from '../dashboard.exceptions';
import type { ICard } from '../store/cards.store.types';
import { type DataSourceParentTypeMap, type IDataSource } from '../store/dataSources.store.types';
import { dataSourcesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';
import type { ITile } from '../store/tiles.store.types';

import type { IUseDataSourcesActions } from './types';

interface IUsePageDataSourcesActionsProps {
	parent: 'page';
	pageId: IPage['id'];
}

interface IUseCardDataSourcesActionsProps {
	parent: 'card';
	pageId: IPage['id'];
	cardId: ICard['id'];
}

interface IUseTileDataSourcesActionsProps {
	parent: 'tile';
	pageId: IPage['id'];
	cardId?: ICard['id'];
	tileId: ITile['id'];
}

type IUseDataSourcesActionsProps = IUsePageDataSourcesActionsProps | IUseCardDataSourcesActionsProps | IUseTileDataSourcesActionsProps;

export const useDataSourcesActions = <T extends keyof DataSourceParentTypeMap>(
	props: IUseDataSourcesActionsProps & { parent: T }
): IUseDataSourcesActions => {
	const is = {
		page: (p: IUseDataSourcesActionsProps): p is IUsePageDataSourcesActionsProps => p.parent === 'page',
		card: (p: IUseDataSourcesActionsProps): p is IUseCardDataSourcesActionsProps => p.parent === 'card',
		tile: (p: IUseDataSourcesActionsProps): p is IUseTileDataSourcesActionsProps => p.parent === 'tile',
	};

	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

	const remove = async (id: IDataSource['id']): Promise<void> => {
		const dataSource = dataSourcesStore.findById(props.parent, id);

		if (dataSource === null) {
			throw new DashboardException("Something went wrong, data source can't be loaded");
		}

		ElMessageBox.confirm(t('dashboardModule.texts.dataSources.confirmRemove'), t('dashboardModule.headings.dataSources.remove'), {
			confirmButtonText: t('dashboardModule.buttons.yes.title'),
			cancelButtonText: t('dashboardModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				try {
					if (is.tile(props)) {
						await dataSourcesStore.remove({
							parent: props.parent,
							id: dataSource.id,
							pageId: props.pageId,
							cardId: props.cardId,
							tileId: props.tileId,
						});
					} else if (is.card(props)) {
						await dataSourcesStore.remove({ parent: props.parent, id: dataSource.id, pageId: props.pageId, cardId: props.cardId });
					} else {
						await dataSourcesStore.remove({ parent: props.parent, id: dataSource.id, pageId: props.pageId });
					}

					flashMessage.success(t('dashboardModule.messages.dataSources.removed'));
				} catch (error: unknown) {
					if (error instanceof DashboardApiException && error.code === 404) {
						const errorMessage = t('dashboardModule.messages.dataSources.notFound');

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof DashboardApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('dashboardModule.messages.dataSources.notRemoved');

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(t('dashboardModule.messages.dataSources.removeCanceled'));
			});
	};

	return {
		remove,
	};
};
