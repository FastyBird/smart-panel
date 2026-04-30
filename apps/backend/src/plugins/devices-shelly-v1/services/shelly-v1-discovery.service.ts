import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DESCRIPTORS,
	DEVICES_SHELLY_V1_PLUGIN_NAME,
	DEVICES_SHELLY_V1_TYPE,
	DeviceDescriptor,
	SHELLY_AUTH_USERNAME,
} from '../devices-shelly-v1.constants';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShellyDevice } from '../interfaces/shellies.interface';

import { ShelliesAdapterService } from './shellies-adapter.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

export type ShellyV1DiscoverySessionStatus = 'running' | 'finished' | 'failed';

export type ShellyV1DiscoveryDeviceStatus =
	| 'checking'
	| 'ready'
	| 'needs_password'
	| 'already_registered'
	| 'unsupported'
	| 'failed';

export type ShellyV1DiscoveryDeviceSource = 'mdns' | 'manual';

export interface ShellyV1DiscoveryDeviceSnapshot {
	identifier: string | null;
	hostname: string;
	name: string | null;
	model: string | null;
	displayName: string | null;
	firmware: string | null;
	status: ShellyV1DiscoveryDeviceStatus;
	source: ShellyV1DiscoveryDeviceSource;
	categories: DeviceCategory[];
	suggestedCategory: DeviceCategory | null;
	authentication: {
		enabled: boolean;
		valid: boolean | null;
	};
	registeredDeviceId: string | null;
	registeredDeviceName: string | null;
	registeredDeviceCategory: DeviceCategory | null;
	error: string | null;
	lastSeenAt: string;
}

export interface ShellyV1DiscoverySessionSnapshot {
	id: string;
	status: ShellyV1DiscoverySessionStatus;
	startedAt: string;
	expiresAt: string;
	remainingSeconds: number;
	devices: ShellyV1DiscoveryDeviceSnapshot[];
}

interface ShellyV1DiscoverySession {
	id: string;
	status: ShellyV1DiscoverySessionStatus;
	startedAt: Date;
	expiresAt: Date;
	timer?: NodeJS.Timeout;
	cleanupTimer?: NodeJS.Timeout;
	unsubscribeAdded?: () => void;
	devices: Map<string, ShellyV1DiscoveryDeviceSnapshot>;
}

@Injectable()
export class ShellyV1DiscoveryService {
	private static readonly FINISHED_SESSION_TTL_MS = 5 * 60_000;

	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SHELLY_V1_PLUGIN_NAME,
		'ShellyV1DiscoveryService',
	);

	private readonly sessions = new Map<string, ShellyV1DiscoverySession>();

	constructor(
		private readonly shelliesAdapter: ShelliesAdapterService,
		private readonly devicesService: DevicesService,
		private readonly httpClient: ShellyV1HttpClientService,
	) {}

	start({ duration }: { duration: number }): ShellyV1DiscoverySessionSnapshot {
		const id = randomUUID();
		const startedAt = new Date();
		const expiresAt = new Date(startedAt.getTime() + duration * 1_000);

		const session: ShellyV1DiscoverySession = {
			id,
			status: 'running',
			startedAt,
			expiresAt,
			devices: new Map(),
		};

		// Reuse the main connector's already-running CoAP/mDNS browser instead of spinning up a
		// parallel one. The 30s session window is kept for UX so the user can still power on a
		// new device during the scan and have it picked up.
		//
		// Subscribe BEFORE seeding — `getKnownDevices()` + the awaited DB lookups inside
		// `handleLibDevice` create a window where the lib could fire `add` for a fresh device
		// that's not in the seed and there's no listener attached yet. `handleLibDevice` is keyed
		// on hostname so an overlap between a seed entry and a concurrent `add` event just
		// overwrites the same row rather than duplicating.
		session.unsubscribeAdded = this.shelliesAdapter.subscribeToAddedDevice((device) => {
			void this.handleLibDevice(session, device);
		});

		// Arm the finish timer and register the session BEFORE seeding so the wall-clock session
		// lifetime matches `expiresAt` regardless of how long enrichment takes.
		session.timer = setTimeout(() => {
			void this.finish(id);
		}, duration * 1_000);

		this.sessions.set(id, session);

		// Seed concurrently and don't await — each `handleLibDevice` does an HTTP probe with a
		// 3s timeout, so awaiting them sequentially would push the start response past the scan
		// duration with even a few unreachable devices in the lib's registry. Per-device snapshots
		// land in `session.devices` as they finish; the frontend's 1Hz polling picks them up
		// without us blocking the initial response.
		void Promise.allSettled(
			this.shelliesAdapter.getKnownDevices().map((device) => this.handleLibDevice(session, device)),
		);

		return this.toSnapshot(session);
	}

	get(id: string): ShellyV1DiscoverySessionSnapshot | null {
		const session = this.sessions.get(id);

		if (session === undefined) {
			return null;
		}

		return this.toSnapshot(session);
	}

	async manual(
		id: string,
		{ hostname, password }: { hostname: string; password?: string | null },
	): Promise<ShellyV1DiscoverySessionSnapshot | null> {
		const session = this.sessions.get(id);

		if (session === undefined) {
			return null;
		}

		await this.inspectDevice(session, hostname, 'manual', password ?? null);

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

	private unsubscribeFromAdded(session: ShellyV1DiscoverySession): void {
		if (typeof session.unsubscribeAdded === 'function') {
			try {
				session.unsubscribeAdded();
			} catch (error) {
				const err = error as Error;

				this.logger.warn('Failed to detach Shelly V1 discovery listener', {
					session: session.id,
					message: err.message,
					stack: err.stack,
				});
			}

			session.unsubscribeAdded = undefined;
		}
	}

	private scheduleCleanup(session: ShellyV1DiscoverySession): void {
		this.clearCleanupTimer(session);

		session.cleanupTimer = setTimeout(() => {
			this.sessions.delete(session.id);
		}, ShellyV1DiscoveryService.FINISHED_SESSION_TTL_MS);
	}

	private clearTimer(session: ShellyV1DiscoverySession): void {
		if (session.timer !== undefined) {
			clearTimeout(session.timer);
			session.timer = undefined;
		}
	}

	private clearCleanupTimer(session: ShellyV1DiscoverySession): void {
		if (session.cleanupTimer !== undefined) {
			clearTimeout(session.cleanupTimer);
			session.cleanupTimer = undefined;
		}
	}

	/**
	 * Build a discovery snapshot for a device the main connector already knows about.
	 * Probes the device over HTTP (no auth) to surface model/firmware in the wizard
	 * — the lib's `device.type` is the model code (e.g. `SHSW-1`) but doesn't expose
	 * firmware version. Manual entries go through the same `inspectDevice` path because
	 * they may target devices the main connector hasn't reached and may need a password.
	 */
	private async handleLibDevice(session: ShellyV1DiscoverySession, device: ShellyDevice): Promise<void> {
		const hostname = device.host;

		if (typeof hostname !== 'string' || hostname.length === 0) {
			return;
		}

		// Skip if the user already entered this device manually — that path has the password
		// and a richer snapshot we don't want to overwrite.
		const existing = session.devices.get(hostname);

		if (existing && existing.source === 'manual') {
			return;
		}

		try {
			const registeredDevice = await this.devicesService.findOneBy<ShellyV1DeviceEntity>(
				'identifier',
				device.id,
				DEVICES_SHELLY_V1_TYPE,
			);

			const descriptor = this.findDescriptor(device.type);
			const categories = descriptor?.categories ?? [];

			let status: ShellyV1DiscoveryDeviceStatus;

			if (registeredDevice !== null) {
				status = 'already_registered';
			} else if (descriptor === null) {
				status = 'unsupported';
			} else {
				status = 'ready';
			}

			// Try to enrich with /shelly response (firmware, auth flag) — best effort, the lib
			// gives us model + host but not firmware version. If the call fails, fall back to
			// what we have.
			let firmware: string | null = null;
			let authEnabled = false;

			try {
				const shellyInfo = await this.httpClient.getDeviceInfo(hostname, 3_000);
				firmware = shellyInfo.fw ?? null;
				authEnabled = Boolean(shellyInfo.auth);

				// If auth is enabled and the device wasn't already registered we can't validate
				// without a password — surface as needs_password so the user can enter one in the
				// manual-add form.
				if (authEnabled && status === 'ready') {
					status = 'needs_password';
				}
			} catch {
				// /shelly is reachable for most devices, but if it fails we leave the snapshot as-is —
				// the lib already saw this device, so it's online via CoAP at least.
			}

			const snapshot: ShellyV1DiscoveryDeviceSnapshot = {
				identifier: device.id,
				hostname,
				name: null,
				model: device.type,
				displayName: descriptor?.name ?? device.type,
				firmware,
				status,
				source: 'mdns',
				categories,
				// Pre-fill the wizard's category dropdown with the first listed category for the
				// model so the user can adopt a brand-new device without picking anything. The
				// descriptor's category list is ordered most-common-first, so this lands on the
				// typical use; users with edge cases can still flip the dropdown in step 2.
				suggestedCategory: categories.length > 0 ? categories[0] : null,
				authentication: { enabled: authEnabled, valid: null },
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
				name: null,
				model: device.type,
				displayName: device.type,
				firmware: null,
				status: 'failed',
				source: 'mdns',
				categories: [],
				suggestedCategory: null,
				authentication: { enabled: false, valid: null },
				registeredDeviceId: null,
				registeredDeviceName: null,
				registeredDeviceCategory: null,
				error: err.message,
				lastSeenAt: new Date().toISOString(),
			});
		}
	}

	private async inspectDevice(
		session: ShellyV1DiscoverySession,
		hostname: string,
		source: ShellyV1DiscoveryDeviceSource,
		password: string | null,
	): Promise<ShellyV1DiscoveryDeviceSnapshot | null> {
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
			authentication: existing?.authentication ?? { enabled: false, valid: null },
			registeredDeviceId: existing?.registeredDeviceId ?? null,
			registeredDeviceName: existing?.registeredDeviceName ?? null,
			registeredDeviceCategory: existing?.registeredDeviceCategory ?? null,
			error: null,
			lastSeenAt: new Date().toISOString(),
		});

		try {
			const shellyInfo = await this.httpClient.getDeviceInfo(hostname);
			const descriptor = this.findDescriptor(shellyInfo.type);
			// Mirror the shellies library's `device.id` format — uppercase MAC without separators —
			// so wizard-adopted devices match the identifier the auto-discovery flow uses.
			const identifier = this.buildIdentifier(shellyInfo.mac);
			const registeredDevice = identifier
				? await this.devicesService.findOneBy<ShellyV1DeviceEntity>('identifier', identifier, DEVICES_SHELLY_V1_TYPE)
				: null;
			const categories = descriptor?.categories ?? [];

			let authValid: boolean | null = null;

			// Validate password if required + provided
			if (shellyInfo.auth && password !== null) {
				try {
					await this.httpClient.getDeviceStatus(hostname, undefined, SHELLY_AUTH_USERNAME, password);
					authValid = true;
				} catch (error) {
					authValid = false;

					this.logger.warn(
						`Auth credentials invalid for ${hostname}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}

			let status: ShellyV1DiscoveryDeviceStatus = 'ready';

			if (registeredDevice !== null) {
				status = 'already_registered';
			} else if (descriptor === null) {
				status = 'unsupported';
			} else if (shellyInfo.auth && (password === null || authValid === false)) {
				status = 'needs_password';
			}

			const discoveredDevice: ShellyV1DiscoveryDeviceSnapshot = {
				identifier,
				hostname,
				name: existing?.name ?? null,
				model: shellyInfo.type,
				displayName: descriptor?.name ?? shellyInfo.type,
				firmware: shellyInfo.fw ?? null,
				status,
				source,
				categories,
				suggestedCategory: categories.length > 0 ? categories[0] : null,
				authentication: { enabled: Boolean(shellyInfo.auth), valid: authValid },
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

			const failedDevice: ShellyV1DiscoveryDeviceSnapshot = {
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

	/**
	 * Build the canonical device identifier the same way the shellies library does — the
	 * uppercase MAC address without separators. The auto-discovery path uses this value
	 * directly (`event.id` from CoAP), so wizard-adopted devices must use the same format
	 * to be matched on subsequent CoAP frames.
	 */
	private buildIdentifier(mac: string | null | undefined): string | null {
		if (typeof mac !== 'string' || mac.length === 0) {
			return null;
		}

		return mac.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
	}

	/**
	 * Mirror the matching strategy used by `device-mapper.service.ts` and the device platform
	 * — substring match on `descriptor.models`, then partial-name fallback on the descriptor
	 * key / friendly name. The wizard MUST agree with the main connector here: if a device
	 * type the connector adopts gets `unsupported` in the wizard, users see a confusing
	 * inconsistency for variants whose `type` carries an extra suffix beyond the canonical
	 * model code (e.g. SHSW-1 vs SHSW-1-something).
	 */
	private findDescriptor(model: string | null | undefined): DeviceDescriptor | null {
		if (typeof model !== 'string' || model.length === 0) {
			return null;
		}

		const normalizedModel = model.toUpperCase();

		for (const descriptor of Object.values(DESCRIPTORS)) {
			if (descriptor.models.some((descriptorModel) => normalizedModel.includes(descriptorModel.toUpperCase()))) {
				return descriptor;
			}
		}

		for (const [key, descriptor] of Object.entries(DESCRIPTORS)) {
			if (normalizedModel.includes(key) || descriptor.name.toUpperCase().includes(normalizedModel)) {
				return descriptor;
			}
		}

		return null;
	}

	private toSnapshot(session: ShellyV1DiscoverySession): ShellyV1DiscoverySessionSnapshot {
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
