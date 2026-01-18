import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { ClimateIntentType } from '../spaces.constants';

/**
 * Interface for DTOs that have setpoint fields and intent type
 */
interface SetpointIntentFields {
	type: ClimateIntentType;
	heatingSetpoint?: number;
	coolingSetpoint?: number;
}

/**
 * Validator constraint that checks if at least one setpoint is provided for SETPOINT_SET intent.
 *
 * Rules:
 * - Only applies to SETPOINT_SET intent type
 * - At least one of heatingSetpoint or coolingSetpoint must be defined
 * - For other intent types, validation always passes
 */
@ValidatorConstraint({ name: 'AtLeastOneSetpointValidation', async: false })
export class AtLeastOneSetpointConstraintValidator implements ValidatorConstraintInterface {
	validate(_value: unknown, args: ValidationArguments): boolean {
		const object = args.object as SetpointIntentFields;

		// Only enforce for SETPOINT_SET intent type
		if (object.type !== ClimateIntentType.SETPOINT_SET) {
			return true;
		}

		// At least one setpoint must be provided
		return object.heatingSetpoint !== undefined || object.coolingSetpoint !== undefined;
	}

	defaultMessage(): string {
		return '[{"field":"heating_setpoint","reason":"At least one of heating_setpoint or cooling_setpoint is required for SETPOINT_SET intent."}]';
	}
}

/**
 * Decorator that validates at least one setpoint is provided for SETPOINT_SET intent.
 *
 * Usage:
 * Apply to the type field or any field on the class:
 * ```typescript
 * @AtLeastOneSetpointRequired()
 * type: ClimateIntentType;
 * ```
 */
export function AtLeastOneSetpointRequired(validationOptions?: ValidationOptions) {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'atLeastOneSetpointRequired',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: AtLeastOneSetpointConstraintValidator,
		});
	};
}
