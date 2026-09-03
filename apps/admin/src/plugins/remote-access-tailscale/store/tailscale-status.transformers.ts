import { logger, snakeToCamel } from '../../../common';
import { RemoteAccessProviderStatusEventSchema } from '../../../modules/remote-access';
import type {
	RemoteAccessTailscalePluginInstallSchema,
	RemoteAccessTailscalePluginLoginSchema,
	RemoteAccessTailscalePluginStatusSchema,
} from '../../../openapi.constants';
import { RemoteAccessTailscaleValidationException } from '../remote-access-tailscale.exceptions';

import {
	TailscaleInstallResultSchema,
	TailscaleLoginResultSchema,
	TailscaleSetupProgressSchema,
	TailscaleStatusSchema,
} from './tailscale-status.store.schemas';
import type { ITailscaleInstallResult, ITailscaleLoginResult, ITailscaleSetupProgress, ITailscaleStatus } from './tailscale-status.store.types';

// Every transformer below parses against the camelCase store schema (`TailscaleStatusSchema` and
// friends), never the snake_case `*ResSchema` - those exist purely as `ZodType<...>` compile-time
// anchors against the generated wire type (see the schema file's "BACKEND API" comment) and are
// never `.safeParse()`d themselves: `snakeToCamel()` below already converts the raw response to
// the shape the camelCase schema expects.

/** `GET /status`, `POST /logout` and `POST /reset-preferences` all share this response shape. */
export const transformTailscaleStatusResponse = (response: RemoteAccessTailscalePluginStatusSchema): ITailscaleStatus => {
	const parsed = TailscaleStatusSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessTailscaleValidationException('Failed to validate received Tailscale status data.');
	}

	return parsed.data;
};

/** `POST /login`. */
export const transformTailscaleLoginResponse = (response: RemoteAccessTailscalePluginLoginSchema): ITailscaleLoginResult => {
	const parsed = TailscaleLoginResultSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessTailscaleValidationException('Failed to validate received Tailscale sign-in result.');
	}

	return parsed.data;
};

/** `POST /install`. */
export const transformTailscaleInstallResponse = (response: RemoteAccessTailscalePluginInstallSchema): ITailscaleInstallResult => {
	const parsed = TailscaleInstallResultSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessTailscaleValidationException('Failed to validate received Tailscale install result.');
	}

	return parsed.data;
};

/**
 * Merges a `RemoteAccessModule.Provider.Status` event into the current status snapshot -
 * mirrors `applyRemoteAccessProviderStatusEvent` in the remote-access module. The event never
 * carries `requirements`, `authUrl` or `qr` (only the plugin's own REST responses do), so those
 * are left untouched - except `authUrl`/`qr`, which are cleared as soon as the node leaves
 * `pending-auth`: a stale capability URL must not linger once it no longer applies.
 */
export const applyTailscaleProviderStatusEvent = (status: ITailscaleStatus, payload: Record<string, unknown>): ITailscaleStatus => {
	// Reuses the remote-access module's own event schema: `RemoteAccessModule.Provider.Status` is
	// shared infrastructure, and every provider's payload (this one included) has exactly this
	// shape - never `requirements`, `authUrl` or `qr`, which only this plugin's own REST responses
	// carry.
	const parsed = RemoteAccessProviderStatusEventSchema.safeParse(snakeToCamel(payload));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessTailscaleValidationException('Failed to validate received Tailscale provider status event.');
	}

	const event = parsed.data;

	const stillPendingAuth = event.state === 'pending-auth';

	return {
		...status,
		state: event.state,
		endpoints: event.endpoints,
		message: event.message ?? null,
		details: event.details,
		proxyAddresses: event.proxyAddresses,
		advisories: event.advisories,
		updatedAt: event.updatedAt,
		authUrl: stillPendingAuth ? status.authUrl : undefined,
		qr: stillPendingAuth ? status.qr : undefined,
	};
};

/** Validates a `RemoteAccessModule.Setup.Progress` event payload. */
export const transformTailscaleSetupProgressEvent = (payload: Record<string, unknown>): ITailscaleSetupProgress => {
	const parsed = TailscaleSetupProgressSchema.safeParse(payload);

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessTailscaleValidationException('Failed to validate received Tailscale setup progress event.');
	}

	return parsed.data;
};
