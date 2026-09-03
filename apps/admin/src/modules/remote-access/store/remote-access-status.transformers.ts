import { logger, snakeToCamel } from '../../../common';
import { RemoteAccessValidationException } from '../remote-access.exceptions';

import {
	RemoteAccessProviderStatusEventSchema,
	RemoteAccessStatusSchema,
	RemoteAccessUrlsChangedEventSchema,
} from './remote-access-status.store.schemas';
import type { IRemoteAccessStatus, IRemoteAccessStatusRes } from './remote-access-status.store.types';

export const transformRemoteAccessStatusResponse = (response: IRemoteAccessStatusRes): IRemoteAccessStatus => {
	const parsed = RemoteAccessStatusSchema.safeParse(snakeToCamel(response));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessValidationException('Failed to validate received remote access status data.');
	}

	return parsed.data;
};

/**
 * Merges a `RemoteAccessModule.Provider.Status` event into the current status snapshot. The event
 * only ever updates a provider this store already knows about (from the initial `/status` fetch):
 * it never carries `kind`/`capabilities`, so there is nothing safe to construct for a provider seen
 * for the first time here. The aggregate `advisories` list is rebuilt the same way the backend's
 * `RemoteAccessPostureService` builds it - drop this provider's previous entries, append its fresh
 * ones, defaulting an untagged advisory's `provider` to the event's own type.
 */
export const applyRemoteAccessProviderStatusEvent = (status: IRemoteAccessStatus, payload: Record<string, unknown>): IRemoteAccessStatus => {
	const parsed = RemoteAccessProviderStatusEventSchema.safeParse(snakeToCamel(payload));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessValidationException('Failed to validate received remote access provider status event.');
	}

	const event = parsed.data;

	const index = status.providers.findIndex((provider) => provider.type === event.type);

	if (index === -1) {
		logger.warn(`Received a remote access status event for an unknown provider "${event.type}"; ignoring until the next fetch.`);

		return status;
	}

	const providers = [...status.providers];
	providers[index] = {
		...providers[index],
		state: event.state,
		endpoints: event.endpoints,
		message: event.message ?? null,
		details: event.details,
		proxyAddresses: event.proxyAddresses,
		advisories: event.advisories,
		updatedAt: event.updatedAt,
	};

	const advisories = [
		...status.advisories.filter((advisory) => advisory.provider !== event.type),
		...event.advisories.map((advisory) => ({ ...advisory, provider: advisory.provider ?? event.type })),
	];

	return { ...status, providers, advisories };
};

/**
 * Merges a `RemoteAccessModule.Urls.Changed` event into the current status snapshot. Unlike the REST
 * `/status` and `/urls` responses, the event never carries `candidates` (display-only LAN addresses),
 * so those are left untouched.
 */
export const applyRemoteAccessUrlsChangedEvent = (status: IRemoteAccessStatus, payload: Record<string, unknown>): IRemoteAccessStatus => {
	const parsed = RemoteAccessUrlsChangedEventSchema.safeParse(snakeToCamel(payload));

	if (!parsed.success) {
		logger.error('Schema validation failed with:', parsed.error);

		throw new RemoteAccessValidationException('Failed to validate received remote access URLs changed event.');
	}

	const event = parsed.data;

	return {
		...status,
		urls: {
			...status.urls,
			internal: event.internal,
			external: event.external,
			primary: event.primaryExternalUrl,
		},
	};
};
