import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DashboardApiException, DashboardException } from '../dashboard.exceptions';
import { type IPage, pagesStoreKey } from '../store';

import type { IUsePagesActions } from './types';

export const usePagesActions = (): IUsePagesActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const pagesStore = storesManager.getStore(pagesStoreKey);

	const remove = async (id: IPage['id']): Promise<void> => {
		const page = pagesStore.findById(id);

		if (page === null) {
			throw new DashboardException("Something went wrong, page can't be loaded");
		}

		ElMessageBox.confirm(t('dashboardModule.texts.pages.confirmRemove', { page: page.title }), t('dashboardModule.headings.pages.remove'), {
			confirmButtonText: t('dashboardModule.buttons.yes.title'),
			cancelButtonText: t('dashboardModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				try {
					await pagesStore.remove({ id: page.id });

					flashMessage.success(
						t('dashboardModule.messages.pages.removed', {
							page: page.title,
						})
					);
				} catch (error: unknown) {
					if (error instanceof DashboardApiException && error.code === 404) {
						const errorMessage = t('dashboardModule.messages.pages.notFound', {
							page: page.title,
						});

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof DashboardApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('dashboardModule.messages.pages.notRemoved', {
								page: page.title,
							});

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(
					t('dashboardModule.messages.pages.removeCanceled', {
						page: page.title,
					})
				);
			});
	};

	return {
		remove,
	};
};
