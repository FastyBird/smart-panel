import { ValidateBy, ValidationOptions } from 'class-validator';
import { isIPv4, isIPv6 } from 'net';

import { isValidProtectHost } from './protect-config.validators';

export interface ParsedProbeHost {
	host: string;
	kind: 'ipv4' | 'ipv6' | 'hostname';
}

/** 0.0.0.0, 255.255.255.255, 224.0.0.0/4 and 169.254.0.0/16, from the parsed octets. */
const isRejectedIpv4 = (octets: number[]): boolean => {
	const [a, b] = octets;

	return (
		octets.every((octet) => octet === 0) ||
		octets.every((octet) => octet === 255) ||
		(a >= 224 && a <= 239) ||
		(a === 169 && b === 254)
	);
};

/** The eight hextets of a valid IPv6 literal (`::` expanded, a trailing dotted quad folded), or null. */
const ipv6Hextets = (value: string): number[] | null => {
	let text = value;
	const tail = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);

	if (tail) {
		const [a, b, c, d] = tail.slice(1).map(Number);

		text = `${text.slice(0, tail.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
	}

	const halves = text.split('::');

	if (halves.length > 2) {
		return null;
	}

	const parse = (part: string): number[] => (part === '' ? [] : part.split(':').map((group) => parseInt(group, 16)));
	const head = parse(halves[0]);
	const rest = halves.length === 2 ? parse(halves[1]) : [];
	const missing = 8 - head.length - rest.length;

	if (missing < 0 || (halves.length === 1 && missing !== 0)) {
		return null;
	}

	const hextets = [...head, ...new Array<number>(halves.length === 2 ? missing : 0).fill(0), ...rest];

	return hextets.length === 8 && hextets.every((hextet) => Number.isInteger(hextet)) ? hextets : null;
};

/** `::`, fe80::/10 and ff00::/8, plus an IPv4-mapped address whose IPv4 part is rejected. */
const isRejectedIpv6 = (hextets: number[]): boolean => {
	if (hextets.every((hextet) => hextet === 0)) {
		return true;
	}

	if ((hextets[0] & 0xffc0) === 0xfe80 || (hextets[0] & 0xff00) === 0xff00) {
		return true;
	}

	if (hextets.slice(0, 5).every((hextet) => hextet === 0) && hextets[5] === 0xffff) {
		return isRejectedIpv4([hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff]);
	}

	return false;
};

/**
 * Trimmed, lower-cased IPv4 literal, bare IPv6 literal or RFC 1123 hostname; the port is a separate field. Rejects
 * non-unicast and link-local addresses. Loopback and private ranges are accepted: the LAN is the point.
 */
export const parseProbeHost = (value: unknown): ParsedProbeHost | null => {
	if (typeof value !== 'string') {
		return null;
	}

	const host = value.trim().toLowerCase();

	if (!isValidProtectHost(host) || host.includes('%')) {
		return null;
	}

	if (isIPv4(host)) {
		return isRejectedIpv4(host.split('.').map(Number)) ? null : { host, kind: 'ipv4' };
	}

	if (isIPv6(host)) {
		const hextets = ipv6Hextets(host);

		return hextets === null || isRejectedIpv6(hextets) ? null : { host, kind: 'ipv6' };
	}

	return { host, kind: 'hostname' };
};

export const IsProtectProbeHost = (validationOptions?: ValidationOptions): PropertyDecorator =>
	ValidateBy(
		{
			name: 'isProtectProbeHost',
			validator: {
				validate: (value: unknown): boolean => parseProbeHost(value) !== null,
				defaultMessage: () => 'host must be an IP address or hostname without scheme, path or port',
			},
		},
		validationOptions,
	);
