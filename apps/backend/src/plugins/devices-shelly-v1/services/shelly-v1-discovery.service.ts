import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DEVICES_SHELLY_V1_PLUGIN_NAME, SHELLY_AUTH_USERNAME } from '../devices-shelly-v1.constants';
import { ShellyDevice } from '../interfaces/shellies.interface';
import { ShellyInfoResponse } from '../interfaces/shelly-http.interface';
import { findShellyV1Descriptor } from '../utils/descriptor.utils';

import { ShelliesAdapterService } from './shellies-adapter.service';
import {
	ShellyV1AdoptedIdentityService,
	ShellyV1AdoptionState,
	shellyV1Address,
	shellyV1DiscoveryOwner,
	shellyV1PinMatches,
	shellyV1RegistrationMatchesPin,
	shellyV1ReportedMac,
} from './shelly-v1-adopted-identity.service';
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
		private readonly identities: ShellyV1AdoptedIdentityService,
		private readonly httpClient: ShellyV1HttpClientService,
	) {}

	start({ duration }: { duration: number }): ShellyV1DiscoverySessionSnapshot {
		// Finish any session still running before this one. A second `start()` (e.g. the user
		// clicking "Scan again") would otherwise stack a fresh `add` subscription on top of the
		// previous one, double-probing every device the lib sees and leaving an orphan
		// finish-timer ticking until it fires. The frontend only tracks the latest session id
		// anyway, so any in-flight work on the old session is invisible to the user.
		for (const existing of this.sessions.values()) {
			if (existing.status === 'running') {
				void this.finish(existing.id);
			}
		}

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

	/** Use the hardware proof already available to this scan. A short ID alone cannot identify a catalog row. */
	private async identify(
		identifier: string,
		hostname: string,
		mac: string | null,
		peer?: ShellyDevice,
	): Promise<{ identifier: string; registeredDevice: ShellyV1AdoptionState | null }> {
		const candidates = await this.identities.captureDiscovery(identifier);
		const registration = peer && this.shelliesAdapter.getRegisteredDevice(peer.id, peer.type);
		if (
			peer &&
			(!registration ||
				registration.host !== hostname ||
				peer.host !== hostname ||
				this.shelliesAdapter.getDevice(peer.type, peer.id) !== peer)
		)
			throw new Error('Shelly peer changed during discovery.');
		const ambiguous = peer && this.shelliesAdapter.getRegisteredDevice(peer.id) !== registration;

		if (mac) {
			const owner = shellyV1DiscoveryOwner(candidates, mac, hostname);
			if (owner) {
				const address = shellyV1Address(owner.identifier);
				const expected = owner.pin?.mac ?? (address?.length === 12 ? address : null);
				if (expected) {
					if (expected === mac && shellyV1PinMatches(owner.identifier, mac))
						return { identifier: owner.identifier, registeredDevice: owner };
				} else if (owner.hostname === hostname) {
					const current = peer && this.shelliesAdapter.getRegisteredDeviceForCatalog(owner);
					if (!peer || current === registration) return { identifier: owner.identifier, registeredDevice: owner };
					// A different model sharing this short ID at another host does not invalidate a
					// positive HTTP probe of the sole SDK peer at the configured legacy endpoint.
					if (
						ambiguous &&
						!current &&
						!registration.catalog &&
						!this.shelliesAdapter.getKnownDevices().some((other) => other !== peer && other.host === hostname)
					)
						return { identifier: owner.identifier, registeredDevice: owner };
				}
			} else if (!peer) {
				const legacy = await this.identities.findLegacyAtHost(hostname, mac);
				if (legacy) return { identifier: legacy.identifier, registeredDevice: legacy };
			}
			// Another device already uses this short ID. Submit the distinct, verified MAC for adoption.
			return { identifier: ambiguous || candidates.exact ? mac : identifier, registeredDevice: null };
		}

		const claim = registration?.catalog;
		let owner = candidates.exact;
		if (claim) owner = [candidates.exact, ...candidates.aliases].find((row) => row?.id === claim.deviceId) ?? null;
		if (owner && registration && this.shelliesAdapter.getRegisteredDeviceForCatalog(owner) === registration) {
			if (claim) {
				if (
					shellyV1RegistrationMatchesPin(registration, owner, owner.pin) &&
					(claim.revision === undefined || claim.revision === owner.pin?.revision)
				)
					return { identifier: owner.identifier, registeredDevice: owner };
			} else {
				const configured =
					owner.hostname === hostname || (!owner.hostname && shellyV1Address(identifier)?.length === 12);
				if (
					configured &&
					(!owner.pin || (owner.pin.verifiedHost === hostname && shellyV1PinMatches(identifier, owner.pin.mac)))
				)
					return { identifier: owner.identifier, registeredDevice: owner };
			}
		}
		if (ambiguous || candidates.exact || claim)
			throw new Error('The full MAC is needed to distinguish this Shelly device from another catalog or SDK peer.');
		return { identifier, registeredDevice: null };
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
			const descriptor = findShellyV1Descriptor(device.type);
			const categories = descriptor?.categories ?? [];
			const info = await this.httpClient.getDeviceInfo(hostname, 3_000).catch((): ShellyInfoResponse | null => null);
			const mac = shellyV1ReportedMac(device.id, device.type, info);
			if (info && (info.type !== device.type || (shellyV1Address(device.id) && !mac)))
				throw new Error('Shelly HTTP identity does not match the discovered SDK peer.');
			const { identifier, registeredDevice } = await this.identify(device.id, hostname, mac, device);
			const authEnabled = Boolean(info?.auth);
			let status: ShellyV1DiscoveryDeviceStatus = 'ready';
			if (registeredDevice) status = 'already_registered';
			else if (!descriptor) status = 'unsupported';
			else if (authEnabled) status = 'needs_password';

			const snapshot: ShellyV1DiscoveryDeviceSnapshot = {
				identifier,
				hostname,
				name: null,
				model: device.type,
				displayName: descriptor?.name ?? device.type,
				firmware: info?.fw ?? null,
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
			// A failed identity check remains visible in the scan without selecting a catalog row.
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
			const descriptor = findShellyV1Descriptor(shellyInfo.type);
			// The manual probe supplies the full MAC, even if CoIoT reports a short SDK ID.
			const fullMac = this.buildIdentifier(shellyInfo.mac);
			if (!fullMac || !/^[0-9A-F]{12}$/.test(fullMac)) throw new Error('Shelly returned an invalid hardware MAC.');
			const { identifier, registeredDevice } = await this.identify(fullMac, hostname, fullMac);
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
				registeredDeviceId: null,
				registeredDeviceName: null,
				registeredDeviceCategory: null,
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
	 * Normalize the full MAC returned by a manual HTTP probe.
	 */
	private buildIdentifier(mac: string | null | undefined): string | null {
		if (typeof mac !== 'string' || mac.length === 0) {
			return null;
		}

		return mac.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
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
