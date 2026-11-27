import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { EventType } from '../../../modules/devices/devices.constants';
import { DEVICES_SHELLY_V1_PLUGIN_NAME, SHELLY_AUTH_USERNAME } from '../devices-shelly-v1.constants';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShelliesAdapterService } from '../services/shellies-adapter.service';
import {
	ShellyV1AdoptedIdentityService,
	shellyV1Address,
	shellyV1ReportedMac,
} from '../services/shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from '../services/shelly-v1-http-client.service';

@Injectable()
export class DeviceEntitySubscriber implements EntitySubscriberInterface<ShellyV1DeviceEntity> {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'DeviceEntitySubscriber',
	);

	constructor(
		private readonly dataSource: DataSource,
		private readonly shelliesAdapter: ShelliesAdapterService,
		private readonly httpClient: ShellyV1HttpClientService,
		private readonly identities: ShellyV1AdoptedIdentityService,
	) {
		this.dataSource.subscribers.push(this);
	}

	listenTo(): typeof ShellyV1DeviceEntity {
		return ShellyV1DeviceEntity;
	}

	private async configureCredentials(device: ShellyV1DeviceEntity): Promise<void> {
		const { hostname: host, identifier, password } = device;
		if (!host || !identifier) return;
		const registration = this.shelliesAdapter.getRegisteredDevice(identifier);
		const peer = registration && this.shelliesAdapter.getDevice(registration.type, identifier);
		if (!peer || peer.host !== host || registration.host !== host) return;
		const current = (): boolean =>
			this.shelliesAdapter.getRegisteredDevice(identifier) === registration &&
			this.shelliesAdapter.getDevice(registration.type, identifier) === peer &&
			peer.host === host;
		if (!password) {
			this.shelliesAdapter.setDeviceAuthCredentials(peer, host, SHELLY_AUTH_USERNAME, null);
			return;
		}
		const pin = shellyV1Address(identifier)?.length === 6 ? await this.identities.findPin(device.id) : null;
		if (!current()) return;
		if (pin && pin.verifiedHost !== host) {
			const info = await this.httpClient.getDeviceInfo(host).catch((): null => null);
			if (!current() || shellyV1ReportedMac(identifier, peer.type, info) !== pin.mac) return;
			if (!(await this.identities.confirmHost(device.id, pin.mac, host, pin.verifiedHost)) || !current()) return;
		}
		const login = await this.httpClient.getLoginSettings(host).catch((): null => null);
		if (current())
			this.shelliesAdapter.setDeviceAuthCredentials(peer, host, login?.username || SHELLY_AUTH_USERNAME, password);
	}

	// Atomic adoption publishes DEVICE_CREATED only after its row and hardware identity have committed.
	@OnEvent(EventType.DEVICE_CREATED)
	async deviceCreated(device: ShellyV1DeviceEntity): Promise<void> {
		if (!(device instanceof ShellyV1DeviceEntity) || !device.identifier) return;
		this.shelliesAdapter.updateDeviceEnabledStatus(device.identifier, device.enabled);
		await this.configureCredentials(device);
	}

	async afterUpdate(event: UpdateEvent<ShellyV1DeviceEntity>): Promise<void> {
		if (!event.databaseEntity?.identifier) return;
		const device = { ...event.databaseEntity, ...event.entity } as ShellyV1DeviceEntity;
		const columns = event.updatedColumns.map((column) => column.databaseName.toLowerCase());
		if (columns.includes('enabled')) this.shelliesAdapter.updateDeviceEnabledStatus(device.identifier, device.enabled);
		if (columns.includes('password') || columns.includes('hostname')) await this.configureCredentials(device);
	}

	afterRemove(event: { entity?: ShellyV1DeviceEntity }): void {
		const device = event.entity;

		if (!device || !device.identifier) {
			return;
		}

		try {
			// Mark the device as disabled when removed from a database
			this.shelliesAdapter.updateDeviceEnabledStatus(device.identifier, false);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Failed to handle device removal for ${device.identifier}`, {
				message: err.message,
				stack: err.stack,
			});
		}
	}
}
