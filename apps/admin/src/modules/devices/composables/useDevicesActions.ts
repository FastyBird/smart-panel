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

		ElMessageBox.confirm(
			t('devicesModule.texts.devices.confirmBulkRemove', { count: devices.length }),
			t('devicesModule.headings.devices.bulkRemove'),
			{
				confirmButtonText: t('devicesModule.buttons.yes.title'),
				cancelButtonText: t('devicesModule.buttons.no.title'),
				type: 'warning',
			}
		)
			.then(async (): Promise<void> => {
				let successCount = 0;
				let failCount = 0;

				for (const device of devices) {
					try {
						await devicesStore.remove({ id: device.id });
						successCount++;
					} catch {
						failCount++;
					}
				}

				if (successCount > 0) {
					flashMessage.success(t('devicesModule.messages.devices.bulkRemoved', { count: successCount }));
				}

				if (failCount > 0) {
					flashMessage.error(t('devicesModule.messages.devices.bulkRemoveFailed', { count: failCount }));
				}
			})
			.catch((): void => {
				flashMessage.info(t('devicesModule.messages.devices.bulkRemoveCanceled'));
			});
	};

	const bulkEnable = async (devices: IDevice[]): Promise<void> => {
		if (devices.length === 0) {
			return;
		}

		let successCount = 0;
		let failCount = 0;

		for (const device of devices) {
			try {
				await devicesStore.edit({
					id: device.id,
					data: {
						type: device.type,
						enabled: true,
					},
				});
				successCount++;
			} catch {
				failCount++;
			}
		}

		if (successCount > 0) {
			flashMessage.success(t('devicesModule.messages.devices.bulkEnabled', { count: successCount }));
		}

		if (failCount > 0) {
			flashMessage.error(t('devicesModule.messages.devices.bulkEnableFailed', { count: failCount }));
		}
	};

	const bulkDisable = async (devices: IDevice[]): Promise<void> => {
		if (devices.length === 0) {
			return;
		}

		let successCount = 0;
		let failCount = 0;

		for (const device of devices) {
			try {
				await devicesStore.edit({
					id: device.id,
					data: {
						type: device.type,
						enabled: false,
					},
				});
				successCount++;
			} catch {
				failCount++;
			}
		}

		if (successCount > 0) {
			flashMessage.success(t('devicesModule.messages.devices.bulkDisabled', { count: successCount }));
		}

		if (failCount > 0) {
			flashMessage.error(t('devicesModule.messages.devices.bulkDisableFailed', { count: failCount }));
		}
	};

	return {
		remove,
		bulkRemove,
		bulkEnable,
		bulkDisable,
	};
};
