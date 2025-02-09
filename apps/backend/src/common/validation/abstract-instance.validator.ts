import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

// Custom validator to check if a value is an instance of a subclass of the abstract class.
@ValidatorConstraint({ async: false })
export class AbstractInstanceValidator implements ValidatorConstraintInterface {
	validate(value: any, args: ValidationArguments) {
		if (!Array.isArray(args.constraints) || args.constraints.length === 0) {
			return false;
		}

		const AbstractClass = args.constraints[0] as new (...args: any[]) => any;

		return value instanceof AbstractClass;
	}

	defaultMessage(args: ValidationArguments) {
		const AbstractClass = args.constraints[0] as new (...args: any[]) => any;

		return `${args.property} must be a valid subclass of ${AbstractClass.name}.`;
	}
}
