import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesApiException, DevicesException } from '../devices.exceptions';
import { type IChannelProperty, channelsPropertiesStoreKey } from '../store';

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
			t('devicesModule.messages.channelsProperties.confirmRemove', { property: property.name }),
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
							property: property.name,
						})
					);
				} catch (error: unknown) {
					if (error instanceof DevicesApiException && error.code === 404) {
						const errorMessage = t('devicesModule.messages.channelsProperties.notFound', {
							property: property.name,
						});

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof DevicesApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('devicesModule.messages.channelsProperties.notRemoved', {
								property: property.name,
							});

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(
					t('devicesModule.messages.channelsProperties.removeCanceled', {
						property: property.name,
					})
				);
			});
	};

	return {
		remove,
	};
};
