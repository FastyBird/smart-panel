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

	async validate(value: string | string[]): Promise<boolean> {
		if (!value) {
			return true; // Allow empty values, use other validators for required checks
		}

		// Handle array of display IDs
		if (Array.isArray(value)) {
			if (value.length === 0) {
				return true; // Empty array is valid (visible to all)
			}

			// Validate all display IDs exist
			for (const displayId of value) {
				const display = await this.displaysService.findOne(displayId);
				if (display === null) {
					return false;
				}
			}
			return true;
		}

		// Handle single display ID (backward compatibility)
		const display = await this.displaysService.findOne(value);

		return display !== null;
	}

	defaultMessage(args: ValidationArguments): string {
		if (Array.isArray(args.value)) {
			return `One or more displays with IDs "${args.value.join(', ')}" do not exist.`;
		}
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
