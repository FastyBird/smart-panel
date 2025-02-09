import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ChannelsService } from '../../devices/services/channels.service';
import { DevicesService } from '../../devices/services/devices.service';

@Injectable()
@ValidatorConstraint({ name: 'DeviceChannelExistsValidation', async: false })
export class DeviceChannelExistsConstraintValidator implements ValidatorConstraintInterface {
	constructor(
		private readonly deviceService: DevicesService,
		private readonly channelService: ChannelsService,
	) {}

	async validate(channelId: string | undefined, args: ValidationArguments): Promise<boolean> {
		if (!channelId) return false; // Prevent empty values

		const dto = args.object as Record<string, unknown>;

		// Get the `device` property from the DTO object
		const deviceId = typeof dto?.device === 'string' ? dto.device : undefined;

		if (!deviceId) {
			// Check if the channel exists
			const channelExists = await this.channelService.findOne(channelId);

			return !!channelExists;
		}

		// Check if the device exists
		const deviceExists = await this.deviceService.findOne(deviceId);
		if (!deviceExists) return false;

		// Check if the channel exists and belongs to the device
		const channelExists = await this.channelService.findOne(channelId, deviceId);

		return !!channelExists;
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"${args.property.charAt(0).toUpperCase() + args.property.slice(1)} does not exist or does not belong to the specified device."}]`;
	}
}

export const ValidateDeviceChannelExists = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'ValidateDeviceChannelExists',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: DeviceChannelExistsConstraintValidator,
		});
	};
};
