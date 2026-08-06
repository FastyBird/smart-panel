import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'isMcpOrigin', async: false })
export class IsMcpOriginConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		if (typeof value !== 'string') {
			return false;
		}

		try {
			const url = new URL(value);

			return (
				(url.protocol === 'http:' || url.protocol === 'https:') &&
				url.username === '' &&
				url.password === '' &&
				url.origin === value
			);
		} catch {
			return false;
		}
	}

	defaultMessage(_validationArguments: ValidationArguments): string {
		return 'Origin must be a normalized absolute HTTP(S) origin without a path, query, fragment, or credentials.';
	}
}
