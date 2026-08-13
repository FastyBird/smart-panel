import { ValidateBy, ValidationOptions } from 'class-validator';

export const isSafeHomeyUrl = (value: unknown): value is string => {
	if (typeof value !== 'string') {
		return false;
	}

	try {
		const url = new URL(value);

		return ['http:', 'https:'].includes(url.protocol) && url.username.length === 0 && url.password.length === 0;
	} catch {
		return false;
	}
};

export const IsSafeHomeyUrl = (validationOptions?: ValidationOptions): PropertyDecorator =>
	ValidateBy(
		{
			name: 'isSafeHomeyUrl',
			validator: {
				validate: isSafeHomeyUrl,
				defaultMessage: () => 'Homey URL must use HTTP or HTTPS without embedded credentials',
			},
		},
		validationOptions,
	);
