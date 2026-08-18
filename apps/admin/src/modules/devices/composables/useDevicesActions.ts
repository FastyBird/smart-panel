import { useI18n } from 'vue-i18n';

import { ElMessageBox } from 'element-plus';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { DevicesApiException, DevicesException } from '../devices.exceptions';
import type { IDevice } from '../store/devices.store.types';
import { devicesStoreKey } from '../store/keys';

import type { IUseDevicesActions } from './types';

export const useDevicesActions = (): IUseDevicesActions => {
	const { t } = useI18n();

	const flashMessage = useFlashMessage();

	const storesManager = injectStoresManager();

	const devicesStore = storesManager.getStore(devicesStoreKey);

	const remove = async (id: IDevice['id']): Promise<void> => {
		const device = devicesStore.findById(id);

		if (device === null) {
			throw new DevicesException("Something went wrong, device can't be loaded");
		}

		ElMessageBox.confirm(t('devicesModule.texts.devices.confirmRemove', { device: device.name }), t('devicesModule.headings.devices.remove'), {
			confirmButtonText: t('devicesModule.buttons.yes.title'),
			cancelButtonText: t('devicesModule.buttons.no.title'),
			type: 'warning',
		})
			.then(async (): Promise<void> => {
				try {
					await devicesStore.remove({ id: device.id });

					flashMessage.success(
						t('devicesModule.messages.devices.removed', {
							device: device.name,
						})
					);
				} catch (error: unknown) {
					if (error instanceof DevicesApiException && error.code === 404) {
						const errorMessage = t('devicesModule.messages.devices.notFound', {
							device: device.name,
						});

						flashMessage.error(errorMessage);
					} else {
						if (error instanceof DevicesApiException && error.code === 422) {
							flashMessage.error(error.message);
						} else {
							const errorMessage = t('devicesModule.messages.devices.notRemoved', {
								device: device.name,
							});

							flashMessage.error(errorMessage);
						}
					}
				}
			})
			.catch((): void => {
				flashMessage.info(
					t('devicesModule.messages.devices.removeCanceled', {
						device: device.name,
					})
				);
			});
	};

	const bulkRemove = async (devices: IDevice[]): Promise<void> => {
		if (devices.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('devicesModule.texts.devices.confirmBulkRemove', { count: devices.length }),
				t('devicesModule.headings.devices.bulkRemove'),
				{
					confirmButtonText: t('devicesModule.buttons.yes.title'),
					cancelButtonText: t('devicesModule.buttons.no.title'),
					type: 'warning',
				}
			);
		} catch {
			// User cancelled - do nothing
			return;
		}

		// One request for the whole selection. Sending one per device tripped the
		// backend's shared rate limit once a selection went past thirty, which
		// left the rest of the selection silently unprocessed.
		try {
			const result = await devicesStore.bulkRemove({ ids: devices.map((device) => device.id) });

			if (result.succeeded.length > 0) {
				flashMessage.success(t('devicesModule.messages.devices.bulkRemoved', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('devicesModule.messages.devices.bulkRemoveFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('devicesModule.messages.devices.bulkRemoveFailed', { count: devices.length }));
		}
	};

	const bulkEnable = async (devices: IDevice[]): Promise<void> => {
		if (devices.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('devicesModule.texts.devices.confirmBulkEnable', { count: devices.length }),
				t('devicesModule.headings.devices.bulkEnable'),
				{
					confirmButtonText: t('devicesModule.buttons.yes.title'),
					cancelButtonText: t('devicesModule.buttons.no.title'),
					type: 'info',
				}
			);
		} catch {
			flashMessage.info(t('devicesModule.messages.devices.bulkEnableCanceled'));

			return;
		}

		// See bulkRemove: one request for the whole selection.
		try {
			const result = await devicesStore.bulkSetEnabled({ ids: devices.map((device) => device.id), enabled: true });

			if (result.succeeded.length > 0) {
				flashMessage.success(t('devicesModule.messages.devices.bulkEnabled', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('devicesModule.messages.devices.bulkEnableFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('devicesModule.messages.devices.bulkEnableFailed', { count: devices.length }));
		}
	};

	const bulkDisable = async (devices: IDevice[]): Promise<void> => {
		if (devices.length === 0) {
			return;
		}

		try {
			await ElMessageBox.confirm(
				t('devicesModule.texts.devices.confirmBulkDisable', { count: devices.length }),
				t('devicesModule.headings.devices.bulkDisable'),
				{
					confirmButtonText: t('devicesModule.buttons.yes.title'),
					cancelButtonText: t('devicesModule.buttons.no.title'),
					type: 'warning',
				}
			);
		} catch {
			flashMessage.info(t('devicesModule.messages.devices.bulkDisableCanceled'));

			return;
		}

		// See bulkRemove: one request for the whole selection.
		try {
			const result = await devicesStore.bulkSetEnabled({ ids: devices.map((device) => device.id), enabled: false });

			if (result.succeeded.length > 0) {
				flashMessage.success(t('devicesModule.messages.devices.bulkDisabled', { count: result.succeeded.length }));
			}

			if (result.failed.length > 0) {
				flashMessage.error(t('devicesModule.messages.devices.bulkDisableFailed', { count: result.failed.length }));
			}
		} catch {
			flashMessage.error(t('devicesModule.messages.devices.bulkDisableFailed', { count: devices.length }));
		}
	};

	return {
		remove,
		bulkRemove,
		bulkEnable,
		bulkDisable,
	};
};
