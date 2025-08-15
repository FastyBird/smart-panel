import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { DisplaysProfilesService } from '../services/displays-profiles.service';

@Injectable()
@ValidatorConstraint({ name: 'DisplayProfileExistsValidation', async: false })
export class DisplayProfileExistsConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly displaysService: DisplaysProfilesService) {}

	async validate(displayId: string | undefined): Promise<boolean> {
		if (!displayId) return false; // Prevent empty values

		// Check if the channel exists and belongs to the display
		const displayExists = await this.displaysService.findOne(displayId);

		return !!displayExists;
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"${args.property.charAt(0).toUpperCase() + args.property.slice(1)} does not exist."}]`;
	}
}

export const ValidateDisplayProfileExists = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'ValidateDisplayProfileExists',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: DisplayProfileExistsConstraintValidator,
		});
	};
};
