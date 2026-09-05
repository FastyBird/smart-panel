import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';

import { HOMEKIT_FORBIDDEN_PINS } from '../devices-homekit.constants';

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
