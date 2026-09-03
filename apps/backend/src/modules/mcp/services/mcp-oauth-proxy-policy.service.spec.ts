import { FastifyRequest } from 'fastify';

import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TrustedProxyRegistryService } from '../../api/services/trusted-proxy-registry.service';

import { McpOAuthProxyPolicyService } from './mcp-oauth-proxy-policy.service';

describe('McpOAuthProxyPolicyService', () => {
	function request(headers: Record<string, string>, remoteAddress = '192.0.2.10'): FastifyRequest {
		return {
			headers,
			raw: { socket: { remoteAddress } },
		} as unknown as FastifyRequest;
	}

	function configService(trustedProxiesEnv: string): ConfigService {
		return { get: jest.fn().mockReturnValue(trustedProxiesEnv) } as unknown as ConfigService;
	}

	it('rejects forwarded identity headers from an untrusted immediate peer', () => {
		const service = new McpOAuthProxyPolicyService(configService('198.51.100.4'), new TrustedProxyRegistryService());

		expect(() => service.assertForwardedHeadersTrusted(request({ 'x-forwarded-host': 'attacker.example' }))).toThrow(
			ForbiddenException,
		);
	});

	it('accepts forwarded headers from a peer listed in FB_MCP_OAUTH_TRUSTED_PROXIES', () => {
		const service = new McpOAuthProxyPolicyService(
			configService('198.51.100.4, 192.0.2.10'),
			new TrustedProxyRegistryService(),
		);

		expect(() =>
			service.assertForwardedHeadersTrusted(
				request({ forwarded: 'host=attacker.example;proto=http', 'x-forwarded-proto': 'http' }),
			),
		).not.toThrow();
	});

	it('accepts forwarded headers from a peer trusted by the shared TrustedProxyRegistryService', () => {
		const trustedProxyRegistry = new TrustedProxyRegistryService();
		trustedProxyRegistry.register({ id: 'remote-access', addresses: () => ['192.0.2.10'] });

		// The env list is empty; only the registry (e.g. a connected Tailscale
		// Serve contributed by the remote-access module) trusts this peer.
		const service = new McpOAuthProxyPolicyService(configService(''), trustedProxyRegistry);

		expect(() => service.assertForwardedHeadersTrusted(request({ 'x-forwarded-for': '203.0.113.9' }))).not.toThrow();
	});

	it('rejects forwarded headers from a peer trusted by neither the env list nor the registry', () => {
		const trustedProxyRegistry = new TrustedProxyRegistryService();
		trustedProxyRegistry.register({ id: 'remote-access', addresses: () => ['203.0.113.9'] });

		const service = new McpOAuthProxyPolicyService(configService('198.51.100.4'), trustedProxyRegistry);

		expect(() =>
			service.assertForwardedHeadersTrusted(request({ 'x-forwarded-for': '203.0.113.9' }, '192.0.2.10')),
		).toThrow(ForbiddenException);
	});

	it('does not require proxy trust when no forwarded headers are present', () => {
		const service = new McpOAuthProxyPolicyService(configService('invalid-value'), new TrustedProxyRegistryService());

		expect(() => service.assertForwardedHeadersTrusted(request({ host: 'panel.example.com' }))).not.toThrow();
	});
});
