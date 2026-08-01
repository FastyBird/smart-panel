import {
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { VirtualNestingNotAllowedException, VirtualSourceNotFoundException } from '../devices-virtual.exceptions';
import { VirtualDevicesService } from '../services/virtual-devices.service';

/**
 * DTO-field wiring for VirtualDevicesService.assertSourceNotVirtual — this is what makes
 * VirtualProjectionListener's "nesting is rejected at creation" doc comment true rather than
 * aspirational. Delegates entirely to the service rather than re-resolving property -> channel ->
 * device itself, so there is exactly one place that logic lives.
 *
 * `assertSourceNotVirtual` signals both "the source does not exist" and "the source is virtual" by
 * throwing (VirtualSourceNotFoundException / VirtualNestingNotAllowedException respectively); both
 * are translated to `false` here since either makes `source_property` an invalid value for this
 * field. Anything else the service throws is not a validation failure — it is re-thrown rather than
 * silently reported as "invalid input".
 */
@ValidatorConstraint({ name: 'SourceNotVirtual', async: true })
@Injectable()
export class SourceNotVirtualConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly virtualDevicesService: VirtualDevicesService) {}

	async validate(sourcePropertyId: string | undefined | null): Promise<boolean> {
		// Empty values are @IsOptional's business, not ours.
		if (!sourcePropertyId) {
			return true;
		}

		try {
			await this.virtualDevicesService.assertSourceNotVirtual(sourcePropertyId);

			return true;
		} catch (error) {
			if (error instanceof VirtualNestingNotAllowedException || error instanceof VirtualSourceNotFoundException) {
				return false;
			}

			throw error;
		}
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"Source property does not exist or belongs to another virtual device."}]`;
	}
}

export function ValidateSourceNotVirtual(): PropertyDecorator {
	return function (object: object, propertyName: string | symbol): void {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName as string,
			validator: SourceNotVirtualConstraintValidator,
		});
	};
}
