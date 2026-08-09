import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost']);

export const isMcpOAuthRedirectUri = (value: string): boolean => {
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return false;
	}

	if (url.username || url.password || url.hash) {
		return false;
	}

	if (url.protocol === 'https:') {
		return true;
	}

	return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
};

export const matchesMcpOAuthRedirectUri = (registered: string, requested: string): boolean => {
	if (registered === requested) {
		return true;
	}

	if (!isMcpOAuthRedirectUri(registered) || !isMcpOAuthRedirectUri(requested)) {
		return false;
	}

	const registeredUrl = new URL(registered);
	const requestedUrl = new URL(requested);
	const variablePortHost = registeredUrl.hostname === '127.0.0.1' || registeredUrl.hostname === '[::1]';

	return (
		variablePortHost &&
		requestedUrl.hostname === registeredUrl.hostname &&
		requestedUrl.protocol === 'http:' &&
		registeredUrl.protocol === 'http:' &&
		requestedUrl.pathname === registeredUrl.pathname &&
		requestedUrl.search === registeredUrl.search &&
		requestedUrl.username === registeredUrl.username &&
		requestedUrl.password === registeredUrl.password
	);
};

@ValidatorConstraint({ name: 'isMcpOAuthRedirectUris', async: false })
export class IsMcpOAuthRedirectUrisConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return (
			Array.isArray(value) &&
			value.length > 0 &&
			value.length <= 10 &&
			value.every((uri) => typeof uri === 'string' && isMcpOAuthRedirectUri(uri)) &&
			new Set(value).size === value.length
		);
	}

	defaultMessage(): string {
		return 'OAuth redirect URIs must be unique absolute HTTPS URLs or HTTP loopback URLs without credentials or fragments';
	}
}
