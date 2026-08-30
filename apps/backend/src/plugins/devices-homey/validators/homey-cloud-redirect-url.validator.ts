import { ValidateBy, ValidationOptions } from 'class-validator';

import { HOMEY_CLOUD_CALLBACK_PATH } from '../devices-homey.constants';

import { MAX_HOMEY_URL_LENGTH } from './homey-url.validator';

export const isSafeHomeyCloudRedirectUrl = (value: unknown): value is string => {
	if (typeof value !== 'string' || value.length > MAX_HOMEY_URL_LENGTH) {
		return false;
	}

	try {
		const url = new URL(value);
		const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
		const isLoopbackHttp = url.protocol === 'http:' && loopbackHosts.has(url.hostname.toLowerCase());
		const isHttps = url.protocol === 'https:';

		return (
			(isHttps || isLoopbackHttp) &&
			url.username.length === 0 &&
			url.password.length === 0 &&
			url.search.length === 0 &&
			url.hash.length === 0 &&
			url.pathname === HOMEY_CLOUD_CALLBACK_PATH
		);
	} catch {
		return false;
	}
};

export const IsSafeHomeyCloudRedirectUrl = (validationOptions?: ValidationOptions): PropertyDecorator =>
	ValidateBy(
		{
			name: 'isSafeHomeyCloudRedirectUrl',
			validator: {
				validate: isSafeHomeyCloudRedirectUrl,
				defaultMessage: () =>
					'Homey Cloud redirect URL must be the exact HTTPS callback URL, or use HTTP on a loopback host',
			},
		},
		validationOptions,
	);
