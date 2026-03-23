import { Injectable, Logger } from '@nestjs/common';

import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import {
	DEVICES_RETERMINAL_TYPE,
	RETERMINAL_CHANNEL_IDENTIFIERS,
	RETERMINAL_SYSFS,
} from '../devices-reterminal.constants';
import { ReTerminalSysfsService } from '../services/reterminal-sysfs.service';

@Injectable()
export class ReTerminalDevicePlatform implements IDevicePlatform {
	private readonly logger = new Logger(ReTerminalDevicePlatform.name);

	constructor(private readonly sysfsService: ReTerminalSysfsService) {}

	getType(): string {
		return DEVICES_RETERMINAL_TYPE;
	}

	async process({ device, channel, property, value }: IDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IDevicePropertyData>): Promise<boolean> {
		for (const { channel, property, value } of updates) {
			try {
				const channelIdentifier = channel.identifier;
				const propertyIdentifier = property.identifier;

				if (
					channelIdentifier === RETERMINAL_CHANNEL_IDENTIFIERS.USR_LED ||
					channelIdentifier === RETERMINAL_CHANNEL_IDENTIFIERS.STA_LED
				) {
					await this.handleIndicatorWrite(channelIdentifier, propertyIdentifier, value);
				} else if (channelIdentifier === RETERMINAL_CHANNEL_IDENTIFIERS.BUZZER) {
					await this.handleBuzzerWrite(propertyIdentifier, value);
				} else {
					this.logger.warn(`Unsupported write to channel: ${channelIdentifier}`);

					return false;
				}
			} catch (error) {
				this.logger.error(`Failed to process property update: ${error}`);

				return false;
			}
		}

		return true;
	}

	private async handleIndicatorWrite(
		channelIdentifier: string,
		propertyIdentifier: string,
		value: string | number | boolean,
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
			if (propertyIdentifier === 'on') {
				const brightness = this.coerceBoolean(value) ? 255 : 0;

				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_GREEN, String(brightness));
			} else if (propertyIdentifier === 'brightness') {
				const brightness = this.coerceNumber(value, 0, 255);

				// Apply brightness to currently active color
				await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_GREEN, String(brightness));
			} else if (propertyIdentifier === 'color') {
				const color = String(value);

				if (color === 'red') {
					await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_RED, '255');
					await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_GREEN, '0');
				} else if (color === 'green') {
					await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_RED, '0');
					await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_GREEN, '255');
				} else if (color === 'off') {
					await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_RED, '0');
					await this.sysfsService.writeFile(RETERMINAL_SYSFS.STA_LED_GREEN, '0');
				}
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

		return Math.max(min, Math.min(max, Math.round(num)));
	}
}
