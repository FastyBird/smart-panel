import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelCategory, PermissionType } from '../../../modules/devices/devices.constants';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { HttpDevicePlatform } from '../../../modules/devices/platforms/http-device.platform';
import {
	DEVICES_THIRD_PARTY_PLUGIN_NAME,
	DEVICES_THIRD_PARTY_TYPE,
	ThirdPartyPropertiesUpdateStatus,
} from '../devices-third-party.constants';
import { ReqUpdatePropertiesDto } from '../dto/third-party-property-update-request.dto';
import {
	PropertiesUpdateResultModel,
	PropertyUpdateResultModel,
} from '../dto/third-party-property-update-response.dto';
import { ThirdPartyDeviceEntity } from '../entities/devices-third-party.entity';

export type IThirdPartyDevicePropertyData = IDevicePropertyData & {
	device: ThirdPartyDeviceEntity;
};

@Injectable()
export class ThirdPartyDevicePlatform extends HttpDevicePlatform implements IDevicePlatform {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_THIRD_PARTY_PLUGIN_NAME,
		'ThirdPartyDevicePlatform',
	);

	getType(): string {
		return DEVICES_THIRD_PARTY_TYPE;
	}

	async process({ device, channel, property, value }: IThirdPartyDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IThirdPartyDevicePropertyData>): Promise<boolean> {
		try {
			// Filter out non-actuator / non-writable / event-only properties so they are never sent as actuator commands
			const validUpdates = updates.filter((update) => {
				const permissions = update.property.permissions ?? [];
				const isWritable =
					permissions.includes(PermissionType.READ_WRITE) || permissions.includes(PermissionType.WRITE_ONLY);
				const isEventOnly = permissions.includes(PermissionType.EVENT_ONLY);
				const isInputChannel = [ChannelCategory.BUTTON, ChannelCategory.BINARY_INPUT].includes(update.channel.category);

				if (isEventOnly || !isWritable || isInputChannel) {
					this.logger.warn(
						`Refusing to dispatch actuator command for non-actuator/event-only property id=${update.property.id} on channel=${update.channel.id}`,
						{ resource: update.device.id },
					);

					return false;
				}

				return true;
			});

			if (validUpdates.length === 0) {
				return true;
			}

			const device = validUpdates[0].device;
			const endpoint = device.serviceAddress;

			const payload = {
				properties: validUpdates.map((update) => ({
					device: update.device.id,
					channel: update.channel.id,
					property: update.property.id,
					value: update.value,
				})),
			};

			if (!(await this.validateDto(ReqUpdatePropertiesDto, payload, 'request'))) {
				return false;
			}

			const response = await this.sendCommand(endpoint, payload, 'PUT');

			if (response === false) {
				this.logger.error('Failed to update device property');

				return false;
			} else if (response.status === 204) {
				this.logger.log('Successfully updated properties', { resource: device.id });

				return true;
			} else if (response.status === 207) {
				const responseBody = (await response.json()) as unknown;

				if (!(await this.validateDto(PropertiesUpdateResultModel, responseBody, 'response'))) {
					return false;
				}

				const responseModel = toInstance(PropertiesUpdateResultModel, responseBody);

				const failedProperties = responseModel.properties.filter(
					(p: PropertyUpdateResultModel) => p.status !== ThirdPartyPropertiesUpdateStatus.SUCCESS,
				);

				if (failedProperties.length > 0) {
					this.logger.warn(
						`Some properties failed to update for device id=${device.id}: ${JSON.stringify(failedProperties)}`,
						{ resource: device.id },
					);

					return false;
				}

				this.logger.log(`Successfully processed all property updates for device id=${device.id}`, {
					resource: device.id,
				});

				return true;
			}

			this.logger.error(`Unexpected response status=${response.status} id=${device.id}`, { resource: device.id });

			return false;
		} catch (error) {
			const err = error as Error;
			const device = updates[0]?.device;

			this.logger.error('Error processing property update', {
				...(device ? { resource: device.id } : {}),
				message: err.message,
				stack: err.stack,
			});

			return false;
		}
	}

	private async validateDto<T extends object>(
		dtoClass: new () => T,
		data: unknown,
		context: 'request' | 'response',
	): Promise<boolean> {
		const instance = toInstance(dtoClass, data, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(instance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(
				`${context === 'request' ? 'Request payload' : 'Response body'} validation failed error=${JSON.stringify(errors)}`,
			);

			return false;
		}

		return true;
	}
}
