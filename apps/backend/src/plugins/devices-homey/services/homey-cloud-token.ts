import { HomeyCloudProviderTokenResponse } from '../connectors/homey-sdk.client';
import { HOMEY_CLOUD_MAX_TOKEN_LENGTH } from '../devices-homey.constants';
import {
	HomeyCloudProviderError,
	HomeyCloudProviderErrorCategory,
	HomeyCloudProviderOperation,
} from '../errors/homey-cloud-authorization.error';

import { HomeyCloudTokenMaterial } from './homey-cloud-grant-mutation.service';

export interface HomeyCloudTokenFallback {
	readonly grantType: string | null;
	readonly refreshToken: string | null;
}

export function normalizeHomeyCloudToken(
	response: HomeyCloudProviderTokenResponse,
	issuedAt: number,
	operation: HomeyCloudProviderOperation,
	fallback: HomeyCloudTokenFallback = { grantType: null, refreshToken: null },
): HomeyCloudTokenMaterial {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		throw new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.PROTOCOL, operation);
	}

	const tokenType = boundedString(response.token_type)?.toLowerCase();
	const accessToken = boundedString(response.access_token);
	const refreshToken = response.refresh_token == null ? fallback.refreshToken : boundedString(response.refresh_token);
	const grantType = response.grant_type == null ? fallback.grantType : boundedString(response.grant_type);
	const expiresIn = response.expires_in == null ? null : response.expires_in;

	if (
		tokenType !== 'bearer' ||
		!accessToken ||
		(response.refresh_token != null && !refreshToken) ||
		(response.grant_type != null && !grantType) ||
		(expiresIn !== null && (!Number.isSafeInteger(expiresIn) || (expiresIn as number) <= 0)) ||
		!Number.isSafeInteger(issuedAt) ||
		issuedAt < 0
	) {
		throw new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.PROTOCOL, operation);
	}

	return {
		tokenType,
		accessToken,
		refreshToken,
		expiresIn: expiresIn as number | null,
		grantType,
		issuedAt,
	};
}

export function homeyCloudTokenExpiresAt(
	token: HomeyCloudTokenMaterial,
	operation: HomeyCloudProviderOperation,
	now = Date.now(),
): number | null {
	if (token.expiresIn === null) return null;

	const lifetimeMs = token.expiresIn * 1000;
	const expiresAt = token.issuedAt + lifetimeMs;

	if (!Number.isSafeInteger(lifetimeMs) || !Number.isSafeInteger(expiresAt) || expiresAt <= now) {
		throw new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.INVALID_TOKEN, operation);
	}

	return expiresAt;
}

export function homeyCloudTokenRequiresRefresh(
	token: HomeyCloudTokenMaterial,
	now: number,
	refreshSkewMs: number,
): boolean {
	if (token.expiresIn === null) return false;

	const lifetimeMs = token.expiresIn * 1000;
	const expiresAt = token.issuedAt + lifetimeMs;
	const refreshAt = now + refreshSkewMs;

	if (
		!Number.isSafeInteger(now) ||
		now < 0 ||
		!Number.isSafeInteger(refreshSkewMs) ||
		refreshSkewMs < 0 ||
		!Number.isSafeInteger(lifetimeMs) ||
		!Number.isSafeInteger(expiresAt) ||
		!Number.isSafeInteger(refreshAt)
	) {
		throw new HomeyCloudProviderError(
			HomeyCloudProviderErrorCategory.PROTOCOL,
			HomeyCloudProviderOperation.REFRESH_TOKEN,
		);
	}

	return expiresAt <= refreshAt;
}

function boundedString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 && value.length <= HOMEY_CLOUD_MAX_TOKEN_LENGTH ? value : null;
}
