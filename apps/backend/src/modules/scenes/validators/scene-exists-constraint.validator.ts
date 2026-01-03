import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ScenesService } from '../services/scenes.service';

@Injectable()
@ValidatorConstraint({ name: 'SceneExistsValidation', async: false })
export class SceneExistsConstraintValidator implements ValidatorConstraintInterface {
	constructor(private readonly scenesService: ScenesService) {}

	async validate(sceneId: string | undefined): Promise<boolean> {
		if (!sceneId) return false; // Prevent empty values

		// Check if the scene exists
		const sceneExists = await this.scenesService.findOne(sceneId);

		return !!sceneExists;
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"${args.property.charAt(0).toUpperCase() + args.property.slice(1)} does not exist."}]`;
	}
}

export const ValidateSceneExists = (validationOptions?: ValidationOptions) => {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'ValidateSceneExists',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: SceneExistsConstraintValidator,
		});
	};
};
