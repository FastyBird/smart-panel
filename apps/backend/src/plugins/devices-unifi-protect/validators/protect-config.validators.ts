import { ValidationOptions, registerDecorator } from 'class-validator';
import { isIP } from 'net';

export const MAX_PROTECT_HOST_LENGTH = 253;

const DNS_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
const FINGERPRINT = /^[0-9a-f]{64}$/;

function isDnsName(value: string): boolean {
	if (value.length === 0 || value.length > MAX_PROTECT_HOST_LENGTH) {
		return false;
	}

	const labels = value.split('.');

	// An all-numeric last label would make a malformed IPv4 address (999.1.1.1) pass as a name.
	if (/^\d+$/.test(labels[labels.length - 1])) {
		return false;
	}

	return labels.every((label) => DNS_LABEL.test(label));
}

/** IPv4, IPv6 (no brackets) or RFC 1123 name; no scheme, port, path, userinfo or whitespace. */
export function isValidProtectHost(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PROTECT_HOST_LENGTH) {
		return false;
	}

	return isIP(value) !== 0 || isDnsName(value);
}

/** RFC 1123 DNS name only, never an IP address. */
export function isValidProtectServerName(value: unknown): value is string {
	return typeof value === 'string' && isIP(value) === 0 && isDnsName(value);
}

/** Strips colons and lower-cases; returns the 64 hex characters or null. */
export function normalizeProtectFingerprint(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const normalized = value.replace(/:/g, '').toLowerCase();

	return FINGERPRINT.test(normalized) ? normalized : null;
}

export function IsProtectHost(validationOptions?: ValidationOptions): PropertyDecorator {
	return (object: object, propertyName: string | symbol): void => {
		registerDecorator({
			name: 'isProtectHost',
			target: object.constructor,
			propertyName: propertyName as string,
			options: validationOptions,
			validator: { validate: (value: unknown): boolean => isValidProtectHost(value) },
		});
	};
}

export function IsProtectServerName(validationOptions?: ValidationOptions): PropertyDecorator {
	return (object: object, propertyName: string | symbol): void => {
		registerDecorator({
			name: 'isProtectServerName',
			target: object.constructor,
			propertyName: propertyName as string,
			options: validationOptions,
			validator: { validate: (value: unknown): boolean => isValidProtectServerName(value) },
		});
	};
}
