import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

/**
 * Interface for DTOs that have heating and cooling setpoint fields
 */
interface SetpointFields {
	heatingSetpoint?: number;
	coolingSetpoint?: number;
}

/**
 * Validator constraint that checks if heatingSetpoint < coolingSetpoint when both are provided.
 *
 * Rules:
 * - If only one setpoint is provided, validation passes
 * - If both setpoints are provided, heatingSetpoint must be strictly less than coolingSetpoint
 * - Null/undefined values are treated as "not provided"
 */
@ValidatorConstraint({ name: 'SetpointOrderValidation', async: false })
export class SetpointOrderConstraintValidator implements ValidatorConstraintInterface {
	validate(_value: number | undefined, args: ValidationArguments): boolean {
		const object = args.object as SetpointFields;
		const heatingSetpoint = object.heatingSetpoint;
		const coolingSetpoint = object.coolingSetpoint;

		// If either is not provided, no cross-field validation needed
		if (heatingSetpoint === undefined || coolingSetpoint === undefined) {
			return true;
		}

		// Both are provided - heating must be strictly less than cooling
		return heatingSetpoint < coolingSetpoint;
	}

	defaultMessage(args: ValidationArguments): string {
		const object = args.object as SetpointFields;

		return `[{"field":"${args.property}","reason":"Heating setpoint (${object.heatingSetpoint}) must be less than cooling setpoint (${object.coolingSetpoint})."}]`;
	}
}

/**
 * Decorator that validates heatingSetpoint < coolingSetpoint when both are provided.
 *
 * Usage:
 * Apply to either heatingSetpoint or coolingSetpoint field:
 * ```typescript
 * @IsValidSetpointOrder()
 * heatingSetpoint?: number;
 * ```
 */
export function IsValidSetpointOrder(validationOptions?: ValidationOptions) {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'isValidSetpointOrder',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: SetpointOrderConstraintValidator,
		});
	};
}
