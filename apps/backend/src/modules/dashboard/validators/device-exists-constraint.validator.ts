import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { DevicesService } from '../../devices/services/devices.service';

@Injectable()
@ValidatorConstraint({ name: 'DeviceExistsValidation', async: true })
export class DeviceExistsConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly deviceService: DevicesService) {}

	async validate(deviceId: string | undefined): Promise<boolean> {
		if (!deviceId) return false; // Prevent empty values

		// Check if the channel exists and belongs to the device
		const deviceExists = await this.deviceService.findOne(deviceId);

		return !!deviceExists;
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"${args.property.charAt(0).toUpperCase() + args.property.slice(1)} does not exist."}]`;
	}
}

export const ValidateDeviceExists = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'ValidateDeviceExists',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: DeviceExistsConstraintValidator,
		});
	};
};
