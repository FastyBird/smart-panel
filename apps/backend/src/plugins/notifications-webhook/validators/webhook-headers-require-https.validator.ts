import {
	ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface,
	registerDecorator,
} from 'class-validator';

/**
 * The generic webhook accepts `http:` for trusted-network targets, but its optional
 * `headers` map is a declared secret and is only ever sent over `https:` - a configuration
 * with an `http:` URL and any header is rejected, so a bearer token or API key configured
 * as a header can never leave the network in cleartext.
 */
interface WebhookUrlField {
	url?: string | null;
}

@ValidatorConstraint({ name: 'webhookHeadersRequireHttps', async: false })
export class WebhookHeadersRequireHttpsConstraintValidator implements ValidatorConstraintInterface {
	validate(headers: unknown, args: ValidationArguments): boolean {
		if (headers === null || headers === undefined) {
			return true;
		}

		const object = args.object as WebhookUrlField;

		return typeof object.url === 'string' && object.url.toLowerCase().startsWith('https://');
	}

	defaultMessage(): string {
		return 'Custom headers require an HTTPS webhook URL.';
	}
}

export function WebhookHeadersRequireHttps(validationOptions?: ValidationOptions) {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: 'webhookHeadersRequireHttps',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			constraints: [],
			validator: WebhookHeadersRequireHttpsConstraintValidator,
		});
	};
}
