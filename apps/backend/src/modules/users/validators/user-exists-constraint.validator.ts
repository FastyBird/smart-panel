import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { UsersService } from '../services/users.service';

@Injectable()
@ValidatorConstraint({ name: 'UserExistsValidation', async: false })
export class UserExistsConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly usersService: UsersService) {}

	async validate(userId: string | undefined): Promise<boolean> {
		if (!userId) return false; // Prevent empty values

		// Check if the channel exists and belongs to the user
		const userExists = await this.usersService.findOne(userId);

		return !!userExists;
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"${args.property.charAt(0).toUpperCase() + args.property.slice(1)} does not exist."}]`;
	}
}

export const ValidateUserExists = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'ValidateUserExists',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: UserExistsConstraintValidator,
		});
	};
};
