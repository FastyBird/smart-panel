import { Injectable } from '@nestjs/common';
import { InjectThrottlerStorage, ThrottlerStorage } from '@nestjs/throttler';

import {
	MCP_OAUTH_AUTHORIZE_RATE_LIMIT,
	MCP_OAUTH_RATE_LIMIT_TTL_MS,
	MCP_OAUTH_REVOCATION_RATE_LIMIT,
	MCP_OAUTH_TOKEN_RATE_LIMIT,
} from '../mcp.constants';

export enum McpOAuthRateLimitedEndpoint {
	AUTHORIZE = 'authorize',
	TOKEN = 'token',
	REVOCATION = 'revocation',
}

export interface McpOAuthRateLimitDecision {
	allowed: boolean;
	retryAfterSeconds: number;
}

const ENDPOINT_LIMITS: Readonly<Record<McpOAuthRateLimitedEndpoint, number>> = Object.freeze({
	[McpOAuthRateLimitedEndpoint.AUTHORIZE]: MCP_OAUTH_AUTHORIZE_RATE_LIMIT,
	[McpOAuthRateLimitedEndpoint.TOKEN]: MCP_OAUTH_TOKEN_RATE_LIMIT,
	[McpOAuthRateLimitedEndpoint.REVOCATION]: MCP_OAUTH_REVOCATION_RATE_LIMIT,
});

@Injectable()
export class McpOAuthEndpointRateLimitService {
	constructor(
		@InjectThrottlerStorage()
		private readonly storage: ThrottlerStorage,
	) {}

	async consume(endpoint: McpOAuthRateLimitedEndpoint, immediateAddress?: string): Promise<McpOAuthRateLimitDecision> {
		const address = immediateAddress?.trim() || 'unknown';
		const limit = ENDPOINT_LIMITS[endpoint];
		const result = await this.storage.increment(
			`mcp-oauth:${endpoint}:${address}`,
			MCP_OAUTH_RATE_LIMIT_TTL_MS,
			limit,
			MCP_OAUTH_RATE_LIMIT_TTL_MS,
			`mcp-oauth-${endpoint}`,
		);
		const retryAfterMs = result.timeToBlockExpire || result.timeToExpire;

		return {
			allowed: !result.isBlocked,
			retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1_000)),
		};
	}
}
