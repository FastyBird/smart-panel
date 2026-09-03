import { logger, snakeToCamel } from '../../../common';
import { RemoteAccessProviderStatusEventSchema } from '../../../modules/remote-access';
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

/** `GET /status`, and `POST /logout` / `/reset-preferences` once unwrapped - see the schema file's "BACKEND API" comment for why those two need `unwrapBuggyEnvelope` first. */
export const transformTailscaleStatusResponse = (response: unknown): ITailscaleStatus => {
	const parsed = TailscaleStatusSchema.safeParse(snakeToCamel(response as Record<string, unknown>));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessTailscaleValidationException('Failed to validate received Tailscale status data.');
	}

	return parsed.data;
};

/** `POST /login` once unwrapped. */
export const transformTailscaleLoginResponse = (response: unknown): ITailscaleLoginResult => {
	const parsed = TailscaleLoginResultSchema.safeParse(snakeToCamel(response as Record<string, unknown>));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessTailscaleValidationException('Failed to validate received Tailscale sign-in result.');
	}

	return parsed.data;
};

/** `POST /install` once unwrapped. */
export const transformTailscaleInstallResponse = (response: unknown): ITailscaleInstallResult => {
	const parsed = TailscaleInstallResultSchema.safeParse(snakeToCamel(response as Record<string, unknown>));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessTailscaleValidationException('Failed to validate received Tailscale install result.');
	}

	return parsed.data;
};

/**
 * `POST /install`, `/login`, `/logout` and `/reset-preferences` are typed by
 * `openapi-typescript` as the bare `Data*` shape (a backend Swagger-decorator bug - see the
 * schema file's "BACKEND API" comment), but the server actually sends the standard enveloped
 * response `{ data: Data*, ... }`, exactly like every other endpoint in this codebase including
 * this same plugin's own `GET /status`. `openapi-fetch` never validates a response against its
 * schema, so the value received at `apiResponse.data` at runtime is genuinely the full envelope
 * even though TypeScript believes it is already the bare payload - reading `.data` here recovers
 * the same thing the correctly-typed endpoints get for free from the generated type.
 */
export const unwrapBuggyEnvelope = (response: unknown): unknown => {
	if (response !== null && typeof response === 'object' && 'data' in response) {
		return (response as { data: unknown }).data;
	}

	logger.warn('Expected an enveloped Tailscale plugin response but received something else; passing it through as-is.');

	return response;
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
