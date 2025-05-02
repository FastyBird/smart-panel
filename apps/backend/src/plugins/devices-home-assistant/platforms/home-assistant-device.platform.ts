import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Injectable, Logger } from '@nestjs/common';

import { ConfigService } from '../../../modules/config/services/config.service';
import { ChannelPropertyEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { HttpDevicePlatform } from '../../../modules/devices/platforms/http-device.platform';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import { ServiceRequestDto } from '../dto/home-assistant-service-request.dto';
import { HomeAssistantConfigEntity } from '../entities/config-home-assistant.entity';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';
import { HomeAssistantServiceResolver } from '../utils/service-resolver.utils';
import { HomeAssistantValueTransformer } from '../utils/value-transformer.utils';

export type IHomeAssistantDevicePropertyData = IDevicePropertyData & {
	device: HomeAssistantDeviceEntity;
};

@Injectable()
export class HomeAssistantDevicePlatform extends HttpDevicePlatform implements IDevicePlatform {
	private readonly logger = new Logger(HomeAssistantDevicePlatform.name);

	constructor(private readonly configService: ConfigService) {
		super();
	}

	getType(): string {
		return DEVICES_HOME_ASSISTANT_TYPE;
	}

	async process({ device, channel, property, value }: IHomeAssistantDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IHomeAssistantDevicePropertyData>): Promise<boolean> {
		const pluginConfiguration = this.configService.getPluginConfig<HomeAssistantConfigEntity>(
			DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		);

		const device = updates[0].device;

		if (!(device instanceof HomeAssistantDeviceEntity)) {
			this.logger.error('[HOME ASSISTANT DEVICE] Failed to update device property, invalid device provided');

			return false;
		}

		const channels = Array.from(
			new Map(
				updates
					.map((update) => update.channel)
					.filter((channel): channel is HomeAssistantChannelEntity => channel instanceof HomeAssistantChannelEntity)
					.map((channel) => [channel.id, channel]),
			).values(),
		);

		if (channels.length === 0) {
			this.logger.error('[HOME ASSISTANT DEVICE] Failed to update device property, no channels found');

			return false;
		}

		const values = updates.reduce<Record<string, string | number | boolean>>((acc, update) => {
			acc[update.property.id] = update.value;

			return acc;
		}, {});

		const result = new Map<ChannelPropertyEntity['id'], boolean>();

		for (const channel of channels) {
			const attributeProperties = channel.properties.filter(
				(property): property is HomeAssistantChannelPropertyEntity =>
					property instanceof HomeAssistantChannelPropertyEntity && property.haAttribute !== null,
			);

			const propsToUpdate = channel.properties.filter((prop) => prop.id in values);

			const service = HomeAssistantServiceResolver.resolveBatch(
				channel.haDomain,
				propsToUpdate.map((prop) => ({
					category: prop.category,
					value: values[prop.id],
				})),
			);

			try {
				const endpoint = `http://${pluginConfiguration.hostname}/api/services/${channel.haDomain}/${service}`;

				const payload = {
					entity_id: channel.haEntityId,
					...attributeProperties.reduce<Record<string, string | number | boolean>>((acc, property) => {
						acc[property.haAttribute] = HomeAssistantValueTransformer.toHa(
							property.haAttribute,
							property.id in values ? values[property.id] : property.value,
						);

						return acc;
					}, {}),
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
