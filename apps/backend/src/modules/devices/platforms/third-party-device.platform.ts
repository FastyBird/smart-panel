import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Injectable, Logger } from '@nestjs/common';

import { ThirdPartyPropertiesUpdateStatusEnum } from '../devices.constants';
import { PropertiesUpdateRequestDto } from '../dto/third-party-property-update-request.dto';
import { PropertiesUpdateResponseDto, PropertyUpdateResultDto } from '../dto/third-party-property-update-response.dto';
import { ThirdPartyDeviceEntity } from '../entities/devices.entity';

import { IDevicePlatform, IDevicePropertyData } from './device.platform';
import { HttpDevicePlatform } from './http-device.platform';

export type IThirdPartyDevicePropertyData = IDevicePropertyData & {
	device: ThirdPartyDeviceEntity;
};

@Injectable()
export class ThirdPartyDevicePlatform extends HttpDevicePlatform implements IDevicePlatform {
	private readonly logger = new Logger(ThirdPartyDevicePlatform.name);

	getType(): string {
		return 'third-party';
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
				this.logger.error('[THIRD-PARTY DEVICE] Failed to update device property');

				return false;
			} else if (response.status === 204) {
				this.logger.log('[THIRD-PARTY DEVICE] Successfully updated properties');

				return true;
			} else if (response.status === 207) {
				const responseBody = (await response.json()) as unknown;

				if (!(await this.validateDto(PropertiesUpdateResponseDto, responseBody, 'response'))) {
					return false;
				}

				const responseDto = plainToInstance(PropertiesUpdateResponseDto, responseBody, {
					excludeExtraneousValues: true,
				});

				const failedProperties = responseDto.properties.filter(
					(p: PropertyUpdateResultDto) => p.status != ThirdPartyPropertiesUpdateStatusEnum.SUCCESS,
				);

				if (failedProperties.length > 0) {
					this.logger.warn(
						`[THIRD-PARTY DEVICE] Some properties failed to update for device id=${device.id}: ${JSON.stringify(failedProperties)}`,
					);

					return false;
				}

				this.logger.log(`[THIRD-PARTY DEVICE] Successfully processed all property updates for device id=${device.id}`);

				return true;
			}

			this.logger.error(`[THIRD-PARTY DEVICE] Unexpected response status=${response.status} id=${device.id}`);

			return false;
		} catch (error) {
			const err = error as Error;

			this.logger.error('[THIRD-PARTY DEVICE] Error processing property update', {
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
		const instance = plainToInstance(dtoClass, data, { excludeExtraneousValues: true });

		const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });

		if (errors.length > 0) {
			this.logger.error(
				`[THIRD-PARTY DEVICE] ${context === 'request' ? 'Request payload' : 'Response body'} validation failed error=${JSON.stringify(errors)}`,
			);

			return false;
		}

		return true;
	}
}
