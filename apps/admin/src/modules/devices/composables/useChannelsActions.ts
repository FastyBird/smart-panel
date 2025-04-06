import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesApiException, DevicesException } from '../devices.exceptions';
import type { IChannel } from '../store/channels.store.types';
import { channelsStoreKey } from '../store/keys';

import type { IUseChannelsActions } from './types';

export const useChannelsActions = (): IUseChannelsActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const channelsStore = storesManager.getStore(channelsStoreKey);

	const getChannel = (id: IChannel['id']): IChannel | null => {
		return channelsStore.findById(id);
	};

	const remove = async (id: IChannel['id']): Promise<void> => {
		const channel = getChannel(id);

		if (channel === null) {
			throw new DevicesException("Something went wrong, channel can't be loaded");
		}

		ElMessageBox.confirm(t('devicesModule.messages.channels.confirmRemove', { channel: channel.name }), t('devicesModule.headings.channels.remove'), {
			confirmButtonText: t('devicesModule.buttons.yes.title'),
			cancelButtonText: t('devicesModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				try {
					await channelsStore.remove({ id: channel.id });

					flashMessage.success(
						t('devicesModule.messages.channels.removed', {
							channel: channel.name,
						})
					);
				} catch (error: unknown) {
					if (error instanceof DevicesApiException && error.code === 404) {
						const errorMessage = t('devicesModule.messages.channels.notFound', {
							channel: channel.name,
						});

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof DevicesApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('devicesModule.messages.channels.notRemoved', {
								channel: channel.name,
							});

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(
					t('devicesModule.messages.channels.removeCanceled', {
						channel: channel.name,
					})
				);
			});
	};

	return {
		remove,
	};
};
