import { logger, snakeToCamel } from '../../../common';
import { RemoteAccessProviderStatusEventSchema } from '../../../modules/remote-access';
import type { RemoteAccessCloudflareTunnelPluginInstallSchema, RemoteAccessCloudflareTunnelPluginStatusSchema } from '../../../openapi.constants';
import { RemoteAccessCloudflareTunnelValidationException } from '../remote-access-cloudflare-tunnel.exceptions';

import {
	CloudflareTunnelInstallResultSchema,
	CloudflareTunnelSetupProgressSchema,
	CloudflareTunnelStatusSchema,
} from './cloudflare-tunnel-status.store.schemas';
import type { ICloudflareTunnelInstallResult, ICloudflareTunnelSetupProgress, ICloudflareTunnelStatus } from './cloudflare-tunnel-status.store.types';

// Every transformer below parses against the camelCase store schema (`CloudflareTunnelStatusSchema`
// and friends), never the snake_case `*ResSchema` - those exist purely as `ZodType<...>`
// compile-time anchors against the generated wire type (see the schema file's "BACKEND API"
// comment) and are never `.safeParse()`d themselves: `snakeToCamel()` below already converts the
// raw response to the shape the camelCase schema expects.

/** `GET /status` and `POST /reset` both share this response shape. */
export const transformCloudflareTunnelStatusResponse = (response: RemoteAccessCloudflareTunnelPluginStatusSchema): ICloudflareTunnelStatus => {
	const parsed = CloudflareTunnelStatusSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessCloudflareTunnelValidationException('Failed to validate received Cloudflare Tunnel status data.');
	}

	return parsed.data;
};

/** `POST /install`. */
export const transformCloudflareTunnelInstallResponse = (
	response: RemoteAccessCloudflareTunnelPluginInstallSchema
): ICloudflareTunnelInstallResult => {
	const parsed = CloudflareTunnelInstallResultSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessCloudflareTunnelValidationException('Failed to validate received Cloudflare Tunnel install result.');
	}

	return parsed.data;
};

/**
 * Merges a `RemoteAccessModule.Provider.Status` event into the current status snapshot - mirrors
 * `applyTailscaleProviderStatusEvent`. The event never carries `requirements`, `setup` or
 * `privilegedSetup` (only the plugin's own `GET /status`/`POST /reset` responses do), so those are
 * left untouched.
 */
export const applyCloudflareTunnelProviderStatusEvent = (
	status: ICloudflareTunnelStatus,
	payload: Record<string, unknown>
): ICloudflareTunnelStatus => {
	// Reuses the remote-access module's own event schema: `RemoteAccessModule.Provider.Status` is
	// shared infrastructure, and every provider's payload (this one included) has exactly this
	// shape - never `requirements`, `setup` or `privilegedSetup`, which only this plugin's own
	// REST responses carry.
	const parsed = RemoteAccessProviderStatusEventSchema.safeParse(snakeToCamel(payload));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessCloudflareTunnelValidationException('Failed to validate received Cloudflare Tunnel provider status event.');
	}

	const event = parsed.data;

	return {
		...status,
		state: event.state,
		endpoints: event.endpoints,
		message: event.message ?? null,
		details: event.details,
		proxyAddresses: event.proxyAddresses,
		advisories: event.advisories,
		updatedAt: event.updatedAt,
	};
};

/** Validates a `RemoteAccessModule.Setup.Progress` event payload. */
export const transformCloudflareTunnelSetupProgressEvent = (payload: Record<string, unknown>): ICloudflareTunnelSetupProgress => {
	const parsed = CloudflareTunnelSetupProgressSchema.safeParse(payload);

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessCloudflareTunnelValidationException('Failed to validate received Cloudflare Tunnel setup progress event.');
	}

	return parsed.data;
};
