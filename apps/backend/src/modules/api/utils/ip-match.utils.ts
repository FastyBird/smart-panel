import { isIP } from 'node:net';

const IPV4_MAPPED_PREFIX = '::ffff:';

/**
 * Canonicalises an IPv4-mapped IPv6 address (`::ffff:127.0.0.1`) down to its
 * plain IPv4 form, so a peer or CIDR entry compares equal regardless of
 * whether the runtime reports the dual-stack or the plain form for the same
 * address. Anything else (plain IPv4, plain IPv6, unparseable input) passes
 * through unchanged.
 */
export function normalizeIpAddress(address: string): string {
	const trimmed = address.trim();

	if (trimmed.toLowerCase().startsWith(IPV4_MAPPED_PREFIX)) {
		const embedded = trimmed.slice(IPV4_MAPPED_PREFIX.length);

		if (isIP(embedded) === 4) {
			return embedded;
		}
	}

	return trimmed;
}

function ipv4ToInt(address: string): number | null {
	if (isIP(address) !== 4) {
		return null;
	}

	return (
		address
			.split('.')
			.map(Number)
			.reduce((accumulator, octet) => (accumulator << 8) | octet, 0) >>> 0
	);
}

/**
 * Parses a validated IPv6 literal into a 128-bit integer. Handles `::`
 * compression and a trailing dotted-decimal IPv4 tail (`::ffff:127.0.0.1`).
 * Callers must already know `address` passes `isIP(address) === 6`.
 */
function ipv6ToBigInt(address: string): bigint | null {
	let expanded = address;

	const lastColon = expanded.lastIndexOf(':');
	const tail = expanded.slice(lastColon + 1);

	if (tail.includes('.')) {
		const embeddedV4 = ipv4ToInt(tail);

		if (embeddedV4 === null) {
			return null;
		}

		const hex = embeddedV4.toString(16).padStart(8, '0');
		expanded = `${expanded.slice(0, lastColon + 1)}${hex.slice(0, 4)}:${hex.slice(4)}`;
	}

	const doubleColon = expanded.indexOf('::');
	let groups: string[];

	if (doubleColon !== -1) {
		const before = expanded.slice(0, doubleColon);
		const after = expanded.slice(doubleColon + 2);
		const head = before.length > 0 ? before.split(':') : [];
		const tail8 = after.length > 0 ? after.split(':') : [];
		const missing = 8 - (head.length + tail8.length);

		if (missing < 0) {
			return null;
		}

		groups = [...head, ...(new Array(missing).fill('0') as string[]), ...tail8];
	} else {
		groups = expanded.split(':');
	}

	if (groups.length !== 8) {
		return null;
	}

	let result = 0n;

	for (const group of groups) {
		if (!/^[0-9a-fA-F]{1,4}$/.test(group)) {
			return null;
		}

		result = (result << 16n) | BigInt(parseInt(group, 16));
	}

	return result;
}

/**
 * Whether `address` falls inside `entry`, where `entry` is either a bare IP
 * (matched exactly) or a CIDR range (`10.0.0.0/8`, `fc00::/7`). Both sides
 * are normalised first (see `normalizeIpAddress`), so an IPv4-mapped IPv6
 * peer still matches a plain IPv4 trusted entry.
 *
 * Malformed input on either side — an invalid address, an out-of-range
 * prefix, or a family mismatch between the two — resolves to "no match"
 * rather than throwing, since callers use this as a trust predicate over
 * operator-supplied and network-supplied strings alike.
 */
export function isIpInCidr(address: string, entry: string): boolean {
	const normalizedAddress = normalizeIpAddress(address);
	const slashIndex = entry.indexOf('/');
	const rawNetwork = slashIndex === -1 ? entry : entry.slice(0, slashIndex);
	const prefixRaw = slashIndex === -1 ? undefined : entry.slice(slashIndex + 1);
	const network = normalizeIpAddress(rawNetwork);

	const family = isIP(network);

	if (family === 0 || isIP(normalizedAddress) !== family) {
		return false;
	}

	const maxPrefix = family === 4 ? 32 : 128;
	const prefix = prefixRaw === undefined ? maxPrefix : Number(prefixRaw);

	if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
		return false;
	}

	if (family === 4) {
		const addressInt = ipv4ToInt(normalizedAddress);
		const networkInt = ipv4ToInt(network);

		if (addressInt === null || networkInt === null) {
			return false;
		}

		const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;

		return (addressInt & mask) >>> 0 === (networkInt & mask) >>> 0;
	}

	const addressBig = ipv6ToBigInt(normalizedAddress);
	const networkBig = ipv6ToBigInt(network);

	if (addressBig === null || networkBig === null) {
		return false;
	}

	const fullMask = (1n << 128n) - 1n;
	const mask = prefix === 0 ? 0n : fullMask ^ (fullMask >> BigInt(prefix));

	return (addressBig & mask) === (networkBig & mask);
}
