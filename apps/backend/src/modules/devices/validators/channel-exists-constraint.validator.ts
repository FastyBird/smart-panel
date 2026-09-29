import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ChannelsService } from '../services/channels.service';

@Injectable()
@ValidatorConstraint({ name: 'DeviceChannelExistsValidation', async: true })
export class ChannelExistsConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly channelsService: ChannelsService) {}

	async validate(channelId: string | undefined, args: ValidationArguments): Promise<boolean> {
		if (!channelId) return false; // Prevent empty values

		const dto = args.object as Record<string, unknown>;

		// Get the `device` property from the DTO object
		const deviceId = typeof dto?.device === 'string' ? dto.device : undefined;

		return this.channelsService.exists(channelId, deviceId);
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"${args.property.charAt(0).toUpperCase() + args.property.slice(1)} does not exist or does not belong to the specified device."}]`;
	}
}

export const ValidateChannelExists = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'ValidateChannelExists',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: ChannelExistsConstraintValidator,
		});
	};
};
