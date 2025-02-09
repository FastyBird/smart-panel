import { ValidationError } from 'class-validator';

import { BadRequestException } from '@nestjs/common';

export class ValidationExceptionFactory {
	private static flattenValidationErrors(validationErrors: ValidationError[]): string[] {
		const messages: string[] = [];

		for (const error of validationErrors) {
			if (error.constraints) {
				for (const key of Object.keys(error.constraints)) {
					let reason = error.constraints[key];

					try {
						JSON.parse(reason);

						messages.push(error.constraints[key]);
					} catch {
						// ✅ Custom handling for `whitelistValidation`
						if (key === 'whitelistValidation') {
							reason = `Unexpected property '${error.property}' is not allowed.`;
						}

						messages.push(
							JSON.stringify({
								field: error.property,
								reason,
							}),
						);
					}
				}
			}

			if (error.children && error.children.length > 0) {
				messages.push(...this.flattenValidationErrors(error.children).map((item) => `${error.property}.${item}`));
			}
		}

		return messages;
	}

	static createException(validationErrors: ValidationError[]): BadRequestException {
		return new BadRequestException(this.flattenValidationErrors(validationErrors));
	}
}
