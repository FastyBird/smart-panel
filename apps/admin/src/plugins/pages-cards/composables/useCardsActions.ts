import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DashboardApiException, DashboardException } from '../../../modules/dashboard';
import type { ICard } from '../store/cards.store.types';
import { cardsStoreKey } from '../store/keys';

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

		ElMessageBox.confirm(t('pagesCardsPlugin.texts.cards.confirmRemove', { card: card.title }), t('pagesCardsPlugin.headings.cards.remove'), {
			confirmButtonText: t('pagesCardsPlugin.buttons.yes.title'),
			cancelButtonText: t('pagesCardsPlugin.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				try {
					await cardsStore.remove({ id: card.id, pageId: card.page });

					flashMessage.success(
						t('pagesCardsPlugin.messages.cards.removed', {
							card: card.title,
						})
					);
				} catch (error: unknown) {
					if (error instanceof DashboardApiException && error.code === 404) {
						const errorMessage = t('pagesCardsPlugin.messages.cards.notFound', {
							card: card.title,
						});

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof DashboardApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('pagesCardsPlugin.messages.cards.notRemoved', {
								card: card.title,
							});

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(
					t('pagesCardsPlugin.messages.cards.removeCanceled', {
						card: card.title,
					})
				);
			});
	};

	return {
		remove,
	};
};
