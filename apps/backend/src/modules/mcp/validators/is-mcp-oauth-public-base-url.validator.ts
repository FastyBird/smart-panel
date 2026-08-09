import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

import { Injectable } from '@nestjs/common';

export function normalizeMcpOAuthPublicBaseUrl(value: string): string | null {
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return null;
	}

	if (
		url.protocol !== 'https:' ||
		!url.hostname ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		(url.pathname !== '/' && url.pathname.endsWith('/'))
	) {
		return null;
	}

	const normalized = `${url.origin}${url.pathname === '/' ? '' : url.pathname}`;

	return normalized === value ? normalized : null;
}

@ValidatorConstraint({ name: 'isMcpOAuthPublicBaseUrl', async: false })
@Injectable()
export class IsMcpOAuthPublicBaseUrlConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return typeof value === 'string' && normalizeMcpOAuthPublicBaseUrl(value) !== null;
	}

	defaultMessage(_args: ValidationArguments): string {
		return 'OAuth public base URL must be a normalized absolute HTTPS URL without credentials, query, fragment, or trailing slash.';
	}
}
