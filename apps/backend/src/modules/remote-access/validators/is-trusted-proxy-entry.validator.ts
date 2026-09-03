import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { isValidTrustedProxyEntry } from '../../api/utils/ip-match.utils';

/**
 * Validates one `trusted_proxies` entry: a bare IPv4/IPv6 address or a CIDR
 * range, using the exact same parser `TrustedProxyRegistryService.isTrusted()`
 * matches against (`api/utils/ip-match.utils.ts`), so a value accepted here
 * is guaranteed to be usable there.
 */
@ValidatorConstraint({ name: 'isTrustedProxyEntry', async: false })
@Injectable()
export class IsTrustedProxyEntryConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return typeof value === 'string' && isValidTrustedProxyEntry(value);
	}

	defaultMessage(_args: ValidationArguments): string {
		return 'Trusted proxy entries must be a valid IPv4/IPv6 address or CIDR range.';
	}
}
