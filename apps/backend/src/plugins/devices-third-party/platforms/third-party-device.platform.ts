import { validate } from 'class-validator';

import { Injectable, Logger } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { IDevicePlatform, IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { HttpDevicePlatform } from '../../../modules/devices/platforms/http-device.platform';
import { DEVICES_THIRD_PARTY_TYPE, ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';
import { PropertiesUpdateRequestDto } from '../dto/third-party-property-update-request.dto';
import { PropertiesUpdateResponseDto, PropertyUpdateResultDto } from '../dto/third-party-property-update-response.dto';
import { ThirdPartyDeviceEntity } from '../entities/devices-third-party.entity';

export type IThirdPartyDevicePropertyData = IDevicePropertyData & {
	device: ThirdPartyDeviceEntity;
};

@Injectable()
export class ThirdPartyDevicePlatform extends HttpDevicePlatform implements IDevicePlatform {
	private readonly logger = new Logger(ThirdPartyDevicePlatform.name);

	getType(): string {
		return DEVICES_THIRD_PARTY_TYPE;
	}

	async process({ device, channel, property, value }: IThirdPartyDevicePropertyData): Promise<boolean> {
		return this.processBatch([{ device, channel, property, value }]);
	}

	async processBatch(updates: Array<IThirdPartyDevicePropertyData>): Promise<boolean> {
		try {
			const device = updates[0].device;
			const endpoint = device.serviceAddress;

			const payload = {
				properties: updates.map((update) => ({
					device: update.device.id,
					channel: update.channel.id,
					property: update.property.id,
					value: update.value,
				})),
			};

			if (!(await this.validateDto(PropertiesUpdateRequestDto, payload, 'request'))) {
				return false;
			}

			const response = await this.sendCommand(endpoint, payload, 'PUT');

			if (response === false) {
				this.logger.error('[THIRD-PARTY][PLATFORM] Failed to update device property');

				return false;
			} else if (response.status === 204) {
				this.logger.log('[THIRD-PARTY][PLATFORM] Successfully updated properties');

				return true;
			} else if (response.status === 207) {
				const responseBody = (await response.json()) as unknown;

				if (!(await this.validateDto(PropertiesUpdateResponseDto, responseBody, 'response'))) {
					return false;
				}

				const responseDto = toInstance(PropertiesUpdateResponseDto, responseBody);

				const failedProperties = responseDto.properties.filter(
					(p: PropertyUpdateResultDto) => p.status != ThirdPartyPropertiesUpdateStatus.SUCCESS,
				);

				if (failedProperties.length > 0) {
					this.logger.warn(
						`[THIRD-PARTY][PLATFORM] Some properties failed to update for device id=${device.id}: ${JSON.stringify(failedProperties)}`,
					);

					return false;
				}

				this.logger.log(
					`[THIRD-PARTY][PLATFORM] Successfully processed all property updates for device id=${device.id}`,
				);

				return true;
			}

			this.logger.error(`[THIRD-PARTY][PLATFORM] Unexpected response status=${response.status} id=${device.id}`);

			return false;
		} catch (error) {
			const err = error as Error;

			this.logger.error('[THIRD-PARTY][PLATFORM] Error processing property update', {
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
				`[THIRD-PARTY][PLATFORM] ${context === 'request' ? 'Request payload' : 'Response body'} validation failed error=${JSON.stringify(errors)}`,
			);

			return false;
		}

		return true;
	}
}
