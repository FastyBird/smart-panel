import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DashboardApiException, DashboardException } from '../dashboard.exceptions';
import { type IDataSource } from '../store/dataSources.store.types';
import { dataSourcesStoreKey } from '../store/keys';

import type { IUseDataSourcesActions } from './types';

interface IUseDataSourcesActionsProps {
	parent: string;
	parentId: string;
}

export const useDataSourcesActions = (props: IUseDataSourcesActionsProps): IUseDataSourcesActions => {
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
					await dataSourcesStore.remove({ parent: { type: props.parent, id: props.parentId }, id: dataSource.id });

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
