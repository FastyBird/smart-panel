import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { InsertEvent } from 'typeorm/subscriber/event/InsertEvent';

import { Injectable, Logger } from '@nestjs/common';

import { SHELLY_AUTH_USERNAME } from '../devices-shelly-v1.constants';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShelliesAdapterService } from '../services/shellies-adapter.service';
import { ShellyV1HttpClientService } from '../services/shelly-v1-http-client.service';

@Injectable()
export class DeviceEntitySubscriber implements EntitySubscriberInterface<ShellyV1DeviceEntity> {
	private readonly logger = new Logger(DeviceEntitySubscriber.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly shelliesAdapter: ShelliesAdapterService,
		private readonly httpClient: ShellyV1HttpClientService,
	) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof ShellyV1DeviceEntity {
		return ShellyV1DeviceEntity;
	}

	/**
	 * Fetches the username from the device's login settings
	 * Falls back to the default constant if the fetch fails
	 */
	private async fetchDeviceUsername(host: string): Promise<string> {
		try {
			const loginSettings = await this.httpClient.getLoginSettings(host);
			return loginSettings.username || SHELLY_AUTH_USERNAME;
		} catch {
			// Fallback to default username if login endpoint fails
			return SHELLY_AUTH_USERNAME;
		}
	}

	async afterInsert(event: InsertEvent<ShellyV1DeviceEntity>): Promise<void> {
		const device = event.entity;

		if (!device.identifier) {
			this.logger.warn(
				`[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Device ${device.id} has no identifier, skipping auth setup`,
			);
			return;
		}

		try {
			// Set auth credentials if password is provided
			if (device.password) {
				const registeredDevice = this.shelliesAdapter.getRegisteredDevice(device.identifier);

				if (registeredDevice) {
					// Fetch username from device, fallback to default constant
					const username = await this.fetchDeviceUsername(registeredDevice.host);

					this.shelliesAdapter.setDeviceAuthCredentials(
						registeredDevice.type,
						device.identifier,
						username,
						device.password,
					);

					this.logger.debug(
						`[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Auth credentials set for device ${device.identifier} (username: ${username})`,
					);
				} else {
					this.logger.debug(
						`[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Device ${device.identifier} not yet discovered, credentials will be set on discovery`,
					);
				}
			}

			// Set enabled status
			this.shelliesAdapter.updateDeviceEnabledStatus(device.identifier, device.enabled);

			this.logger.debug(
				`[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Device ${device.identifier} was successfully created (enabled: ${device.enabled})`,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Failed to finalize newly created device=${device.id}`, {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	async afterUpdate(event: UpdateEvent<ShellyV1DeviceEntity>): Promise<void> {
		const device = event.databaseEntity;

		if (!device || !device.identifier) {
			this.logger.warn('[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Cannot process update - device has no identifier');
			return;
		}

		let credentialsUpdated = false;
		let enabledUpdated = false;

		for (const updatedColumn of event.updatedColumns) {
			const columnName = updatedColumn.databaseName.toLowerCase();

			if (['password', 'hostname'].includes(columnName)) {
				credentialsUpdated = true;
			}

			if (columnName === 'enabled') {
				enabledUpdated = true;
			}
		}

		try {
			// Handle enabled status change
			if (enabledUpdated) {
				this.shelliesAdapter.updateDeviceEnabledStatus(device.identifier, device.enabled);

				this.logger.debug(
					`[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Device ${device.identifier} enabled status updated to: ${device.enabled}`,
				);
			}

			// Handle credentials update
			if (credentialsUpdated && device.password) {
				const registeredDevice = this.shelliesAdapter.getRegisteredDevice(device.identifier);

				if (registeredDevice) {
					// Fetch username from device, fallback to default constant
					const username = await this.fetchDeviceUsername(registeredDevice.host);

					this.shelliesAdapter.setDeviceAuthCredentials(
						registeredDevice.type,
						device.identifier,
						username,
						device.password,
					);

					this.logger.debug(
						`[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Auth credentials updated for device ${device.identifier} (username: ${username})`,
					);
				} else {
					this.logger.warn(
						`[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Device ${device.identifier} not found in adapter, cannot update credentials`,
					);
				}
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Failed to finalize updated device=${device.id}`, {
				message: err.message,
				stack: err.stack,
			});
		}
	}

	afterRemove(event: { entity?: ShellyV1DeviceEntity }): void {
		const device = event.entity;

		if (!device || !device.identifier) {
			return;
		}

		try {
			// Mark device as disabled when removed from database
			this.shelliesAdapter.updateDeviceEnabledStatus(device.identifier, false);

			this.logger.debug(
				`[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Device ${device.identifier} marked as disabled after removal`,
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(
				`[SHELLY V1][DEVICE ENTITY SUBSCRIBER] Failed to handle device removal for ${device.identifier}`,
				{
					message: err.message,
					stack: err.stack,
				},
			);
		}
	}
}
