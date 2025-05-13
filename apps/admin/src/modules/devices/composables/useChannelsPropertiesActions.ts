import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesApiException, DevicesException } from '../devices.exceptions';
import type { IChannelProperty } from '../store/channels.properties.store.types';
import { channelsPropertiesStoreKey } from '../store/keys';

import type { IUseChannelsPropertiesActions } from './types';

export const useChannelsPropertiesActions = (): IUseChannelsPropertiesActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const remove = async (id: IChannelProperty['id']): Promise<void> => {
		const property = propertiesStore.findById(id);

		if (property === null) {
			throw new DevicesException("Something went wrong, channel property can't be loaded");
		}

		ElMessageBox.confirm(
			t('devicesModule.texts.channelsProperties.confirmRemove', {
				property: property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`),
			}),
			t('devicesModule.headings.channelsProperties.remove'),
			{
				confirmButtonText: t('devicesModule.buttons.yes.title'),
				cancelButtonText: t('devicesModule.buttons.no.title'),
				type: 'warning',
			}
		)
			.then(async (): Promise<void> => {
				try {
					await propertiesStore.remove({ id: property.id, channelId: property.channel });

					flashMessage.success(
						t('devicesModule.messages.channelsProperties.removed', {
							property: property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`),
						})
					);
				} catch (error: unknown) {
					if (error instanceof DevicesApiException && error.code === 404) {
						const errorMessage = t('devicesModule.messages.channelsProperties.notFound', {
							property: property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`),
						});

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof DevicesApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('devicesModule.messages.channelsProperties.notRemoved', {
								property: property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`),
							});

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(
					t('devicesModule.messages.channelsProperties.removeCanceled', {
						property: property.name ?? t(`devicesModule.categories.channelsProperties.${property.category}`),
					})
				);
			});
	};

	return {
		remove,
	};
};
