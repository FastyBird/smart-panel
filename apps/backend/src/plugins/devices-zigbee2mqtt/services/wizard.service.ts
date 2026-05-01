import { randomUUID } from 'crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, DEVICES_ZIGBEE2MQTT_TYPE } from '../devices-zigbee2mqtt.constants';
import { Zigbee2mqttBridgeOfflineException } from '../devices-zigbee2mqtt.exceptions';
import { AdoptChannelDefinitionDto, AdoptDeviceRequestDto } from '../dto/mapping-preview.dto';
import { Zigbee2mqttDeviceEntity } from '../entities/devices-zigbee2mqtt.entity';
import { Z2mRegisteredDevice } from '../interfaces/zigbee2mqtt.interface';
import { Z2mMappingPreviewModel } from '../models/zigbee2mqtt-response.model';

import { Z2mDeviceAdoptionService } from './device-adoption.service';
import { Z2mMappingPreviewService } from './mapping-preview.service';
import { Zigbee2mqttService } from './zigbee2mqtt.service';

export type Z2mWizardDeviceStatus = 'ready' | 'unsupported' | 'already_registered' | 'failed';

export interface Z2mWizardAdoptionResult {
	ieeeAddress: string;
	name: string;
	status: 'created' | 'updated' | 'failed';
	error: string | null;
}

export interface Z2mWizardDeviceSnapshot {
	ieeeAddress: string;
	friendlyName: string;
	manufacturer: string | null;
	model: string | null;
	description: string | null;
	status: Z2mWizardDeviceStatus;
	categories: DeviceCategory[];
	suggestedCategory: DeviceCategory | null;
	previewChannelCount: number;
	previewChannelIdentifiers: string[];
	registeredDeviceId: string | null;
	registeredDeviceName: string | null;
	registeredDeviceCategory: DeviceCategory | null;
	error: string | null;
	lastSeenAt: string;
}

export interface Z2mWizardSessionSnapshot {
	id: string;
	bridgeOnline: boolean;
	startedAt: string;
	permitJoin: { active: boolean; expiresAt: string | null; remainingSeconds: number };
	devices: Z2mWizardDeviceSnapshot[];
}

interface Z2mWizardSession {
	id: string;
	startedAt: Date;
	permitJoin: { active: boolean; expiresAt: Date | null; timer?: NodeJS.Timeout };
	devices: Map<string, Z2mWizardDeviceSnapshot>;
	unsubscribeJoined?: () => void;
	idleTimer?: NodeJS.Timeout;
}

@Injectable()
export class Z2mWizardService implements OnModuleDestroy {
	private static readonly IDLE_TTL_MS = 10 * 60_000;
	private static readonly PERMIT_JOIN_DURATION_S = 254;

	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'Z2mWizardService',
	);

	private readonly sessions = new Map<string, Z2mWizardSession>();

	constructor(
		private readonly zigbee2mqttService: Zigbee2mqttService,
		private readonly deviceAdoptionService: Z2mDeviceAdoptionService,
		private readonly mappingPreviewService: Z2mMappingPreviewService,
		private readonly devicesService: DevicesService,
	) {}

	async start(): Promise<Z2mWizardSessionSnapshot> {
		const id = randomUUID();
		const session: Z2mWizardSession = {
			id,
			startedAt: new Date(),
			permitJoin: { active: false, expiresAt: null },
			devices: new Map(),
		};

		this.sessions.set(id, session);
		this.refreshIdleTimer(session);

		// Subscribe BEFORE populating the seed list — `populateInitialDevices` will perform
		// awaited DB lookups (Task 6) that create a window where the bridge could fire
		// `device_joined` for a fresh device that's not in the seed and there's no listener
		// attached yet. `handleDeviceJoined` is keyed on `ieeeAddress` so an overlap between
		// a seed entry and a concurrent `device_joined` event just overwrites the same row
		// rather than duplicating.
		session.unsubscribeJoined = this.zigbee2mqttService.subscribeToDeviceJoined((device) => {
			void this.handleDeviceJoined(session, device);
		});

		await this.populateInitialDevices(session);

		return this.toSnapshot(session);
	}

	get(id: string): Z2mWizardSessionSnapshot | null {
		const session = this.sessions.get(id);

		if (!session) {
			return null;
		}

		this.refreshIdleTimer(session);

		return this.toSnapshot(session);
	}

	async end(id: string): Promise<void> {
		const session = this.sessions.get(id);

		if (!session) {
			return;
		}

		await this.cleanupSession(session);

		this.sessions.delete(id);
	}

	async onModuleDestroy(): Promise<void> {
		for (const session of this.sessions.values()) {
			await this.cleanupSession(session);
		}

		this.sessions.clear();
	}

	async enablePermitJoin(id: string): Promise<Z2mWizardSessionSnapshot | null> {
		const session = this.sessions.get(id);

		if (!session) {
			return null;
		}

		this.refreshIdleTimer(session);

		const ok = await this.zigbee2mqttService.setPermitJoin(Z2mWizardService.PERMIT_JOIN_DURATION_S);

		if (!ok) {
			this.logger.warn('Failed to enable permit_join', { session: id });

			// Surface the failure so the frontend can show an error instead of silently
			// rendering a "still off" snapshot (which the user reads as "click had no effect").
			throw new Zigbee2mqttBridgeOfflineException();
		}

		if (session.permitJoin.timer) {
			clearTimeout(session.permitJoin.timer);
		}

		session.permitJoin = {
			active: true,
			expiresAt: new Date(Date.now() + Z2mWizardService.PERMIT_JOIN_DURATION_S * 1_000),
			timer: setTimeout(() => {
				session.permitJoin = { active: false, expiresAt: null };
			}, Z2mWizardService.PERMIT_JOIN_DURATION_S * 1_000),
		};

		return this.toSnapshot(session);
	}

	async disablePermitJoin(id: string): Promise<Z2mWizardSessionSnapshot | null> {
		const session = this.sessions.get(id);

		if (!session) {
			return null;
		}

		this.refreshIdleTimer(session);

		await this.disablePermitJoinInternal(session);

		return this.toSnapshot(session);
	}

	private async cleanupSession(session: Z2mWizardSession): Promise<void> {
		await this.disablePermitJoinInternal(session);

		session.unsubscribeJoined?.();

		if (session.idleTimer) {
			clearTimeout(session.idleTimer);
		}
	}

	private toSnapshot(session: Z2mWizardSession): Z2mWizardSessionSnapshot {
		return {
			id: session.id,
			bridgeOnline: this.zigbee2mqttService.isBridgeOnline(),
			startedAt: session.startedAt.toISOString(),
			permitJoin: {
				active: session.permitJoin.active,
				expiresAt: session.permitJoin.expiresAt?.toISOString() ?? null,
				remainingSeconds: session.permitJoin.expiresAt
					? Math.max(0, Math.ceil((session.permitJoin.expiresAt.getTime() - Date.now()) / 1_000))
					: 0,
			},
			devices: Array.from(session.devices.values()),
		};
	}

	private refreshIdleTimer(session: Z2mWizardSession): void {
		if (session.idleTimer) {
			clearTimeout(session.idleTimer);
		}

		session.idleTimer = setTimeout(() => {
			void this.end(session.id);
		}, Z2mWizardService.IDLE_TTL_MS);
	}

	private async disablePermitJoinInternal(session: Z2mWizardSession): Promise<void> {
		if (!session.permitJoin.active) {
			return;
		}

		if (session.permitJoin.timer) {
			clearTimeout(session.permitJoin.timer);
		}

		try {
			await this.zigbee2mqttService.setPermitJoin(0);
		} catch (e) {
			this.logger.warn('Failed to disable permit_join during cleanup', { message: (e as Error).message });
		}

		session.permitJoin = { active: false, expiresAt: null };
	}

	private async populateInitialDevices(session: Z2mWizardSession): Promise<void> {
		if (!this.zigbee2mqttService.isBridgeOnline()) return;

		const z2mDevices = this.zigbee2mqttService.getRegisteredDevices();
		const adopted = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);

		for (const z2mDevice of z2mDevices) {
			const snapshot = await this.computeSnapshot(z2mDevice, adopted);
			session.devices.set(snapshot.ieeeAddress, snapshot);
		}
	}

	private async handleDeviceJoined(session: Z2mWizardSession, z2mDevice: Z2mRegisteredDevice): Promise<void> {
		try {
			const adopted = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
			const snapshot = await this.computeSnapshot(z2mDevice, adopted);
			session.devices.set(snapshot.ieeeAddress, snapshot);
		} catch (e) {
			this.logger.warn('Failed to handle device-joined event', {
				session: session.id,
				ieeeAddress: z2mDevice?.ieeeAddress,
				message: (e as Error).message,
			});
		}
	}

	private async computeSnapshot(
		z2mDevice: Z2mRegisteredDevice,
		adopted: Zigbee2mqttDeviceEntity[],
	): Promise<Z2mWizardDeviceSnapshot> {
		const adoptedRecord = adopted.find((d) => d.identifier === z2mDevice.friendlyName) ?? null;

		let preview: Z2mMappingPreviewModel | null = null;
		let previewError: string | null = null;
		try {
			preview = await this.mappingPreviewService.generatePreview(z2mDevice.ieeeAddress);
		} catch (e) {
			previewError = (e as Error).message;
		}

		const suggestedCategory = preview?.suggestedDevice?.category ?? null;
		// Always offer the full enum so users can override the suggested category. The
		// suggestion is exposed separately via `suggestedCategory` so the frontend can
		// pre-select it. If no suggestion was produced the user still gets the full picker.
		const categories: DeviceCategory[] = Object.values(DeviceCategory) as DeviceCategory[];

		// Distinct channel categories from exposes that would actually be adopted. Filter
		// rules MUST match buildAdoptRequest exactly — otherwise a device whose only mapped
		// exposes produce 'generic' channels would be marked 'ready' here but produce an
		// empty-channel device when adopted.
		const channelCategories = new Set<string>();
		for (const expose of preview?.exposes ?? []) {
			if (expose.status === 'skipped' || expose.status === 'unmapped') continue;
			if (!expose.suggestedChannel) continue;
			if ((expose.suggestedChannel.category as string) === 'generic') continue;
			if (!expose.suggestedProperties || expose.suggestedProperties.length === 0) continue;
			channelCategories.add(expose.suggestedChannel.category);
		}
		const previewChannelIdentifiers = Array.from(channelCategories);
		const previewChannelCount = previewChannelIdentifiers.length;

		let status: Z2mWizardDeviceStatus;
		if (previewError) {
			status = 'failed';
		} else if (adoptedRecord) {
			status = 'already_registered';
		} else if (previewChannelCount === 0) {
			status = 'unsupported';
		} else {
			status = 'ready';
		}

		return {
			ieeeAddress: z2mDevice.ieeeAddress,
			friendlyName: z2mDevice.friendlyName,
			manufacturer: z2mDevice.definition?.vendor ?? null,
			model: z2mDevice.definition?.model ?? null,
			description: z2mDevice.definition?.description ?? null,
			status,
			categories,
			suggestedCategory,
			previewChannelCount,
			previewChannelIdentifiers,
			registeredDeviceId: adoptedRecord?.id ?? null,
			registeredDeviceName: adoptedRecord?.name ?? null,
			registeredDeviceCategory: adoptedRecord?.category ?? null,
			error: previewError,
			lastSeenAt: new Date().toISOString(),
		};
	}

	async adopt(
		id: string,
		requests: { ieeeAddress: string; name: string; category: DeviceCategory }[],
	): Promise<Z2mWizardAdoptionResult[]> {
		const session = this.sessions.get(id);
		if (!session) return [];
		this.refreshIdleTimer(session);

		// Refresh-before-adopt: rebuild snapshots so we see current registered status.
		const adopted = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
		for (const z2mDevice of this.zigbee2mqttService.getRegisteredDevices()) {
			const refreshed = await this.computeSnapshot(z2mDevice, adopted);
			const existing = session.devices.get(refreshed.ieeeAddress);
			// Preserve already_registered status set by a previous successful adopt() call
			// in this session, even if the underlying findAll didn't pick the record up
			// for some reason. The race-fallback path needs the registeredDeviceId.
			if (existing?.status === 'already_registered' && existing.registeredDeviceId) {
				session.devices.set(refreshed.ieeeAddress, {
					...refreshed,
					status: 'already_registered',
					registeredDeviceId: existing.registeredDeviceId,
					registeredDeviceName: existing.registeredDeviceName,
					registeredDeviceCategory: existing.registeredDeviceCategory,
				});
			} else {
				session.devices.set(refreshed.ieeeAddress, refreshed);
			}
		}

		const results: Z2mWizardAdoptionResult[] = [];

		for (const req of requests) {
			const current = session.devices.get(req.ieeeAddress);

			if (!current) {
				results.push({
					ieeeAddress: req.ieeeAddress,
					name: req.name,
					status: 'failed',
					error: 'Device not in session',
				});
				continue;
			}

			try {
				// Race fallback: device already adopted (either before session start or
				// by an auto-adopt path mid-session). Update name/category instead of creating.
				if (current.status === 'already_registered' && current.registeredDeviceId) {
					await this.devicesService.update(current.registeredDeviceId, {
						type: DEVICES_ZIGBEE2MQTT_TYPE,
						name: req.name,
						category: req.category,
					} as never);

					session.devices.set(req.ieeeAddress, {
						...current,
						registeredDeviceName: req.name,
						registeredDeviceCategory: req.category,
					});

					results.push({
						ieeeAddress: req.ieeeAddress,
						name: req.name,
						status: 'updated',
						error: null,
					});
					continue;
				}

				// Build the AdoptDeviceRequestDto from the device's mapping preview.
				const adoptRequest = await this.buildAdoptRequest(req.ieeeAddress, req.name, req.category);
				const created = await this.deviceAdoptionService.adoptDevice(adoptRequest);

				session.devices.set(req.ieeeAddress, {
					...current,
					status: 'already_registered',
					registeredDeviceId: created.id,
					registeredDeviceName: req.name,
					registeredDeviceCategory: req.category,
				});

				results.push({
					ieeeAddress: req.ieeeAddress,
					name: req.name,
					status: 'created',
					error: null,
				});
			} catch (e) {
				results.push({
					ieeeAddress: req.ieeeAddress,
					name: req.name,
					status: 'failed',
					error: (e as Error).message,
				});
			}
		}

		return results;
	}

	/**
	 * Convert a device's mapping preview into a fully-populated AdoptDeviceRequestDto.
	 * Mirrors the conversion logic in the admin's useDeviceAddFormMultiStep composable
	 * (single-device form). Groups exposes by suggested channel category, skips
	 * 'skipped'/'unmapped' exposes and 'generic' channels, dedupes properties by category
	 * (NOT z2mProperty since multiple props can share one Z2M property like color hue/saturation).
	 */
	private async buildAdoptRequest(
		ieeeAddress: string,
		name: string,
		category: DeviceCategory,
	): Promise<AdoptDeviceRequestDto> {
		const preview = await this.mappingPreviewService.generatePreview(ieeeAddress);

		const channelMap = new Map<string, AdoptChannelDefinitionDto>();
		for (const expose of preview.exposes) {
			if (expose.status === 'skipped' || expose.status === 'unmapped') continue;
			if (!expose.suggestedChannel) continue;
			const channelCategory = expose.suggestedChannel.category;
			// Skip generic channels (admin form does the same — it's a placeholder category)
			if ((channelCategory as string) === 'generic') continue;
			if (!expose.suggestedProperties || expose.suggestedProperties.length === 0) continue;

			let channel = channelMap.get(channelCategory);
			if (!channel) {
				channel = {
					category: channelCategory,
					name: expose.suggestedChannel.name || channelCategory,
					identifier: channelCategory,
					properties: [],
				};
				channelMap.set(channelCategory, channel);
			}

			for (const prop of expose.suggestedProperties) {
				if (channel.properties.find((p) => p.category === prop.category)) continue;
				channel.properties.push({
					category: prop.category,
					z2mProperty: prop.z2mProperty,
					dataType: prop.dataType,
					permissions: prop.permissions,
					format: (prop.format ?? null) as string[] | number[] | null,
				});
			}
		}

		const request = new AdoptDeviceRequestDto();
		request.ieeeAddress = ieeeAddress;
		request.name = name;
		request.category = category;
		request.channels = Array.from(channelMap.values());
		return request;
	}
}
