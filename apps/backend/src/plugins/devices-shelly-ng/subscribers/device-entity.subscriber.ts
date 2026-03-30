import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { InsertEvent } from 'typeorm/subscriber/event/InsertEvent';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { AddressType, DEVICES_SHELLY_NG_PLUGIN_NAME } from '../devices-shelly-ng.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';
import { DeviceAddressService } from '../services/device-address.service';
import { DeviceManagerService } from '../services/device-manager.service';
import { ShellyNgService } from '../services/shelly-ng.service';

@Injectable()
export class DeviceEntitySubscriber implements EntitySubscriberInterface<ShellyNgDeviceEntity> {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'DeviceEntitySubscriber',
	);

	constructor(
		private readonly dataSource: DataSource,
		private readonly deviceManagerService: DeviceManagerService,
		private readonly deviceAddressService: DeviceAddressService,
		private readonly shellyNgService: ShellyNgService,
	) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof ShellyNgDeviceEntity {
		return ShellyNgDeviceEntity;
	}

	afterInsert(event: InsertEvent<ShellyNgDeviceEntity>): void {
		this.scheduleProvision(event.entity.id);
	}

	afterUpdate(event: UpdateEvent<ShellyNgDeviceEntity>): void {
		let needsResync = false;
		let wifiAddress: string | null | undefined;
		let ethernetAddress: string | null | undefined;

		for (const updatedColumn of event.updatedColumns) {
			const col = updatedColumn.databaseName.toLowerCase();

			// Resync when credentials or category changes
			// Category change requires channel re-creation with new categories
			if (['password', 'category'].includes(col)) {
				needsResync = true;
			}
		}

		// Check for address updates passed via transient @Expose fields on the entity.
		// These survive toInstance() in the generic devices service update flow.
		const entity = event.entity as ShellyNgDeviceEntity;

		if (entity.wifiAddress !== undefined) {
			wifiAddress = entity.wifiAddress;
		}

		if (entity.ethernetAddress !== undefined) {
			ethernetAddress = entity.ethernetAddress;
		}

		const hasAddressUpdate = wifiAddress !== undefined || ethernetAddress !== undefined;

		if (!needsResync && !hasAddressUpdate) {
			return;
		}

		// When both address sync and provision are needed, run them sequentially
		// in a single deferred callback so provision sees the updated addresses.
		if (hasAddressUpdate && needsResync) {
			this.scheduleAddressSyncThenProvision(event.databaseEntity.id, wifiAddress, ethernetAddress);
		} else if (hasAddressUpdate) {
			this.scheduleAddressSync(event.databaseEntity.id, wifiAddress, ethernetAddress);
		} else if (needsResync) {
			this.scheduleProvision(event.databaseEntity.id);
		}
	}

	afterRemove(): void {
		this.shellyNgService.restart().catch((error) => {
			const err = error as Error;

			this.logger.error('Failed restart Shelly communication service', {
				message: err.message,
				stack: err.stack,
			});
		});
	}

	private scheduleAddressSync(
		deviceId: string,
		wifiAddress: string | null | undefined,
		ethernetAddress: string | null | undefined,
	): void {
		setTimeout(() => {
			void (async (): Promise<void> => {
				try {
					if (wifiAddress !== undefined && wifiAddress !== null) {
						await this.deviceAddressService.upsertAddress(deviceId, AddressType.WIFI, wifiAddress);
					}

					if (ethernetAddress !== undefined && ethernetAddress !== null) {
						await this.deviceAddressService.upsertAddress(deviceId, AddressType.ETHERNET, ethernetAddress);
					}
				} catch (error) {
					const err = error as Error;

					this.logger.error(`Failed to sync addresses for device=${deviceId}`, {
						message: err.message,
						stack: err.stack,
					});
				}
			})();
		}, 0);
	}

	private scheduleAddressSyncThenProvision(
		deviceId: string,
		wifiAddress: string | null | undefined,
		ethernetAddress: string | null | undefined,
	): void {
		setTimeout(() => {
			void (async (): Promise<void> => {
				try {
					if (wifiAddress !== undefined && wifiAddress !== null) {
						await this.deviceAddressService.upsertAddress(deviceId, AddressType.WIFI, wifiAddress);
					}

					if (ethernetAddress !== undefined && ethernetAddress !== null) {
						await this.deviceAddressService.upsertAddress(deviceId, AddressType.ETHERNET, ethernetAddress);
					}
				} catch (error) {
					const err = error as Error;

					this.logger.error(`Failed to sync addresses for device=${deviceId}`, {
						message: err.message,
						stack: err.stack,
					});

					return; // Don't provision with stale addresses
				}

				try {
					await this.deviceManagerService.createOrUpdate(deviceId);
				} catch (error) {
					const err = error as Error;

					if (err.message === 'Device not found.') {
						this.logger.warn(`Skip finalize for missing device=${deviceId}`);
						return;
					}

					this.logger.error(`Failed to finalize device=${deviceId}`, {
						message: err.message,
						stack: err.stack,
					});
				}
			})();
		}, 0);
	}

	private scheduleProvision(deviceId: string): void {
		const run = async (): Promise<void> => {
			try {
				await this.deviceManagerService.createOrUpdate(deviceId);
			} catch (error) {
				const err = error as Error;

				// If the device was deleted between insert/update and finalize, skip retrying.
				if (err.message === 'Device not found.') {
					this.logger.warn(`Skip finalize for missing device=${deviceId}`);
					return;
				}

				this.logger.error(`Failed to finalize device=${deviceId}`, {
					message: err.message,
					stack: err.stack,
				});
			}
		};

		// Always defer to the macrotask queue so the caller's save() promise chain
		// resolves before this provisioning flow submits its own queries.
		setTimeout(() => {
			void run();
		}, 0);
	}
}
