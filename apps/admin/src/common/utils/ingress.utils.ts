const INGRESS_PREFIX = /^(\/api\/hassio_ingress\/[^/]+)/;

/**
 * Returns the Home Assistant ingress prefix of a pathname (`/api/hassio_ingress/<token>`),
 * or an empty string when the admin is not served through ingress.
 */
export const resolveIngressBase = (pathname: string): string => {
	const match = pathname.match(INGRESS_PREFIX);

	return match ? match[1] : '';
};

/**
 * Builds the absolute API base: `<origin><ingress>/api/v1`.
 */
export const buildApiBase = (location: Pick<Location, 'origin' | 'pathname'>): string =>
	`${location.origin}${resolveIngressBase(location.pathname)}/api/v1`;
