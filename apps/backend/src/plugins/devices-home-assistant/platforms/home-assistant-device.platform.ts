import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { HttpDevicePlatform } from '../../../modules/devices/platforms/http-device.platform';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import { ServiceRequestDto } from '../dto/home-assistant-service-request.dto';
import {
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { MapperService } from '../mappers/mapper.service';
import { HomeAssistantConfigModel } from '../models/config-home-assistant.model';

export type IHomeAssistantDevicePropertyData = IDevicePropertyData & {
	device: HomeAssistantDeviceEntity;
};

@Injectable()
export class HomeAssistantDevicePlatform extends HttpDevicePlatform implements IDevicePlatform {
	private readonly logger = new Logger(HomeAssistantDevicePlatform.name);

	constructor(
		private readonly configService: ConfigService,
		private readonly mapperService: MapperService,
	) {
		super();
	}

	getType(): string {
		return DEVICES_HOME_ASSISTANT_TYPE;
	}

	async process({ device, channel, property, value }: IHomeAssistantDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IHomeAssistantDevicePropertyData>): Promise<boolean> {
		const pluginConfiguration = this.configService.getPluginConfig<HomeAssistantConfigModel>(
			DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		);

		const device = updates[0].device;

		if (!(device instanceof HomeAssistantDeviceEntity)) {
			this.logger.error('[HOME ASSISTANT DEVICE] Failed to update device property, invalid device provided');

			return false;
		}

		const values = new Map<HomeAssistantChannelPropertyEntity['id'], string | number | boolean>();

		for (const { property, value } of updates) {
			values.set(property.id, value);
		}

		const setStates = await this.mapperService.mapToHA(device, values);

		if (setStates.length === 0) {
			this.logger.error('[HOME ASSISTANT DEVICE] Failed to update device property, no payload to send');

			return false;
		}

		const result = new Map<ChannelPropertyEntity['id'], boolean>();

		for (const setState of setStates) {
			const propsToUpdate = setState.properties;

			try {
				const endpoint = `http://${pluginConfiguration.hostname}/api/services/${setState.domain}/${setState.service}`;

				const payload = {
					entity_id: setState.entityId,
					state: setState.state,
					...setState.attributes,
				};

				if (!(await this.validateDto(ServiceRequestDto, payload))) {
					return false;
				}

				const response = await this.sendCommand(endpoint, payload, 'POST');

				propsToUpdate.forEach((prop) => {
					result.set(prop.id, response !== false);
				});

				if (response === false) {
					this.logger.error('[HOME ASSISTANT DEVICE] Failed to update device property');
				}
			} catch (error) {
				const err = error as Error;

				this.logger.error('[HOME ASSISTANT DEVICE] Error processing property update', {
					message: err.message,
					stack: err.stack,
				});

				propsToUpdate.forEach((prop) => {
					result.set(prop.id, false);
				});
			}
		}

		const failed = Array.from(result.values()).filter((success) => !success);

		if (failed.length > 0) {
			this.logger.warn(
				`[HOME ASSISTANT DEVICE] Some properties failed to update for device id=${device.id}: ${JSON.stringify(failed)}`,
			);

			return false;
		}

		this.logger.log(`[HOME ASSISTANT DEVICE] Successfully processed all property updates for device id=${device.id}`);

		return true;
	}

	private async validateDto<T extends object>(dtoClass: new () => T, data: unknown): Promise<boolean> {
		const instance = plainToInstance(dtoClass, data, { excludeExtraneousValues: true });

		const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

		if (errors.length > 0) {
			this.logger.error(`[HOME ASSISTANT DEVICE] Request payload validation failed error=${JSON.stringify(errors)}`);

			return false;
		}

		return true;
	}
}
