import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class UniqueControlNamesConstraint implements ValidatorConstraintInterface {
	validate(controls: any[]): boolean {
		if (!Array.isArray(controls)) {
			return true; // Skip validation for non-arrays
		}

		const names = controls.map((control: { name: string }) => control.name);

		return new Set(names).size === names.length; // Check for duplicates
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"Control names must be unique."}]`;
	}
}

export const UniqueControlNames = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: UniqueControlNamesConstraint,
		});
	};
};
