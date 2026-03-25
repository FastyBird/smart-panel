import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	DEVICES_RETERMINAL_PLUGIN_NAME,
	DEVICES_RETERMINAL_TYPE,
	RETERMINAL_CHANNEL_IDENTIFIERS,
	RETERMINAL_SYSFS,
	ReTerminalVariant,
} from '../devices-reterminal.constants';
import { ReTerminalDeviceEntity } from '../entities/devices-reterminal.entity';
import { ReTerminalSysfsService } from '../services/reterminal-sysfs.service';

@Injectable()
export class ReTerminalDevicePlatform implements IDevicePlatform {
	private readonly logger = createExtensionLogger(DEVICES_RETERMINAL_PLUGIN_NAME, ReTerminalDevicePlatform.name);

	// Track the last active STA LED color so it can be restored after off→on
	private lastStaColor: 'green' | 'red' = 'green';

	constructor(private readonly sysfsService: ReTerminalSysfsService) {}

	getType(): string {
		return DEVICES_RETERMINAL_TYPE;
	}

	async process({ device, channel, property, value }: IDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IDevicePropertyData>): Promise<boolean> {
		let allSucceeded = true;

		for (const { device, channel, property, value } of updates) {
			try {
				const channelIdentifier = channel.identifier;
				const propertyIdentifier = property.identifier;
				const variant = (device as ReTerminalDeviceEntity).variant ?? null;

				if (
					channelIdentifier === RETERMINAL_CHANNEL_IDENTIFIERS.USR_LED ||
					channelIdentifier === RETERMINAL_CHANNEL_IDENTIFIERS.STA_LED
				) {
					await this.handleIndicatorWrite(channelIdentifier, propertyIdentifier, value, variant);
				} else if (channelIdentifier === RETERMINAL_CHANNEL_IDENTIFIERS.BUZZER) {
					await this.handleBuzzerWrite(propertyIdentifier, value);
				} else {
					this.logger.warn(`Unsupported write to channel: ${channelIdentifier}`);
					allSucceeded = false;
				}
			} catch (error) {
				this.logger.error(`Failed to process property update: ${error}`);
				allSucceeded = false;
			}
		}

		return allSucceeded;
	}

	private async handleIndicatorWrite(
		channelIdentifier: string,
		propertyIdentifier: string,
		value: string | number | boolean,
		variant: ReTerminalVariant | null,
	): Promise<void> {
		if (channelIdentifier === RETERMINAL_CHANNEL_IDENTIFIERS.USR_LED) {
			if (propertyIdentifier === 'on') {
				const brightness = this.coerceBoolean(value) ? 255 : 0;

				await this.sysfsService.writeFile(RETERMINAL_SYSFS.USR_LED, String(brightness));
			} else if (propertyIdentifier === 'brightness') {
				const brightness = this.coerceNumber(value, 0, 255);

				await this.sysfsService.writeFile(RETERMINAL_SYSFS.USR_LED, String(brightness));
			}
		} else if (channelIdentifier === RETERMINAL_CHANNEL_IDENTIFIERS.STA_LED) {
			if (variant === ReTerminalVariant.RETERMINAL_DM) {
				// DM has a single status LED — only 'on' property is supported
				if (propertyIdentifier === 'on') {
					const brightness = this.coerceBoolean(value) ? 255 : 0;

					await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_DM, String(brightness));
				}
			} else {
				// CM4 has separate green/red LED channels
				await this.handleStaLedCm4Write(propertyIdentifier, value);
			}
		}
	}

	private async handleStaLedCm4Write(propertyIdentifier: string, value: string | number | boolean): Promise<void> {
		if (propertyIdentifier === 'on') {
			if (this.coerceBoolean(value)) {
				// Restore the last known color (tracked in memory — sysfs reads 0 after off)
				if (this.lastStaColor === 'red') {
					await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_RED, '255');
				} else {
					await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_GREEN, '255');
				}
			} else {
				// Turn off both channels
				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_GREEN, '0');
				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_RED, '0');
			}
		} else if (propertyIdentifier === 'brightness') {
			const brightness = this.coerceNumber(value, 0, 255);

			// Apply brightness to the last known active color channel
			if (this.lastStaColor === 'red') {
				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_RED, String(brightness));
			} else {
				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_GREEN, String(brightness));
			}
		} else if (propertyIdentifier === 'color') {
			const color = String(value);

			if (color === 'red') {
				this.lastStaColor = 'red';
				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_RED, '255');
				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_GREEN, '0');
			} else if (color === 'green') {
				this.lastStaColor = 'green';
				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_RED, '0');
				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_GREEN, '255');
			} else if (color === 'off') {
				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_RED, '0');
				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_GREEN, '0');
			}
		}
	}

	private async handleBuzzerWrite(propertyIdentifier: string, value: string | number | boolean): Promise<void> {
		if (propertyIdentifier === 'on') {
			const brightness = this.coerceBoolean(value) ? 255 : 0;

			await this.sysfsService.writeFile(RETERMINAL_SYSFS.BUZZER, String(brightness));
		}
	}

	private coerceBoolean(value: string | number | boolean): boolean {
		if (typeof value === 'boolean') return value;
		if (typeof value === 'number') return value !== 0;

		return value === 'true' || value === '1';
	}

	private coerceNumber(value: string | number | boolean, min: number, max: number): number {
		const num = typeof value === 'number' ? value : Number(value);

		if (Number.isNaN(num)) {
			this.logger.warn(`coerceNumber received non-numeric value: ${String(value)}, defaulting to ${min}`);

			return min;
		}

		return Math.max(min, Math.min(max, Math.round(num)));
	}
}
