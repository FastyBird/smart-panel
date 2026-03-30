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

	afterInsert(_event: InsertEvent<ShellyNgDeviceEntity>): void {
		// Intentionally no-op. Device provisioning (createOrUpdate) is handled
		// explicitly by DelegatesManagerService.performInsert() after addresses
		// are synced. Firing it here would race with syncAddresses and hit the
		// "no address yet" early return, wasting a DB query on every new device.
		// For API-created devices, provisioning happens when the discovery
		// library picks them up via mDNS.
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
		// event.entity may be undefined if TypeORM couldn't resolve the entity.
		if (event.entity) {
			const entity = event.entity as ShellyNgDeviceEntity;

			if (entity.wifiAddress !== undefined) {
				wifiAddress = entity.wifiAddress;
			}

			if (entity.ethernetAddress !== undefined) {
				ethernetAddress = entity.ethernetAddress;
			}
		}

		const hasAddressUpdate = wifiAddress !== undefined || ethernetAddress !== undefined;

		if (!needsResync && !hasAddressUpdate) {
			return;
		}

		// Address changes always trigger provision after sync — ensures devices
		// added via admin get provisioned once they have an address.
		// createOrUpdate is idempotent and skips quickly if already provisioned.
		if (hasAddressUpdate) {
			this.scheduleAddressSyncThenProvision(event.databaseEntity.id, wifiAddress, ethernetAddress);
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

	/**
	 * Persist address changes. A non-null string upserts the address;
	 * null removes the address entry for that interface.
	 */
	private async syncAddresses(
		deviceId: string,
		wifiAddress: string | null | undefined,
		ethernetAddress: string | null | undefined,
	): Promise<void> {
		if (wifiAddress !== undefined) {
			if (wifiAddress !== null) {
				await this.deviceAddressService.upsertAddress(deviceId, AddressType.WIFI, wifiAddress);
			} else {
				await this.deviceAddressService.removeAddress(deviceId, AddressType.WIFI);
			}
		}

		if (ethernetAddress !== undefined) {
			if (ethernetAddress !== null) {
				await this.deviceAddressService.upsertAddress(deviceId, AddressType.ETHERNET, ethernetAddress);
			} else {
				await this.deviceAddressService.removeAddress(deviceId, AddressType.ETHERNET);
			}
		}
	}

	private scheduleAddressSyncThenProvision(
		deviceId: string,
		wifiAddress: string | null | undefined,
		ethernetAddress: string | null | undefined,
	): void {
		setTimeout(() => {
			void (async (): Promise<void> => {
				try {
					await this.syncAddresses(deviceId, wifiAddress, ethernetAddress);
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
