/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { PermissionType } from '../../../modules/devices/devices.constants';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	DEFAULT_COMMAND_RETRIES,
	DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
	DEVICES_ZIGBEE_HERDSMAN_TYPE,
} from '../devices-zigbee-herdsman.constants';
import { ZigbeeHerdsmanDeviceEntity } from '../entities/devices-zigbee-herdsman.entity';
import { ZigbeeHerdsmanConfigModel } from '../models/config.model';
import { ZigbeeHerdsmanAdapterService } from '../services/zigbee-herdsman-adapter.service';

@Injectable()
export class ZigbeeHerdsmanDevicePlatform implements IDevicePlatform {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME,
		'DevicePlatform',
	);

	constructor(
		private readonly adapterService: ZigbeeHerdsmanAdapterService,
		private readonly configService: ConfigService,
	) {}

	getType(): string {
		return DEVICES_ZIGBEE_HERDSMAN_TYPE;
	}

	async process({ device, channel, property, value }: IDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IDevicePropertyData>): Promise<boolean> {
		if (!this.adapterService.isStarted()) {
			this.logger.warn('Adapter not started, cannot process commands');
			return false;
		}

		const config = this.getConfig();
		const retries = config?.discovery?.commandRetries ?? DEFAULT_COMMAND_RETRIES;

		// Group updates by device IEEE address
		const deviceUpdates = new Map<string, { ieeeAddress: string; payload: Record<string, unknown> }>();

		for (const update of updates) {
			const zhDevice = update.device as ZigbeeHerdsmanDeviceEntity;
			const ieeeAddress = zhDevice.ieeeAddress;

			if (!ieeeAddress) {
				this.logger.warn(`Device ${update.device.id} has no IEEE address`);
				continue;
			}

			// Skip read-only properties — they have no toZigbee converter
			const isWritable = update.property.permissions?.some(
				(p) => p === PermissionType.READ_WRITE || p === PermissionType.WRITE_ONLY,
			);
			if (!isWritable) {
				this.logger.debug(`Skipping read-only property ${update.property.identifier} on device ${ieeeAddress}`);
				continue;
			}

			// Use the property identifier as the payload key. During adoption,
			// identifier is set to the zigbee expose property name (e.g. 'brightness',
			// 'state'), which is what toZigbee converters expect in their key arrays.
			const payloadKey = update.property.identifier;
			if (!payloadKey) {
				this.logger.warn(`Property ${update.property.id} has no identifier`);
				continue;
			}

			const existing = deviceUpdates.get(ieeeAddress) ?? { ieeeAddress, payload: {} };
			// Convert Smart Panel property values to zigbee-herdsman-converters format.
			// The toZigbee converters expect specific value formats that may differ from
			// how the Smart Panel stores them (e.g. state: "ON"/"OFF" not true/false).
			existing.payload[payloadKey] = this.convertValueForZigbee(payloadKey, update.value);
			deviceUpdates.set(ieeeAddress, existing);
		}

		let success = true;

		for (const [ieeeAddress, { payload }] of deviceUpdates) {
			// Re-check adapter state per device — it may have disconnected asynchronously
			if (!this.adapterService.isStarted()) {
				this.logger.warn('Adapter disconnected during batch processing');
				return false;
			}

			const discovered = this.adapterService.getDiscoveredDevice(ieeeAddress);
			if (!discovered?.definition) {
				this.logger.warn(`No device definition for ${ieeeAddress}, skipping command`);
				success = false;
				continue;
			}

			// Get the actual zigbee-herdsman Device and its first endpoint for ZCL commands
			const herdsmanDevice = this.adapterService.getHerdsmanDevice(ieeeAddress);
			if (!herdsmanDevice) {
				this.logger.warn(`Herdsman device not found for ${ieeeAddress}`);
				success = false;
				continue;
			}

			// Use getEndpoint(1) for the primary application endpoint (ID 1, standard in most Zigbee devices).
			// Fallback: search the endpoints array by ID property, since array index !== endpoint ID.
			const endpoint =
				herdsmanDevice.getEndpoint?.(1) ??
				herdsmanDevice.endpoints?.find((ep: { ID: number }) => ep.ID === 1) ??
				herdsmanDevice.endpoints?.[0] ??
				null;

			if (!endpoint) {
				this.logger.warn(`No endpoint found for device ${ieeeAddress}`);
				success = false;
				continue;
			}

			// Use toZigbee converters to send commands.
			// Track consumed keys so each key is only handled by the first matching converter.
			const consumedKeys = new Set<string>();

			for (const converter of discovered.definition.toZigbee as any[]) {
				if (typeof converter?.convertSet !== 'function') {
					continue;
				}

				const matchingKeys = Object.keys(payload).filter(
					(key) => !consumedKeys.has(key) && converter.key?.includes(key),
				);
				if (matchingKeys.length === 0) {
					continue;
				}

				// Send each key individually so a failure on one doesn't re-send others on retry.
				for (const key of matchingKeys) {
					let keySent = false;

					for (let attempt = 1; attempt <= retries; attempt++) {
						try {
							const meta = {
								device: herdsmanDevice,
								state: payload,
								logger: this.logger,
								options: {},
							};

							await converter.convertSet(endpoint, key, payload[key], meta);
							keySent = true;
							break; // Success for this key
						} catch (error) {
							const err = error as Error;
							if (attempt === retries) {
								this.logger.error(`Failed to send command to ${ieeeAddress} after ${retries} attempts: ${err.message}`);
								success = false;
							} else {
								// Exponential backoff: 250ms, 500ms, 1000ms, ...
								const delayMs = 250 * Math.pow(2, attempt - 1);
								this.logger.debug(
									`Command attempt ${attempt}/${retries} failed for ${ieeeAddress}, retrying in ${delayMs}ms...`,
								);
								await new Promise((resolve) => setTimeout(resolve, delayMs));
							}
						}
					}

					if (keySent) {
						consumedKeys.add(key);
					}
				}
			}
			// Warn about payload keys that no converter handled
			const unconsumed = Object.keys(payload).filter((key) => !consumedKeys.has(key));
			if (unconsumed.length > 0) {
				this.logger.warn(
					`No toZigbee converter found for properties [${unconsumed.join(', ')}] on device ${ieeeAddress}`,
				);
				success = false;
			}
		}

		return success;
	}

	private getConfig(): ZigbeeHerdsmanConfigModel | null {
		try {
			return this.configService.getPluginConfig<ZigbeeHerdsmanConfigModel>(DEVICES_ZIGBEE_HERDSMAN_PLUGIN_NAME);
		} catch {
			return null;
		}
	}

	/**
	 * Convert Smart Panel property values to the format expected by toZigbee converters.
	 * zigbee-herdsman-converters expect specific value types that may differ from how
	 * the Smart Panel stores/transmits them.
	 */
	private convertValueForZigbee(key: string, value: string | number | boolean): string | number | boolean {
		// Boolean-typed properties: toZigbee converters typically expect string values
		// (e.g. "ON"/"OFF" for state, "LOCK"/"UNLOCK" for lock_state)
		if (typeof value === 'boolean') {
			return value ? 'ON' : 'OFF';
		}

		// String boolean aliases
		if (typeof value === 'string') {
			const upper = value.toUpperCase();
			if (upper === 'TRUE') return 'ON';
			if (upper === 'FALSE') return 'OFF';
		}

		return value;
	}
}
