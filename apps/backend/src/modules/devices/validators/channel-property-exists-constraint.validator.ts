import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ChannelsPropertiesService } from '../services/channels.properties.service';
import { ChannelsService } from '../services/channels.service';

@Injectable()
@ValidatorConstraint({ name: 'ChannelPropertyExistsValidation', async: true })
export class ChannelPropertyExistsConstraintValidator implements ValidatorConstraintInterface {
	constructor(
		private readonly channelService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
	) {}

	async validate(propertyId: string | undefined, args: ValidationArguments): Promise<boolean> {
		if (!propertyId) return false; // Prevent empty values

		const dto = args.object as Record<string, unknown>;

		// Get the `channel` property from the DTO object
		const channelId = typeof dto?.channel === 'string' ? dto.channel : undefined;

		if (!channelId) {
			// Check if the channel property exists
			const propertyExists = await this.channelsPropertiesService.findOne(propertyId);

			return !!propertyExists;
		}

		// Check if the channel exists
		const channelExists = await this.channelService.findOne(channelId);
		if (!channelExists) return false;

		// Check if the channel property exists and belongs to the channel
		const propertyExists = await this.channelsPropertiesService.findOne(propertyId, channelId);

		return !!propertyExists;
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
