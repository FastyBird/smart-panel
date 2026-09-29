import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ChannelsPropertiesService } from '../services/channels.properties.service';

@Injectable()
@ValidatorConstraint({ name: 'ChannelPropertyExistsValidation', async: true })
export class ChannelPropertyExistsConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly channelsPropertiesService: ChannelsPropertiesService) {}

	async validate(propertyId: string | undefined, args: ValidationArguments): Promise<boolean> {
		if (!propertyId) return false; // Prevent empty values

		const dto = args.object as Record<string, unknown>;

		// Get the `channel` property from the DTO object
		const channelId = typeof dto?.channel === 'string' ? dto.channel : undefined;

		return this.channelsPropertiesService.exists(propertyId, channelId);
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"${args.property.charAt(0).toUpperCase() + args.property.slice(1)} does not exist or does not belong to the specified channel."}]`;
	}
}

export const ValidateChannelPropertyExists = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'ValidateChannelPropertyExists',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: ChannelPropertyExistsConstraintValidator,
		});
	};
};
