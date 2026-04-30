import { randomUUID } from 'crypto';
import { MdnsDeviceDiscoverer } from 'shellies-ds9';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DESCRIPTORS,
	DEVICES_SHELLY_NG_PLUGIN_NAME,
	DEVICES_SHELLY_NG_TYPE,
	DeviceDescriptor,
} from '../devices-shelly-ng.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';

import { DeviceManagerService } from './device-manager.service';

export type ShellyNgDiscoverySessionStatus = 'running' | 'finished' | 'failed';

export type ShellyNgDiscoveryDeviceStatus =
	| 'checking'
	| 'ready'
	| 'needs_password'
	| 'already_registered'
	| 'unsupported'
	| 'failed';

export type ShellyNgDiscoveryDeviceSource = 'mdns' | 'manual';

export interface ShellyNgDiscoveryDeviceSnapshot {
	identifier: string | null;
	hostname: string;
	name: string | null;
	model: string | null;
	displayName: string | null;
	firmware: string | null;
	status: ShellyNgDiscoveryDeviceStatus;
	source: ShellyNgDiscoveryDeviceSource;
	categories: DeviceCategory[];
	suggestedCategory: DeviceCategory | null;
	authentication: {
		enabled: boolean;
		domain: string | null;
	};
	registeredDeviceId: string | null;
	registeredDeviceName: string | null;
	error: string | null;
	lastSeenAt: string;
}

export interface ShellyNgDiscoverySessionSnapshot {
	id: string;
	status: ShellyNgDiscoverySessionStatus;
	startedAt: string;
	expiresAt: string;
	remainingSeconds: number;
	devices: ShellyNgDiscoveryDeviceSnapshot[];
}

interface ShellyNgDiscoverySession {
	id: string;
	status: ShellyNgDiscoverySessionStatus;
	startedAt: Date;
	expiresAt: Date;
	discoverer: MdnsDeviceDiscoverer;
	timer?: NodeJS.Timeout;
	cleanupTimer?: NodeJS.Timeout;
	devices: Map<string, ShellyNgDiscoveryDeviceSnapshot>;
	passwords: Map<string, string>;
}

@Injectable()
export class ShellyNgDiscoveryService {
	private static readonly FINISHED_SESSION_TTL_MS = 5 * 60_000;

	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_NG_PLUGIN_NAME,
		'ShellyNgDiscoveryService',
	);

	private readonly sessions = new Map<string, ShellyNgDiscoverySession>();

	constructor(
		private readonly deviceManagerService: DeviceManagerService,
		private readonly devicesService: DevicesService,
	) {}

	async start({ duration }: { duration: number }): Promise<ShellyNgDiscoverySessionSnapshot> {
		const id = randomUUID();
		const startedAt = new Date();
		const expiresAt = new Date(startedAt.getTime() + duration * 1_000);
		const discoverer = new MdnsDeviceDiscoverer();

		const session: ShellyNgDiscoverySession = {
			id,
			status: 'running',
			startedAt,
			expiresAt,
			discoverer,
			devices: new Map(),
			passwords: new Map(),
		};

		discoverer.on('discover', (device: { deviceId?: string; hostname?: string }) => {
			const hostname = device.hostname ?? device.deviceId ?? '';

			void this.inspectDevice(session, hostname, 'mdns', session.passwords.get(hostname) ?? null);
		});

		discoverer.on('error', (error: Error) => {
			this.logger.warn('mDNS discovery emitted an error', {
				session: id,
				message: error.message,
				stack: error.stack,
			});
		});

		try {
			await discoverer.start();
		} catch (error) {
			this.clearTimers(session);

			throw error;
		}

		session.timer = setTimeout(() => {
			void this.finish(id);
		}, duration * 1_000);

		this.sessions.set(id, session);

		return this.toSnapshot(session);
	}

	get(id: string): ShellyNgDiscoverySessionSnapshot | null {
		const session = this.sessions.get(id);

		if (session === undefined) {
			return null;
		}

		return this.toSnapshot(session);
	}

	async manual(
		id: string,
		{ hostname, password }: { hostname: string; password?: string | null },
	): Promise<ShellyNgDiscoverySessionSnapshot | null> {
		const session = this.sessions.get(id);

		if (session === undefined) {
			return null;
		}

		const discoveredDevice = await this.inspectDevice(session, hostname, 'manual', password ?? null);

		if (password !== null && typeof password !== 'undefined' && discoveredDevice?.status === 'ready') {
			this.storePassword(session, discoveredDevice, password);
		}

		return this.toSnapshot(session);
	}

	private async finish(id: string): Promise<void> {
		const session = this.sessions.get(id);

		if (session === undefined || session.status !== 'running') {
			return;
		}

		session.status = 'finished';

		this.clearTimer(session);

		try {
			await session.discoverer.stop();
		} catch (error) {
			const err = error as Error;

			this.logger.warn('Failed to stop Shelly NG mDNS discovery session', {
				session: id,
				message: err.message,
				stack: err.stack,
			});
		}

		this.scheduleCleanup(session);
	}

	private scheduleCleanup(session: ShellyNgDiscoverySession): void {
		this.clearCleanupTimer(session);

		session.cleanupTimer = setTimeout(() => {
			this.sessions.delete(session.id);
		}, ShellyNgDiscoveryService.FINISHED_SESSION_TTL_MS);
	}

	private clearTimers(session: ShellyNgDiscoverySession): void {
		this.clearTimer(session);
		this.clearCleanupTimer(session);
	}

	private clearTimer(session: ShellyNgDiscoverySession): void {
		if (session.timer !== undefined) {
			clearTimeout(session.timer);
			session.timer = undefined;
		}
	}

	private clearCleanupTimer(session: ShellyNgDiscoverySession): void {
		if (session.cleanupTimer !== undefined) {
			clearTimeout(session.cleanupTimer);
			session.cleanupTimer = undefined;
		}
	}

	private storePassword(
		session: ShellyNgDiscoverySession,
		device: ShellyNgDiscoveryDeviceSnapshot,
		password: string,
	): void {
		session.passwords.set(device.hostname, password);

		if (device.identifier !== null) {
			session.passwords.set(device.identifier, password);
		}
	}

	private async inspectDevice(
		session: ShellyNgDiscoverySession,
		hostname: string,
		source: ShellyNgDiscoveryDeviceSource,
		password: string | null,
	): Promise<ShellyNgDiscoveryDeviceSnapshot | null> {
		if (hostname.length === 0) {
			return null;
		}

		const existing = session.devices.get(hostname);

		session.devices.set(hostname, {
			identifier: existing?.identifier ?? null,
			hostname,
			name: existing?.name ?? null,
			model: existing?.model ?? null,
			displayName: existing?.displayName ?? null,
			firmware: existing?.firmware ?? null,
			status: 'checking',
			source,
			categories: existing?.categories ?? [],
			suggestedCategory: existing?.suggestedCategory ?? null,
			authentication: existing?.authentication ?? { enabled: false, domain: null },
			registeredDeviceId: existing?.registeredDeviceId ?? null,
			registeredDeviceName: existing?.registeredDeviceName ?? null,
			error: null,
			lastSeenAt: new Date().toISOString(),
		});

		try {
			const deviceInfo = await this.deviceManagerService.getDeviceInfo(hostname, password);
			const descriptor = this.findDescriptor(deviceInfo.model);
			const registeredDevice = await this.devicesService.findOneBy<ShellyNgDeviceEntity>(
				'identifier',
				deviceInfo.id,
				DEVICES_SHELLY_NG_TYPE,
			);
			const categories = descriptor?.categories ?? [];
			const authentication = {
				enabled: deviceInfo.auth_en,
				domain: deviceInfo.auth_domain,
			};

			let status: ShellyNgDiscoveryDeviceStatus = 'ready';

			if (registeredDevice !== null) {
				status = 'already_registered';
			} else if (descriptor === null) {
				status = 'unsupported';
			} else if (deviceInfo.auth_en && password === null) {
				status = 'needs_password';
			}

			const discoveredDevice: ShellyNgDiscoveryDeviceSnapshot = {
				identifier: deviceInfo.id,
				hostname,
				name: deviceInfo.name ?? null,
				model: deviceInfo.model,
				displayName: descriptor?.name ?? deviceInfo.model,
				firmware: deviceInfo.ver,
				status,
				source,
				categories,
				suggestedCategory: categories.length === 1 ? categories[0] : null,
				authentication,
				registeredDeviceId: registeredDevice?.id ?? null,
				registeredDeviceName: registeredDevice?.name ?? null,
				error: null,
				lastSeenAt: new Date().toISOString(),
			};

			session.devices.set(hostname, discoveredDevice);

			return discoveredDevice;
		} catch (error) {
			const err = error as Error;
			const currentDevice = session.devices.get(hostname);

			if (currentDevice === undefined) {
				return null;
			}

			const failedDevice: ShellyNgDiscoveryDeviceSnapshot = {
				...currentDevice,
				status: 'failed',
				source,
				error: err.message,
				lastSeenAt: new Date().toISOString(),
			};

			session.devices.set(hostname, failedDevice);

			return failedDevice;
		}
	}

	private findDescriptor(model: string): DeviceDescriptor | null {
		const normalizedModel = model.toUpperCase();

		return (
			Object.values(DESCRIPTORS).find((descriptor) =>
				descriptor.models.some((descriptorModel) => descriptorModel.toUpperCase() === normalizedModel),
			) ?? null
		);
	}

	private toSnapshot(session: ShellyNgDiscoverySession): ShellyNgDiscoverySessionSnapshot {
		return {
			id: session.id,
			status: session.status,
			startedAt: session.startedAt.toISOString(),
			expiresAt: session.expiresAt.toISOString(),
			remainingSeconds: Math.max(0, Math.ceil((session.expiresAt.getTime() - Date.now()) / 1_000)),
			devices: Array.from(session.devices.values()),
		};
	}
}
