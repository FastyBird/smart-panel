import { ThrottlerStorage } from '@nestjs/throttler';

import {
	MCP_OAUTH_AUTHORIZE_RATE_LIMIT,
	MCP_OAUTH_RATE_LIMIT_TTL_MS,
	MCP_OAUTH_REVOCATION_RATE_LIMIT,
	MCP_OAUTH_TOKEN_RATE_LIMIT,
} from '../mcp.constants';

import { McpOAuthEndpointRateLimitService, McpOAuthRateLimitedEndpoint } from './mcp-oauth-endpoint-rate-limit.service';

describe('McpOAuthEndpointRateLimitService', () => {
	let increment: jest.MockedFunction<ThrottlerStorage['increment']>;
	let service: McpOAuthEndpointRateLimitService;

	beforeEach(() => {
		increment = jest.fn().mockResolvedValue({
			totalHits: 1,
			timeToExpire: MCP_OAUTH_RATE_LIMIT_TTL_MS,
			isBlocked: false,
			timeToBlockExpire: 0,
		});
		service = new McpOAuthEndpointRateLimitService({ increment } as ThrottlerStorage);
	});

	it.each([
		[McpOAuthRateLimitedEndpoint.AUTHORIZE, MCP_OAUTH_AUTHORIZE_RATE_LIMIT],
		[McpOAuthRateLimitedEndpoint.TOKEN, MCP_OAUTH_TOKEN_RATE_LIMIT],
		[McpOAuthRateLimitedEndpoint.REVOCATION, MCP_OAUTH_REVOCATION_RATE_LIMIT],
	])('uses the dedicated %s endpoint budget', async (endpoint, limit) => {
		await expect(service.consume(endpoint, '192.0.2.15')).resolves.toEqual({
			allowed: true,
			retryAfterSeconds: 60,
		});
		expect(increment).toHaveBeenCalledWith(
			`mcp-oauth:${endpoint}:192.0.2.15`,
			MCP_OAUTH_RATE_LIMIT_TTL_MS,
			limit,
			MCP_OAUTH_RATE_LIMIT_TTL_MS,
			`mcp-oauth-${endpoint}`,
		);
	});

	it('fails into a shared unknown-address budget when the immediate peer is unavailable', async () => {
		await service.consume(McpOAuthRateLimitedEndpoint.TOKEN);

		expect(increment).toHaveBeenCalledWith(
			'mcp-oauth:token:unknown',
			MCP_OAUTH_RATE_LIMIT_TTL_MS,
			MCP_OAUTH_TOKEN_RATE_LIMIT,
			MCP_OAUTH_RATE_LIMIT_TTL_MS,
			'mcp-oauth-token',
		);
	});

	it('returns a bounded retry-after value for blocked requests', async () => {
		increment.mockResolvedValue({
			totalHits: MCP_OAUTH_TOKEN_RATE_LIMIT + 1,
			timeToExpire: 12_001,
			isBlocked: true,
			timeToBlockExpire: 5_001,
		});

		await expect(service.consume(McpOAuthRateLimitedEndpoint.TOKEN, '192.0.2.15')).resolves.toEqual({
			allowed: false,
			retryAfterSeconds: 6,
		});
	});
});
