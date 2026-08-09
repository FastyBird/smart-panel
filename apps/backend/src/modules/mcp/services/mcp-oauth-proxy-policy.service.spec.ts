import { FastifyRequest } from 'fastify';

import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { McpOAuthProxyPolicyService } from './mcp-oauth-proxy-policy.service';

describe('McpOAuthProxyPolicyService', () => {
	function request(headers: Record<string, string>, remoteAddress = '192.0.2.10'): FastifyRequest {
		return {
			headers,
			raw: { socket: { remoteAddress } },
		} as unknown as FastifyRequest;
	}

	it('rejects forwarded identity headers from an untrusted immediate peer', () => {
		const configService = { get: jest.fn().mockReturnValue('198.51.100.4') };
		const service = new McpOAuthProxyPolicyService(configService as unknown as ConfigService);

		expect(() => service.assertForwardedHeadersTrusted(request({ 'x-forwarded-host': 'attacker.example' }))).toThrow(
			ForbiddenException,
		);
	});

	it('accepts forwarded headers only from an explicitly listed immediate proxy', () => {
		const configService = { get: jest.fn().mockReturnValue('198.51.100.4, 192.0.2.10') };
		const service = new McpOAuthProxyPolicyService(configService as unknown as ConfigService);

		expect(() =>
			service.assertForwardedHeadersTrusted(
				request({ forwarded: 'host=attacker.example;proto=http', 'x-forwarded-proto': 'http' }),
			),
		).not.toThrow();
	});

	it('does not require proxy trust when no forwarded headers are present', () => {
		const configService = { get: jest.fn().mockReturnValue('invalid-value') };
		const service = new McpOAuthProxyPolicyService(configService as unknown as ConfigService);

		expect(() => service.assertForwardedHeadersTrusted(request({ host: 'panel.example.com' }))).not.toThrow();
	});
});
