import { createHmac, randomBytes } from 'node:crypto';
import { DataSource, EntitySubscriberInterface, UpdateEvent } from 'typeorm';

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { outsideSqliteTransaction } from '../../../common/database/sqlite-data-source';
import { EventType } from '../../../modules/devices/devices.constants';
import { SHELLY_AUTH_USERNAME } from '../devices-shelly-v1.constants';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShelliesAdapterService } from '../services/shellies-adapter.service';
import {
	ShellyV1AdoptedIdentityService,
	shellyV1Address,
	shellyV1PinMatches,
	shellyV1ReportedMac,
} from '../services/shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from '../services/shelly-v1-http-client.service';

type CredentialSettings = {
	identifier: string | null;
	hostname: string | null;
	enabled: boolean;
	passwordFingerprint: string | null;
};

@Injectable()
export class DeviceEntitySubscriber implements EntitySubscriberInterface<ShellyV1DeviceEntity> {
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

	private credentialTarget(identifier: string, hostname: string | null) {
		const registration = this.shelliesAdapter.getRegisteredDevice(identifier);
		const host = hostname ?? (shellyV1Address(identifier)?.length === 12 ? registration?.host : null);
		if (!host || !registration || registration.host !== host) return null;
		const { type } = registration;
		const peer = this.shelliesAdapter.getDevice(type, identifier);
		if (!peer || peer.host !== host || peer.id !== identifier || peer.type !== type) return null;
		return {
			peer,
			host,
			isCurrent: () =>
				this.shelliesAdapter.getRegisteredDevice(identifier) === registration &&
				this.shelliesAdapter.getDevice(type, identifier) === peer &&
				registration.host === host &&
				registration.type === type &&
				peer.type === type &&
				peer.host === host,
		};
	}

	private async configureCredentials(device: ShellyV1DeviceEntity, settings: CredentialSettings): Promise<void> {
		const { id, identifier, password } = device;
		if (!identifier || !password) return;
		const target = this.credentialTarget(identifier, device.hostname);
		if (!target) return;
		const { peer, host } = target;
		const current = () => this.settings.get(id) === settings && target.isCurrent();
		const pin = await this.identities.findPin(id);
		if (!current() || (pin && !shellyV1PinMatches(identifier, pin.mac))) return;
		if (pin && pin.verifiedHost !== host) {
			const info = await this.httpClient.getDeviceInfo(host).catch((): null => null);
			if (!current() || shellyV1ReportedMac(identifier, peer.type, info) !== pin.mac) return;
		}
		const login = await this.httpClient.getLoginSettings(host).catch((): null => null);
		if (!current()) return;
		if (pin && pin.verifiedHost !== host) {
			if (!(await this.identities.confirmHost(id, pin.mac, host, pin.verifiedHost, pin.revision))) return;
		} else {
			const latest = await this.identities.findPin(id);
			if (latest?.mac !== pin?.mac || latest?.revision !== pin?.revision || latest?.verifiedHost !== pin?.verifiedHost)
				return;
		}
		if (!current()) return;
		this.shelliesAdapter.setDeviceAuthCredentials(peer, host, login?.username || SHELLY_AUTH_USERNAME, password);
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

	private clearCredentials(identifier: string | null, hostname: string | null): void {
		if (!identifier) return;
		const target = this.credentialTarget(identifier, hostname);
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

	private async reconcile(device: ShellyV1DeviceEntity, created: boolean): Promise<void> {
		if (!(device instanceof ShellyV1DeviceEntity)) return;
		const previous = this.settings.get(device.id);
		if (!created && !previous) return;
		const next = this.snapshot(device);
		if (
			previous &&
			!created &&
			previous.identifier === next.identifier &&
			previous.hostname === next.hostname &&
			previous.enabled === next.enabled &&
			previous.passwordFingerprint === next.passwordFingerprint
		)
			return;
		// Replace the snapshot before any await. An intervening password, endpoint or lifetime change
		// revokes pending lookups even when a later edit restores the original values.
		this.settings.set(device.id, next);
		if (previous) {
			this.clearCredentials(previous.identifier, previous.hostname);
			if (previous.identifier && previous.identifier !== next.identifier)
				this.shelliesAdapter.updateDeviceEnabledStatus(previous.identifier, false);
		}
		if (!next.identifier) return;
		this.shelliesAdapter.updateDeviceEnabledStatus(next.identifier, next.enabled);
		if (next.enabled && device.password)
			await outsideSqliteTransaction(this.dataSource, () => this.configureCredentials(device, next));
		else if (!previous || previous.identifier !== next.identifier || previous.hostname !== next.hostname)
			this.clearCredentials(next.identifier, next.hostname);
	}

	@OnEvent(EventType.DEVICE_DELETED)
	deviceDeleted(device: ShellyV1DeviceEntity): void {
		if (!(device instanceof ShellyV1DeviceEntity)) return;
		this.settings.delete(device.id);
		this.clearCredentials(device.identifier, device.hostname);
		if (device.identifier) this.shelliesAdapter.updateDeviceEnabledStatus(device.identifier, false);
	}

	onModuleDestroy(): void {
		this.settings.clear();
		const index = this.dataSource.subscribers.indexOf(this);
		if (index >= 0) this.dataSource.subscribers.splice(index, 1);
	}
}
