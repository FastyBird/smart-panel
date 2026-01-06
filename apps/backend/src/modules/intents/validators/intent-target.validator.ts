import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

import { IntentTarget } from '../models/intent.model';

/**
 * Custom validator to ensure IntentTarget has at least one identifier:
 * - Either deviceId (for device targets) or sceneId (for scene targets) must be provided
 */
@ValidatorConstraint({ name: 'IntentTargetValid', async: false })
export class IntentTargetValidator implements ValidatorConstraintInterface {
	validate(value: unknown, _args: ValidationArguments): boolean {
		if (!value || typeof value !== 'object') {
			return false;
		}

		const target = value as IntentTarget;

		// At least one of deviceId or sceneId must be provided
		return !!(target.deviceId || target.sceneId);
	}

	defaultMessage(args: ValidationArguments): string {
		return `[{"field":"${args.property}","reason":"At least one of deviceId or sceneId must be provided."}]`;
	}
}
