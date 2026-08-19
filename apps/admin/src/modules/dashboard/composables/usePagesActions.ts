import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DashboardApiException, DashboardException } from '../dashboard.exceptions';
import { pagesStoreKey } from '../store/keys';
import type { IPage } from '../store/pages.store.types';

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

	const bulkRemove = async (pages: IPage[]): Promise<void> => {
		if (pages.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('dashboardModule.texts.pages.confirmBulkRemove', { count: pages.length }),
				t('dashboardModule.headings.pages.bulkRemove'),
				{
					confirmButtonText: t('dashboardModule.buttons.yes.title'),
					cancelButtonText: t('dashboardModule.buttons.no.title'),
					type: 'warning',
				}
			);
		} catch {
			// User cancelled - do nothing
			return;
		}

		// One request for the whole selection. Sending one per page tripped the
		// backend's shared rate limit once a selection went past thirty, which left
		// the rest of the selection silently unprocessed.
		try {
			const result = await pagesStore.bulkRemove({ ids: pages.map((page) => page.id) });

			if (result.succeeded.length > 0) {
				flashMessage.success(t('dashboardModule.messages.pages.bulkRemoved', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('dashboardModule.messages.pages.bulkRemoveFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('dashboardModule.messages.pages.bulkRemoveFailed', { count: pages.length }));
		}
	};

	return {
		remove,
		bulkRemove,
	};
};
