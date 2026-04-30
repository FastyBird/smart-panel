import { randomUUID } from 'crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } from '../devices-zigbee2mqtt.constants';

import { Z2mDeviceAdoptionService } from './device-adoption.service';
import { Z2mMappingPreviewService } from './mapping-preview.service';
import { Zigbee2mqttService } from './zigbee2mqtt.service';

export type Z2mWizardDeviceStatus = 'ready' | 'unsupported' | 'already_registered' | 'failed';

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

		await this.populateInitialDevices(session);

		session.unsubscribeJoined = this.zigbee2mqttService.subscribeToDeviceJoined((device) => {
			void this.handleDeviceJoined(session, device);
		});

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

		await this.disablePermitJoinInternal(session);

		session.unsubscribeJoined?.();

		if (session.idleTimer) {
			clearTimeout(session.idleTimer);
		}

		this.sessions.delete(id);
	}

	async onModuleDestroy(): Promise<void> {
		for (const session of this.sessions.values()) {
			await this.disablePermitJoinInternal(session);

			session.unsubscribeJoined?.();

			if (session.idleTimer) {
				clearTimeout(session.idleTimer);
			}
		}

		this.sessions.clear();
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

	// populateInitialDevices, handleDeviceJoined — implemented in Task 6
	private async populateInitialDevices(_session: Z2mWizardSession): Promise<void> {
		// Implemented in Task 6
		await Promise.resolve();
	}

	private async handleDeviceJoined(_session: Z2mWizardSession, _device: unknown): Promise<void> {
		// Implemented in Task 6
		await Promise.resolve();
	}

	// enablePermitJoin, disablePermitJoin — implemented in Task 7
	// adopt — implemented in Task 8
}
