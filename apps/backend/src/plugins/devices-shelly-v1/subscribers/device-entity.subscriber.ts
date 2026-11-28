import { createHmac, randomBytes } from 'node:crypto';
import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { outsideSqliteTransaction } from '../../../common/database/sqlite-data-source';
import { createExtensionLogger } from '../../../common/logger';
import { EventType } from '../../../modules/devices/devices.constants';
import { DEVICES_SHELLY_V1_PLUGIN_NAME, SHELLY_AUTH_USERNAME } from '../devices-shelly-v1.constants';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShelliesAdapterService } from '../services/shellies-adapter.service';
import {
	ShellyV1AdoptedIdentityService,
	shellyV1Address,
	shellyV1PinMatches,
	shellyV1RegistrationMatchesPin,
	shellyV1ReportedMac,
} from '../services/shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from '../services/shelly-v1-http-client.service';

type CredentialSettings = {
	identifier: string | null;
	hostname: string | null;
	enabled: boolean;
	passwordFingerprint: string | null;
	retry?: boolean;
};

@Injectable()
export class DeviceEntitySubscriber implements EntitySubscriberInterface<ShellyV1DeviceEntity> {
	private readonly logger = createExtensionLogger(DEVICES_SHELLY_V1_PLUGIN_NAME, 'DeviceEntitySubscriber');
	private readonly fingerprintKey = randomBytes(32);
	private readonly settings = new Map<string, CredentialSettings>();

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

	private credentialTarget(id: string, identifier: string, hostname: string | null) {
		const catalog = { id, identifier, hostname };
		const registration = this.shelliesAdapter.getRegisteredDeviceForCatalog(catalog);
		const host =
			hostname ?? (registration?.catalog || shellyV1Address(identifier)?.length === 12 ? registration?.host : null);
		if (!host || !registration || registration.host !== host) return null;
		const { type, credentialRevision } = registration;
		const peer = this.shelliesAdapter.getDevice(type, registration.id);
		if (!peer || peer.host !== host || peer.id !== registration.id || peer.type !== type) return null;
		return {
			peer,
			host,
			registration,
			isCurrent: () =>
				this.shelliesAdapter.getRegisteredDeviceForCatalog(catalog) === registration &&
				this.shelliesAdapter.getDevice(type, registration.id) === peer &&
				registration.host === host &&
				registration.type === type &&
				registration.credentialRevision === credentialRevision &&
				peer.type === type &&
				peer.host === host,
		};
	}

	private async configureCredentials(device: ShellyV1DeviceEntity, settings: CredentialSettings): Promise<boolean> {
		const { id, identifier, password } = device;
		if (!identifier || !password) return false;
		const target = this.credentialTarget(id, identifier, device.hostname);
		if (!target) return false;
		const { peer, host } = target;
		const current = () => this.settings.get(id) === settings && target.isCurrent();
		const pin = await this.identities.findPin(id);
		if (
			!current() ||
			!shellyV1RegistrationMatchesPin(target.registration, device, pin) ||
			(pin && !shellyV1PinMatches(identifier, pin.mac))
		)
			return false;
		if (pin && pin.verifiedHost !== host) {
			const info = await this.httpClient.getDeviceInfo(host).catch((): null => null);
			if (!current() || shellyV1ReportedMac(identifier, peer.type, info) !== pin.mac) return false;
		}
		const login = await this.httpClient.getLoginSettings(host).catch((): null => null);
		if (!current()) return false;
		if (pin && pin.verifiedHost !== host) {
			if (!(await this.identities.confirmHost(id, pin.mac, host, pin.verifiedHost, pin.revision))) return false;
		} else {
			const latest = await this.identities.findPin(id);
			if (latest?.mac !== pin?.mac || latest?.revision !== pin?.revision || latest?.verifiedHost !== pin?.verifiedHost)
				return false;
		}
		if (!current()) return false;
		return this.shelliesAdapter.setDeviceAuthCredentials(peer, host, login?.username || SHELLY_AUTH_USERNAME, password);
	}

	private snapshot(device: ShellyV1DeviceEntity): CredentialSettings {
		return {
			identifier: device.identifier,
			hostname: device.hostname,
			enabled: device.enabled,
			passwordFingerprint: device.password
				? createHmac('sha256', this.fingerprintKey).update(device.password).digest('base64')
				: null,
		};
	}

	// Already-adopted devices can be edited before the first discovery after startup.
	// Keep only the previous values. A rollback produces no device publication or network work.
	afterUpdate(event: UpdateEvent<ShellyV1DeviceEntity>): void {
		const previous = event.databaseEntity;
		if (!previous?.id || this.settings.has(previous.id)) return;
		if (
			event.updatedColumns.some(({ propertyName }) =>
				['identifier', 'hostname', 'password', 'enabled'].includes(propertyName),
			)
		)
			this.settings.set(previous.id, this.snapshot(previous));
	}

	private clearCredentials(id: string, identifier: string | null, hostname: string | null): void {
		if (!identifier) return;
		const target = this.credentialTarget(id, identifier, hostname);
		if (target) this.shelliesAdapter.setDeviceAuthCredentials(target.peer, target.host, SHELLY_AUTH_USERNAME, null);
	}

	@OnEvent(EventType.DEVICE_CREATED)
	deviceCreated(device: ShellyV1DeviceEntity): Promise<void> {
		return this.reconcile(device, true);
	}

	@OnEvent(EventType.DEVICE_UPDATED)
	deviceUpdated(device: ShellyV1DeviceEntity): Promise<void> {
		return this.reconcile(device, false);
	}

	afterCatalogSave(device: ShellyV1DeviceEntity, changed?: boolean): Promise<ShellyV1DeviceEntity> {
		// An idempotent PATCH sends no DEVICE_UPDATED. Leave the network work outside the caller's
		// transaction, just as for the ordinary post-save event.
		if (changed === false && this.settings.get(device.id)?.retry) {
			void this.reconcile(device, false, true).catch(() => {
				this.logger.warn('Could not retry credential installation for the saved Shelly device.', {
					resource: device.id,
				});
			});
		}
		return Promise.resolve(device);
	}

	private async reconcile(device: ShellyV1DeviceEntity, created: boolean, retryOnly = false): Promise<void> {
		if (!(device instanceof ShellyV1DeviceEntity)) return;
		const previous = this.settings.get(device.id);
		if (!created && !previous) return;
		const next = this.snapshot(device);
		const unchanged =
			previous &&
			!created &&
			previous.identifier === next.identifier &&
			previous.hostname === next.hostname &&
			previous.enabled === next.enabled &&
			previous.passwordFingerprint === next.passwordFingerprint;
		if ((unchanged && !previous.retry) || (retryOnly && !unchanged)) return;
		// Replace the snapshot before any await. An intervening password, endpoint or lifetime change
		// revokes pending lookups even when a later edit restores the original values.
		this.settings.set(device.id, next);
		const registration = this.shelliesAdapter.getRegisteredDeviceForCatalog(device);
		if (previous && !unchanged) {
			this.clearCredentials(device.id, previous.identifier, previous.hostname);
			const previousRegistration = this.shelliesAdapter.getRegisteredDeviceForCatalog({
				id: device.id,
				identifier: previous.identifier,
				hostname: previous.hostname,
			});
			if (previousRegistration && previousRegistration !== registration) {
				this.shelliesAdapter.updateDeviceEnabledStatus(previousRegistration.id, false, previousRegistration.type);
				if (previousRegistration.catalog) this.shelliesAdapter.releaseCatalogDevice(device.id);
			}
		}
		if (!next.identifier) return;
		if (registration) this.shelliesAdapter.updateDeviceEnabledStatus(registration.id, next.enabled, registration.type);
		if (next.enabled && device.password) {
			let configured = false;
			try {
				configured = await outsideSqliteTransaction(this.dataSource, () => this.configureCredentials(device, next));
			} finally {
				// Only this save is marked retryable. A newer save owns its own snapshot.
				next.retry = !configured;
			}
		} else if (!previous || previous.identifier !== next.identifier || previous.hostname !== next.hostname)
			this.clearCredentials(device.id, next.identifier, next.hostname);
	}

	@OnEvent(EventType.DEVICE_DELETED)
	deviceDeleted(device: ShellyV1DeviceEntity): void {
		if (!(device instanceof ShellyV1DeviceEntity)) return;
		this.settings.delete(device.id);
		this.clearCredentials(device.id, device.identifier, device.hostname);
		const registration = this.shelliesAdapter.getRegisteredDeviceForCatalog(device);
		if (registration) this.shelliesAdapter.updateDeviceEnabledStatus(registration.id, false, registration.type);
		this.shelliesAdapter.releaseCatalogDevice(device.id);
	}

	onModuleDestroy(): void {
		this.settings.clear();
		const index = this.dataSource.subscribers.indexOf(this);
		if (index >= 0) this.dataSource.subscribers.splice(index, 1);
	}
}
