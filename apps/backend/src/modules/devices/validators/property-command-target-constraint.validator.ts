import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	isUUID,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { PropertyMetadataService } from '../services/property-metadata.service';

/** Validates the complete command target through the shared structural catalog, without live-value hydration. */
@Injectable()
@ValidatorConstraint({ name: 'PropertyCommandTargetValidation', async: true })
export class PropertyCommandTargetConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly propertyMetadata: PropertyMetadataService) {}

	/** Checks existence and both parent links; execution still revalidates under the structure barrier. */
	async validate(propertyId: unknown, args: ValidationArguments): Promise<boolean> {
		const { device: deviceId, channel: channelId } = args.object as Record<string, unknown>;
		// class-validator runs decorators independently: reject malformed IDs before any catalog lookup.
		if (
			typeof propertyId !== 'string' ||
			!isUUID(propertyId, '4') ||
			typeof channelId !== 'string' ||
			!isUUID(channelId, '4') ||
			typeof deviceId !== 'string' ||
			!isUUID(deviceId, '4')
		)
			return false;

		const property = await this.propertyMetadata.findOne(propertyId);
		if (!property || typeof property.channel === 'string') return false;
		const channel = property.channel;

		return channel.id === channelId && typeof channel.device !== 'string' && channel.device.id === deviceId;
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"The property must belong to the specified channel and device."}]`;
	}
}

export const ValidatePropertyCommandTarget = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'ValidatePropertyCommandTarget',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: PropertyCommandTargetConstraintValidator,
		});
	};
};
