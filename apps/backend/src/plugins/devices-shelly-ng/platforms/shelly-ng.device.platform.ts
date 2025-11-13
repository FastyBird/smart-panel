import { Injectable, Logger } from '@nestjs/common';

import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { HttpDevicePlatform } from '../../../modules/devices/platforms/http-device.platform';
import { DelegatesManagerService } from '../delegates/delegates-manager.service';
import { DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { DevicesShellyNgNotImplementedException } from '../devices-shelly-ng.exceptions';
import {
	ShellyNgChannelEntity,
	ShellyNgChannelPropertyEntity,
	ShellyNgDeviceEntity,
} from '../entities/devices-shelly-ng.entity';

export type IShellyNgDevicePropertyData = IDevicePropertyData & {
	device: ShellyNgDeviceEntity;
};

@Injectable()
export class ShellyNgDevicePlatform extends HttpDevicePlatform implements IDevicePlatform {
	private readonly logger = new Logger(ShellyNgDevicePlatform.name);

	constructor(private readonly delegatesManagerService: DelegatesManagerService) {
		super();
	}

	getType(): string {
		return DEVICES_SHELLY_NG_TYPE;
	}

	async process({ device, channel, property, value }: IShellyNgDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IShellyNgDevicePropertyData>): Promise<boolean> {
		const device = updates[0].device;

		if (!(device instanceof ShellyNgDeviceEntity)) {
			this.logger.error('[SHELLY NG][PLATFORM] Failed to update device property, invalid device provided');

			return false;
		}

		const byDeviceChannel = new Map<
			string,
			{
				device: ShellyNgDeviceEntity;
				channel: ShellyNgChannelEntity;
				props: Map<string | number, { property: ShellyNgChannelPropertyEntity; value: string | number | boolean }>;
				order: string[];
			}
		>();

		for (const u of updates) {
			const key = `${u.device.id}|${u.channel.id}`;

			let entry = byDeviceChannel.get(key);

			if (!entry) {
				entry = {
					device: u.device,
					channel: u.channel,
					props: new Map(),
					order: [],
				};

				byDeviceChannel.set(key, entry);
			}

			const propId = u.property.id;

			if (!entry.props.has(propId)) {
				entry.order.push(String(propId));
			}

			entry.props.set(propId, { property: u.property, value: u.value });
		}

		const result = new Map<ShellyNgChannelPropertyEntity['id'], boolean>();

		for (const group of byDeviceChannel.values()) {
			const { device, channel, props, order } = group;
			try {
				const ordered = order.map((id) => props.get(id)).filter(Boolean);
				const response = await this.delegatesManagerService.setChannelValue(device, channel, ordered);

				for (const { property } of props.values()) {
					result.set(property.id, response !== false);
				}

				if (response === false) {
					this.logger.error('[SHELLY NG][PLATFORM] Failed to update device property');
				}

				continue;
			} catch (error) {
				if (!(error instanceof DevicesShellyNgNotImplementedException)) {
					const err = error as Error;

					this.logger.error('[SHELLY NG][PLATFORM] Error processing property update', {
						message: err.message,
						stack: err.stack,
					});

					return false;
				}
			}

			try {
				for (const { property, value } of props.values()) {
					const response = await this.delegatesManagerService.setPropertyValue(device, property, value);

					result.set(property.id, response !== false);

					if (response === false) {
						this.logger.error('[SHELLY NG][PLATFORM] Failed to update device property');
					}
				}
			} catch (error) {
				const err = error as Error;

				this.logger.error('[SHELLY NG][PLATFORM] Error processing property update', {
					message: err.message,
					stack: err.stack,
				});

				return false;
			}
		}

		const failed = Array.from(result.values()).filter((success) => !success);

		if (failed.length > 0) {
			this.logger.warn(
				`[SHELLY NG][PLATFORM] Some properties failed to update for device id=${device.id}: ${JSON.stringify(failed)}`,
			);

			return false;
		}

		this.logger.log(`[SHELLY NG][PLATFORM] Successfully processed all property updates for device id=${device.id}`);

		return true;
	}
}
