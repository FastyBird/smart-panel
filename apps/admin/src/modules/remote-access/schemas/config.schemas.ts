import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config';

// Mirrors the backend's `normalizeRemoteAccessUrl` (both `internal_url` and `external_url`):
// an absolute origin - scheme, host, optional port - and nothing else. Both `http:` and `https:`
// are accepted (the posture layer warns about HTTP separately); unlike MCP's OAuth base URL, no
// path prefix is tolerated at all, not even a reverse-proxy one.
export const RemoteAccessOriginSchema = z
	.string()
	.trim()
	.refine(
		(value): boolean => {
			try {
				const url = new URL(value);

				return (
					(url.protocol === 'http:' || url.protocol === 'https:') &&
					url.hostname !== '' &&
					url.username === '' &&
					url.password === '' &&
					url.search === '' &&
					url.hash === '' &&
					url.pathname === '/' &&
					url.origin === value
				);
			} catch {
				return false;
			}
		},
		{ message: 'Must be a normalized absolute HTTP(S) origin without a path, credentials, query, or fragment.' }
	);

const RemoteAccessOptionalOriginSchema = z.preprocess(
	(value): unknown => (value === '' ? null : value),
	z.union([RemoteAccessOriginSchema, z.null()])
);

const IPV4_OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d|0)';
const IPV4_ADDRESS = `${IPV4_OCTET}(\\.${IPV4_OCTET}){3}`;
const IPV4_ENTRY = new RegExp(`^${IPV4_ADDRESS}(/(3[0-2]|[12]?\\d))?$`);

// IPv6 shape is kept permissive here (no zone-id/mapped-address canonicalisation, no exact prefix
// bound check) - the backend's `isValidTrustedProxyEntry` is the authority on exact validity; this
// only needs to catch obviously malformed input before a round trip.
const IPV6_ENTRY = /^[0-9a-fA-F:]+(\/(12[0-8]|1[01]\d|[1-9]?\d))?$/;

// Mirrors the backend's `IsTrustedProxyEntryConstraint` closely enough to catch typos client-side;
// the backend remains the authority and still rejects anything this misses.
export const RemoteAccessTrustedProxySchema = z
	.string()
	.trim()
	.refine((value): boolean => IPV4_ENTRY.test(value) || (value.includes(':') && IPV6_ENTRY.test(value)), {
		message: 'Must be a valid IPv4/IPv6 address or CIDR range.',
	});

export const RemoteAccessConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	internalUrl: RemoteAccessOptionalOriginSchema.default(null),
	externalUrl: RemoteAccessOptionalOriginSchema.default(null),
	trustForwardedHeaders: z.boolean().default(false),
	trustedProxies: z.array(RemoteAccessTrustedProxySchema).default([]),
});
