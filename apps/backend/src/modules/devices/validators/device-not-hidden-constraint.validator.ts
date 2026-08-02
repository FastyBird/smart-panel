import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { DevicesService } from '../services/devices.service';

@ValidatorConstraint({ name: 'DeviceNotHidden', async: true })
@Injectable()
export class DeviceNotHiddenConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly devicesService: DevicesService) {}

	async validate(deviceId: string | undefined): Promise<boolean> {
		// Empty values are @IsOptional/@IsNotEmpty's business, not ours.
		if (!deviceId) {
			return true;
		}

		const device = await this.devicesService.findOne(deviceId);

		return device !== null && !device.hidden;
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"Device is hidden and can not be selected."}]`;
	}
}

export function ValidateDeviceNotHidden(): PropertyDecorator {
	return function (object: object, propertyName: string | symbol): void {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName as string,
			validator: DeviceNotHiddenConstraintValidator,
		});
	};
}
