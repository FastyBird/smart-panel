import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { VirtualOwnerNotVirtualException } from '../devices-virtual.exceptions';
import { VirtualDevicesService } from '../services/virtual-devices.service';

/**
 * DTO-field wiring for VirtualDevicesService.assertDeviceIsVirtual — the containment rule for a
 * virtual *channel*: it may only hang off a virtual device. Delegates entirely to the service rather
 * than re-reading the device itself, so there is exactly one place that logic lives.
 *
 * Attached to `device` on the create channel DTO alone, which is enough to cover all three creation
 * paths because every one of them funnels that field through `ChannelsService.create()`: the
 * standalone `POST /channels` sends it in the payload, the device-scoped route merges the route
 * parameter into the same DTO before validating, and `DevicesService.create()` re-validates each
 * nested channel with `device` set to the freshly created device's id. The update DTO needs no
 * counterpart — a channel carries no `device` field on PATCH, so it cannot be re-parented.
 *
 * `assertDeviceIsVirtual` signals both "no such device" and "that device is not virtual" by throwing
 * VirtualOwnerNotVirtualException; both make `device` an invalid value for this field, so both become
 * `false` here. Anything else the service throws is not a validation failure — it is re-thrown rather
 * than silently reported as "invalid input". Mirrors SourceNotVirtualConstraintValidator exactly.
 */
@ValidatorConstraint({ name: 'DeviceIsVirtual', async: true })
@Injectable()
export class DeviceIsVirtualConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly virtualDevicesService: VirtualDevicesService) {}

	async validate(deviceId: string | undefined | null): Promise<boolean> {
		// Empty values are @IsUUID's business, not ours.
		if (!deviceId) {
			return true;
		}

		try {
			await this.virtualDevicesService.assertDeviceIsVirtual(deviceId);

			return true;
		} catch (error) {
			if (error instanceof VirtualOwnerNotVirtualException) {
				return false;
			}

			throw error;
		}
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"A virtual channel can only belong to a virtual device."}]`;
	}
}

export function ValidateDeviceIsVirtual(): PropertyDecorator {
	return function (object: object, propertyName: string | symbol): void {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName as string,
			validator: DeviceIsVirtualConstraintValidator,
		});
	};
}
