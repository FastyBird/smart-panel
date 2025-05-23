import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
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
import { HomeAssistantConfigModel } from '../models/config.model';

export type IHomeAssistantDevicePropertyData = IDevicePropertyData & {
	device: HomeAssistantDeviceEntity;
};

@Injectable()
export class HomeAssistantDevicePlatform extends HttpDevicePlatform implements IDevicePlatform {
	private readonly logger = new Logger(HomeAssistantDevicePlatform.name);

	private pluginConfig: HomeAssistantConfigModel | null = null;

	constructor(
		private readonly configService: ConfigService,
		private readonly mapperService: MapperService,
	) {
		super();
	}

	getType(): string {
		return DEVICES_HOME_ASSISTANT_TYPE;
	}

	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	handleConfigurationUpdatedEvent() {
		this.pluginConfig = null;
	}

	async process({ device, channel, property, value }: IHomeAssistantDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IHomeAssistantDevicePropertyData>): Promise<boolean> {
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
				const endpoint = `${this.baseUrl}/api/services/${setState.domain}/${setState.service}`;

				const payload = {
					entity_id: setState.entityId,
					...(setState.attributes ? Object.fromEntries(setState.attributes) : []),
				};

				if (!(await this.validateDto(ServiceRequestDto, payload))) {
					return false;
				}

				const response = await this.sendCommand(endpoint, payload, 'POST', 3, {
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						'Content-Type': 'application/json',
					},
				});

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

				return false;
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

	private get config(): HomeAssistantConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<HomeAssistantConfigModel>(
				DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
			);
		}

		return this.pluginConfig;
	}

	private get apiKey(): string {
		return this.config.apiKey;
	}

	private get hostname(): string {
		return this.config.hostname;
	}

	private get baseUrl(): string {
		return `http://${this.hostname}`;
	}
}
