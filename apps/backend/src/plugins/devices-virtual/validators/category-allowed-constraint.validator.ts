import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { VirtualCategoryNotSupportedException } from '../devices-virtual.exceptions';
import { VirtualDevicesService } from '../services/virtual-devices.service';

/**
 * DTO-field wiring for VirtualDevicesService.assertCategoryAllowed — this is what stops a user
 * creating (or patching in) a `heating_unit`-style virtual device that would accept a setpoint and
 * never act on it (see VIRTUAL_BLOCKED_CATEGORIES). Delegates entirely to the service rather than
 * re-checking VIRTUAL_BLOCKED_CATEGORIES itself.
 *
 * Synchronous, not async: assertCategoryAllowed does no I/O (a plain array membership check), so
 * `@ValidatorConstraint({ async: false })` here is honest about that — unlike the pre-existing
 * DeviceExistsConstraintValidator, whose `validate()` is an `async function` (always returns a
 * Promise) despite also declaring `async: false`, which makes class-validator skip awaiting it and
 * treat the truthy Promise as a pass. `validate()` below returns a plain `boolean`.
 */
@ValidatorConstraint({ name: 'CategoryAllowed', async: false })
@Injectable()
export class CategoryAllowedConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly virtualDevicesService: VirtualDevicesService) {}

	validate(category: DeviceCategory | undefined | null): boolean {
		// Empty values are @IsOptional/@IsNotEmpty's business, not ours.
		if (!category) {
			return true;
		}

		try {
			this.virtualDevicesService.assertCategoryAllowed(category);

			return true;
		} catch (error) {
			if (error instanceof VirtualCategoryNotSupportedException) {
				return false;
			}

			throw error;
		}
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"This device category requires closed-loop control, which virtual devices do not support yet."}]`;
	}
}

export function ValidateCategoryAllowed(): PropertyDecorator {
	return function (object: object, propertyName: string | symbol): void {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName as string,
			validator: CategoryAllowedConstraintValidator,
		});
	};
}
