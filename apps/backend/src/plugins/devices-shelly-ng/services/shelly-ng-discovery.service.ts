import { randomUUID } from 'crypto';
import { Device, Ethernet, WiFi } from 'shellies-ds9';

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
import { ShellyNgService } from './shelly-ng.service';

type LibDevice = Device & {
	wifi?: WiFi & { sta_ip?: string | null };
	ethernet?: Ethernet & { ip?: string | null };
	system?: { config?: { device?: { name?: string | null } } };
};

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
	registeredDeviceCategory: DeviceCategory | null;
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
	timer?: NodeJS.Timeout;
	cleanupTimer?: NodeJS.Timeout;
	unsubscribeAdded?: () => void;
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
		private readonly shellyNgService: ShellyNgService,
	) {}

	async start({ duration }: { duration: number }): Promise<ShellyNgDiscoverySessionSnapshot> {
		const id = randomUUID();
		const startedAt = new Date();
		const expiresAt = new Date(startedAt.getTime() + duration * 1_000);

		const session: ShellyNgDiscoverySession = {
			id,
			status: 'running',
			startedAt,
			expiresAt,
			devices: new Map(),
			passwords: new Map(),
		};

		// Reuse the main connector's already-running mDNS browser instead of spinning up
		// a parallel one. Two browsers + two RPC inspect loops were causing relay glitches
		// on some Plus/Pro firmware. The 30s session window is kept for UX so the user can
		// still power on a new device during the scan and have it picked up.
		//
		// Subscribe BEFORE iterating the seed list — `getKnownDevices()` + the awaited DB
		// lookups inside `handleLibDevice` create a window where the lib could fire `add`
		// for a fresh device that's not in the seed and there's no listener attached yet.
		// `handleLibDevice` is keyed on hostname so an overlap between a seed entry and
		// a concurrent `add` event just overwrites the same row rather than duplicating.
		session.unsubscribeAdded = this.shellyNgService.subscribeToAddedDevice((device) => {
			void this.handleLibDevice(session, device as LibDevice);
		});

		for (const device of this.shellyNgService.getKnownDevices()) {
			await this.handleLibDevice(session, device as LibDevice);
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
		this.unsubscribeFromAdded(session);

		this.scheduleCleanup(session);

		await Promise.resolve();
	}

	private unsubscribeFromAdded(session: ShellyNgDiscoverySession): void {
		if (typeof session.unsubscribeAdded === 'function') {
			try {
				session.unsubscribeAdded();
			} catch (error) {
				const err = error as Error;

				this.logger.warn('Failed to detach Shelly NG discovery listener', {
					session: session.id,
					message: err.message,
					stack: err.stack,
				});
			}

			session.unsubscribeAdded = undefined;
		}
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
		this.unsubscribeFromAdded(session);
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

	/**
	 * Build a discovery snapshot for a device the main connector's mDNS browser already
	 * knows about. No HTTP RPC is sent to the device — everything comes from the lib's
	 * cached info plus a DB lookup. Manual entries still go through `inspectDevice`
	 * because they may target devices the main connector hasn't reached.
	 */
	private async handleLibDevice(session: ShellyNgDiscoverySession, device: LibDevice): Promise<void> {
		const hostname = device.wifi?.sta_ip ?? device.ethernet?.ip ?? null;

		if (typeof hostname !== 'string' || hostname.length === 0) {
			return;
		}

		// Skip if the user already entered this device manually — that path has the password
		// and a richer (RPC-fetched) snapshot we don't want to overwrite.
		const existing = session.devices.get(hostname);

		if (existing && existing.source === 'manual') {
			return;
		}

		try {
			const registeredDevice = await this.devicesService.findOneBy<ShellyNgDeviceEntity>(
				'identifier',
				device.id,
				DEVICES_SHELLY_NG_TYPE,
			);

			const descriptor = this.findDescriptor(device.model);
			const categories = descriptor?.categories ?? [];

			let status: ShellyNgDiscoveryDeviceStatus;

			if (registeredDevice !== null) {
				status = 'already_registered';
			} else if (descriptor === null) {
				status = 'unsupported';
			} else {
				status = 'ready';
			}

			const snapshot: ShellyNgDiscoveryDeviceSnapshot = {
				identifier: device.id,
				hostname,
				name: device.system?.config?.device?.name ?? null,
				model: device.model,
				displayName: descriptor?.name ?? device.modelName ?? device.model,
				firmware: device.firmware?.version ?? null,
				status,
				source: 'mdns',
				categories,
				// Pre-fill the wizard's category dropdown with the first listed category for the
				// model so the user can adopt a brand-new device without picking anything. The
				// descriptor's category list is ordered most-common-first (e.g. Plus 1 → lighting,
				// switcher), so this lands on the typical use; users with edge cases can still
				// flip the dropdown in step 2.
				suggestedCategory: categories.length > 0 ? categories[0] : null,
				// Devices in `shellies.values()` have already authenticated successfully
				// (the main connector wouldn't expose them otherwise). Password-protected
				// devices the connector can't reach never appear here — they have to be
				// adopted via the wizard's manual-entry path, which still inspects over
				// HTTP and surfaces `needs_password` correctly.
				authentication: { enabled: false, domain: null },
				registeredDeviceId: registeredDevice?.id ?? null,
				registeredDeviceName: registeredDevice?.name ?? null,
				registeredDeviceCategory: registeredDevice?.category ?? null,
				error: null,
				lastSeenAt: new Date().toISOString(),
			};

			session.devices.set(hostname, snapshot);
		} catch (error) {
			// Most likely a transient DB error from `findOneBy`. Surface the device with a
			// `failed` snapshot so the user can see something happened, but never let the
			// promise reject — this is invoked from a fire-and-forget `add` listener and
			// a rejection here would crash the process.
			const err = error as Error;

			this.logger.warn('Failed to build discovery snapshot for device from main connector', {
				session: session.id,
				hostname,
				message: err.message,
				stack: err.stack,
			});

			session.devices.set(hostname, {
				identifier: device.id,
				hostname,
				name: device.system?.config?.device?.name ?? null,
				model: device.model,
				displayName: device.modelName ?? device.model,
				firmware: device.firmware?.version ?? null,
				status: 'failed',
				source: 'mdns',
				categories: [],
				suggestedCategory: null,
				authentication: { enabled: false, domain: null },
				registeredDeviceId: null,
				registeredDeviceName: null,
				registeredDeviceCategory: null,
				error: err.message,
				lastSeenAt: new Date().toISOString(),
			});
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
			registeredDeviceCategory: existing?.registeredDeviceCategory ?? null,
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
				// Pre-fill the wizard's category dropdown with the first listed category for the
				// model so the user can adopt a brand-new device without picking anything. The
				// descriptor's category list is ordered most-common-first (e.g. Plus 1 → lighting,
				// switcher), so this lands on the typical use; users with edge cases can still
				// flip the dropdown in step 2.
				suggestedCategory: categories.length > 0 ? categories[0] : null,
				authentication,
				registeredDeviceId: registeredDevice?.id ?? null,
				registeredDeviceName: registeredDevice?.name ?? null,
				registeredDeviceCategory: registeredDevice?.category ?? null,
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
