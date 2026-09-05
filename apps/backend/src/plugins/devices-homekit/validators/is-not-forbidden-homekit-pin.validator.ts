import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';

import { HOMEKIT_FORBIDDEN_PINS } from '../devices-homekit.constants';

/**
 * Class-validator decorator validating that a HomeKit PIN code is not in Apple's forbidden code set.
 *
 * Checks against trivially guessable sequences (e.g. all identical digits, 123-45-678, 876-54-321)
 * disallowed by Apple HomeKit Accessory Protocol specifications.
 *
 * @param validationOptions - Optional class-validator validation options.
 * @returns A property decorator function.
 */
export function IsNotForbiddenHomeKitPin(validationOptions?: ValidationOptions) {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'isNotForbiddenHomeKitPin',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			validator: {
				validate(value: unknown) {
					if (value === undefined || value === null || value === '') {
						return true;
					}
					if (typeof value !== 'string') {
						return false;
					}
					return !HOMEKIT_FORBIDDEN_PINS.has(value);
				},
				defaultMessage(args: ValidationArguments) {
					return `[{"field":"${args.property}","reason":"PIN code is not allowed by Apple HomeKit."}]`;
				},
			},
		});
	};
}
