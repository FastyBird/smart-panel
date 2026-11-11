import { plainToInstance } from 'class-transformer';
import { ValidationError, validate } from 'class-validator';

import { AutomationNodeConfigProblem, AutomationNodeConfigValidator } from '../graph/node-type';

interface FieldReason {
	reason?: unknown;
}

/**
 * This project writes validation messages as a JSON list of `{ field, reason }`. The field of such a
 * message is relative to the DTO it was written in, so only its reason is taken and the field comes from
 * the path of the validation error.
 */
const readReason = (message: string): string => {
	try {
		const parsed = JSON.parse(message) as FieldReason | FieldReason[];
		const first = Array.isArray(parsed) ? parsed[0] : parsed;

		if (typeof first === 'object' && first !== null && typeof first.reason === 'string') {
			return first.reason;
		}
	} catch {
		// Not JSON: a plain class-validator message
	}

	return message;
};

const flattenErrors = (errors: ValidationError[], parentPath = ''): AutomationNodeConfigProblem[] => {
	const problems: AutomationNodeConfigProblem[] = [];

	for (const error of errors) {
		const field = parentPath === '' ? error.property : `${parentPath}.${error.property}`;

		for (const [constraint, message] of Object.entries(error.constraints ?? {})) {
			problems.push({
				field,
				reason: constraint === 'whitelistValidation' ? 'This property is not allowed.' : readReason(message),
			});
		}

		if (error.children && error.children.length > 0) {
			problems.push(...flattenErrors(error.children, field));
		}
	}

	return problems;
};

/**
 * Builds the configuration check of a node type from a class-validator DTO class. Properties the DTO does
 * not declare are refused, the same way the API refuses them in a request body.
 *
 * The configuration is only checked: it is stored as it was submitted, not as the DTO instance.
 */
export const createConfigValidatorFromDto = <TConfig extends object>(
	dtoClass: new () => TConfig,
): AutomationNodeConfigValidator => {
	return async (config): Promise<AutomationNodeConfigProblem[]> => {
		const errors = await validate(plainToInstance(dtoClass, config), {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
			// The errors must not carry the submitted configuration
			validationError: { target: false, value: false },
		});

		// Two rules of one field may share a message (a minimum and a maximum, say); it is reported once
		const seen = new Set<string>();

		return flattenErrors(errors).filter((problem) => {
			const key = JSON.stringify([problem.field, problem.reason]);

			return seen.has(key) ? false : seen.add(key) !== undefined;
		});
	};
};
