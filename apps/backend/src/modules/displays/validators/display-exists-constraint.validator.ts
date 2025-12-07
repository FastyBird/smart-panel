import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { DisplaysService } from '../services/displays.service';

@ValidatorConstraint({ async: true })
@Injectable()
export class DisplayExistsConstraint implements ValidatorConstraintInterface {
	constructor(private readonly displaysService: DisplaysService) {}

	async validate(value: string): Promise<boolean> {
		if (!value) {
			return true; // Allow empty values, use other validators for required checks
		}

		const display = await this.displaysService.findOne(value);

		return display !== null;
	}

	defaultMessage(args: ValidationArguments): string {
		return `Display with ID "${args.value}" does not exist.`;
	}
}

export function ValidateDisplayExists(validationOptions?: ValidationOptions) {
	return function (object: object, propertyName: string): void {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [],
			validator: DisplayExistsConstraint,
		});
	};
}
