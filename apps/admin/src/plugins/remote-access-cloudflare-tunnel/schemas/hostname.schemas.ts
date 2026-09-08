import { z } from 'zod';

// Mirrors the backend's `@IsFQDN()` validation on `public_hostname` (config.model.ts /
// update-config.dto.ts): a bare hostname, no scheme, no path, no port - at least one label plus a
// TLD-shaped final label. Client-side validation is a courtesy only; the backend's own `@IsFQDN`
// is the actual source of truth and rejects anything this misses with a 422.
const HOSTNAME_PATTERN = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))+$/;

export const isValidCloudflareTunnelHostname = (value: string): boolean =>
	value.length <= 253 && !value.includes('://') && !value.includes('/') && HOSTNAME_PATTERN.test(value);

export const CloudflareTunnelHostnameSchema = z.string().refine(isValidCloudflareTunnelHostname, {
	message: 'Public hostname must be a valid hostname, without a scheme or path.',
});
