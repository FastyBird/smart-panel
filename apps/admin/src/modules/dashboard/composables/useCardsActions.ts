import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DashboardApiException, DashboardException } from '../dashboard.exceptions';
import { type ICard, cardsStoreKey } from '../store';

import type { IUseCardsActions } from './types';

export const useCardsActions = (): IUseCardsActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const cardsStore = storesManager.getStore(cardsStoreKey);

	const getCard = (id: ICard['id']): ICard | null => {
		return cardsStore.findById(id);
	};

	const remove = async (id: ICard['id']): Promise<void> => {
		const card = getCard(id);

		if (card === null) {
			throw new DashboardException("Something went wrong, card can't be loaded");
		}

		ElMessageBox.confirm(t('dashboardModule.texts.cards.confirmRemove', { card: card.title }), t('dashboardModule.headings.cards.remove'), {
			confirmButtonText: t('dashboardModule.buttons.yes.title'),
			cancelButtonText: t('dashboardModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				try {
					await cardsStore.remove({ id: card.id, pageId: card.page });

					flashMessage.success(
						t('dashboardModule.messages.cards.removed', {
							card: card.title,
						})
					);
				} catch (error: unknown) {
					if (error instanceof DashboardApiException && error.code === 404) {
						const errorMessage = t('dashboardModule.messages.cards.notFound', {
							card: card.title,
						});

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof DashboardApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('dashboardModule.messages.cards.notRemoved', {
								card: card.title,
							});

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(
					t('dashboardModule.messages.cards.removeCanceled', {
						card: card.title,
					})
				);
			});
	};

	return {
		remove,
	};
};
