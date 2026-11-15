import { PROTECT_ENDPOINTS, PROTECT_INTEGRATION_BASE_PATH, ProtectEndpoint } from '../devices-unifi-protect.constants';
import { ProtectApiError, ProtectErrorCategory } from '../errors/protect-api.error';

export const PROTECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// The one console endpoint that changes camera configuration irreversibly; no code path may build it.
const FORBIDDEN_SEGMENT = 'disable-mic-permanently';

/**
 * Builds the request path of a known endpoint. Only identifiers matching `PROTECT_ID_PATTERN` are substituted, so a
 * caller cannot smuggle path segments, and the forbidden endpoint is refused whatever the input.
 */
export function buildProtectPath(
	endpoint: ProtectEndpoint,
	params: { id?: string; query?: Record<string, string> } = {},
): string {
	if (!(PROTECT_ENDPOINTS as readonly string[]).includes(endpoint)) {
		throw new ProtectApiError(ProtectErrorCategory.VALIDATION, endpoint);
	}

	let template: string = endpoint;

	if (template.includes('{id}')) {
		if (typeof params.id !== 'string' || !PROTECT_ID_PATTERN.test(params.id)) {
			throw new ProtectApiError(ProtectErrorCategory.VALIDATION, endpoint);
		}

		template = template.replace('{id}', params.id);
	}

	const query = new URLSearchParams(params.query ?? {}).toString();
	const path = `${PROTECT_INTEGRATION_BASE_PATH}/v1/${template}${query.length > 0 ? `?${query}` : ''}`;

	if (path.toLowerCase().includes(FORBIDDEN_SEGMENT)) {
		throw new ProtectApiError(ProtectErrorCategory.VALIDATION, endpoint);
	}

	return path;
}
