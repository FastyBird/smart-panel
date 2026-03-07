import { Logger } from '@nestjs/common';

export interface OAuthConfig {
	accessToken?: string | null;
	refreshToken?: string | null;
	clientId?: string | null;
	clientSecret?: string | null;
}

export interface OAuthTokenManagerOptions {
	tokenUrl: string;
	providerLabel: string;
	/** Token TTL in milliseconds. Defaults to 50 minutes. */
	ttlMs?: number;
	/** Refresh request timeout in milliseconds. Defaults to 10 seconds. */
	refreshTimeoutMs?: number;
}

/** Cached tokens are considered expired after this many milliseconds (50 minutes). */
const DEFAULT_TOKEN_TTL_MS = 50 * 60 * 1000;
const DEFAULT_REFRESH_TIMEOUT_MS = 10_000;

/**
 * Manages OAuth access-token caching, TTL-based expiry, and in-flight
 * promise deduplication for OAuth-based LLM provider plugins.
 */
export class OAuthTokenManager {
	private readonly logger: Logger;
	private readonly providerLabel: string;
	private readonly tokenUrl: string;
	private readonly ttlMs: number;
	private readonly refreshTimeoutMs: number;

	private cachedAccessToken: string | null = null;
	private cachedAccessTokenExpiresAt = 0;
	private inflightRefresh: Promise<string> | null = null;

	constructor(options: OAuthTokenManagerOptions) {
		this.logger = new Logger(`OAuthTokenManager:${options.providerLabel}`);
		this.providerLabel = options.providerLabel;
		this.tokenUrl = options.tokenUrl;
		this.ttlMs = options.ttlMs ?? DEFAULT_TOKEN_TTL_MS;
		this.refreshTimeoutMs = options.refreshTimeoutMs ?? DEFAULT_REFRESH_TIMEOUT_MS;
	}

	/**
	 * Resolve an access token from (in order of priority):
	 * 1. In-memory TTL cache
	 * 2. Static access_token from config
	 * 3. OAuth refresh_token grant (with in-flight deduplication)
	 */
	async resolveAccessToken(config: OAuthConfig | null): Promise<string> {
		if (this.cachedAccessToken && Date.now() < this.cachedAccessTokenExpiresAt) {
			return this.cachedAccessToken;
		}

		// Clear stale cache
		this.cachedAccessToken = null;

		if (config?.accessToken) {
			return config.accessToken;
		}

		if (config?.refreshToken && config?.clientId) {
			// Deduplicate concurrent refresh attempts
			if (this.inflightRefresh === null) {
				this.inflightRefresh = this.refreshAccessToken(config).finally(() => {
					this.inflightRefresh = null;
				});
			}

			const token = await this.inflightRefresh;

			this.cachedAccessToken = token;
			this.cachedAccessTokenExpiresAt = Date.now() + this.ttlMs;

			return token;
		}

		throw new Error(
			`${this.providerLabel}: No access token available — provide an access_token or a refresh_token + client_id`,
		);
	}

	private async refreshAccessToken(config: OAuthConfig): Promise<string> {
		this.logger.debug('Refreshing OAuth access token');

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.refreshTimeoutMs);

		try {
			const response = await fetch(this.tokenUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					grant_type: 'refresh_token',
					refresh_token: config.refreshToken ?? '',
					client_id: config.clientId ?? '',
					...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				this.logger.error(`OAuth token refresh failed with status ${response.status}`);

				throw new Error(`OAuth token refresh failed: ${response.status}`);
			}

			const data = (await response.json()) as { access_token?: string };

			if (!data.access_token) {
				throw new Error('OAuth token refresh returned no access_token');
			}

			return data.access_token;
		} finally {
			clearTimeout(timeoutId);
		}
	}
}
