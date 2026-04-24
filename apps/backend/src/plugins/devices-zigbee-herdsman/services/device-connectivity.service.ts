import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DeviceConnectivityService as CoreDeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEFAULT_BATTERY_DEVICE_TIMEOUT,
	DEFAULT_MAINS_DEVICE_TIMEOUT,
	DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
	DEVICES_ZIGBEE_HERDSMAN_TYPE,
} from '../devices-zigbee-herdsman.constants';
import { ZigbeeHerdsmanDeviceEntity } from '../entities/devices-zigbee-herdsman.entity';
import { ZigbeeHerdsmanConfigModel } from '../models/config.model';

import { ZigbeeHerdsmanAdapterService } from './zigbee-herdsman-adapter.service';

@Injectable()
export class ZhDeviceConnectivityService implements OnModuleDestroy {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
		'ConnectivityService',
	);

	private checkInterval: ReturnType<typeof setInterval> | null = null;
	// Track the last state we wrote to the DB to avoid repeated writes.
	private lastDbState: Map<string, boolean> = new Map();

	constructor(
		private readonly adapterService: ZigbeeHerdsmanAdapterService,
		private readonly devicesService: DevicesService,
		private readonly configService: ConfigService,
		private readonly coreConnectivityService: CoreDeviceConnectivityService,
	) {}

	startMonitoring(): void {
		if (this.checkInterval) {
			return;
		}

		// Check every 60 seconds
		this.checkInterval = setInterval(() => {
			void this.checkConnectivity();
		}, 60_000);

		this.logger.debug('Device connectivity monitoring started');
	}

	stopMonitoring(): void {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
		}
		this.lastDbState.clear();
	}

	onModuleDestroy(): void {
		this.stopMonitoring();
	}

	async checkConnectivity(): Promise<void> {
		try {
			const config = this.configService.getPluginConfig<ZigbeeHerdsmanConfigModel>(DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME);
			const mainsTimeout = config?.discovery?.mainsDeviceTimeout ?? DEFAULT_MAINS_DEVICE_TIMEOUT;
			const batteryTimeout = config?.discovery?.batteryDeviceTimeout ?? DEFAULT_BATTERY_DEVICE_TIMEOUT;
			const now = Date.now();

			const discoveredDevices = this.adapterService.getDiscoveredDevices();

			// Collect IEEE addresses that need a DB state update
			const updates: { ieeeAddress: string; online: boolean }[] = [];

			for (const discovered of discoveredDevices) {
				let isOnline: boolean;

				if (!discovered.lastSeen) {
					// Device was registered with available=true but has never sent a message.
					// Treat as offline — it should report in before we consider it reachable.
					isOnline = false;
				} else {
					const isBattery = discovered.powerSource?.toLowerCase().includes('battery');
					const timeout = isBattery ? batteryTimeout : mainsTimeout;
					const elapsed = (now - discovered.lastSeen.getTime()) / 1000;
					isOnline = elapsed < timeout;
				}

				const lastWritten = this.lastDbState.get(discovered.ieeeAddress);
				if (lastWritten !== isOnline) {
					if (!isOnline) {
						this.logger.debug(`Device ${discovered.ieeeAddress} went offline`);
					} else {
						this.logger.debug(`Device ${discovered.ieeeAddress} came back online`);
					}
					// Don't update lastDbState here — only after successful DB write
					updates.push({ ieeeAddress: discovered.ieeeAddress, online: isOnline });
				}
			}

			if (updates.length === 0) {
				return;
			}

			// Single DB query for all adopted devices, then match by IEEE address
			const adoptedDevices =
				await this.devicesService.findAll<ZigbeeHerdsmanDeviceEntity>(DEVICES_ZIGBEE_HERDSMAN_TYPE);
			const deviceByIeee = new Map(adoptedDevices.map((d) => [d.ieeeAddress, d]));

			for (const { ieeeAddress, online } of updates) {
				const device = deviceByIeee.get(ieeeAddress);
				if (device) {
					try {
						await this.coreConnectivityService.setConnectionState(device.id, {
							state: online ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
						});
						// Only mark as persisted after successful write
						this.lastDbState.set(ieeeAddress, online);
					} catch (error) {
						const err = error as Error;
						this.logger.error(`Failed to update connection state for ${ieeeAddress}: ${err.message}`);
						// Don't update lastDbState — will retry on next cycle
					}
				}
			}
		} catch (error) {
			const err = error as Error;
			this.logger.error(`Connectivity check failed: ${err.message}`);
		}
	}
}
