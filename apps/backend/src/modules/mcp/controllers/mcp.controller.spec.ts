import { FastifyReply } from 'fastify';
import { ServerResponse } from 'node:http';

import { AuthInfo, OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';

import { McpCapability } from '../mcp.constants';
import { McpOAuthProxyPolicyService } from '../services/mcp-oauth-proxy-policy.service';
import { McpOAuthResourceServerService } from '../services/mcp-oauth-resource-server.service';
import { McpOAuthRouteGateService } from '../services/mcp-oauth-route-gate.service';
import { McpPolicyRequest, McpPolicyService } from '../services/mcp-policy.service';
import { McpServerService } from '../services/mcp-server.service';

import { McpController } from './mcp.controller';

describe('McpController', () => {
	let serverService: { handle: jest.Mock; handleOAuth: jest.Mock };
	let routeGate: { assertOpen: jest.Mock };
	let proxyPolicy: { assertForwardedHeadersTrusted: jest.Mock };
	let resourceServer: { verifyMcpBearerToken: jest.Mock; getBearerChallenge: jest.Mock };
	let policyService: { validateOAuthRequestOrigin: jest.Mock };
	let controller: McpController;

	beforeEach(() => {
		serverService = { handle: jest.fn(), handleOAuth: jest.fn() };
		routeGate = { assertOpen: jest.fn() };
		proxyPolicy = { assertForwardedHeadersTrusted: jest.fn() };
		resourceServer = { verifyMcpBearerToken: jest.fn(), getBearerChallenge: jest.fn() };
		policyService = { validateOAuthRequestOrigin: jest.fn() };
		controller = new McpController(
			serverService as unknown as McpServerService,
			routeGate as unknown as McpOAuthRouteGateService,
			proxyPolicy as unknown as McpOAuthProxyPolicyService,
			resourceServer as unknown as McpOAuthResourceServerService,
			policyService as unknown as McpPolicyService,
		);
	});

	it('preserves the existing static MCP request path without consulting OAuth', async () => {
		const request = { mcpPolicy: { client: { id: 'static-client' } } } as McpPolicyRequest;
		const reply = {} as FastifyReply;

		await controller.handle(request, reply);

		expect(serverService.handle).toHaveBeenCalledWith(request, reply);
		expect(routeGate.assertOpen).not.toHaveBeenCalled();
		expect(resourceServer.verifyMcpBearerToken).not.toHaveBeenCalled();
	});

	it('routes an OAuth bearer through the shared gate, proxy policy, origin policy, and isolated verifier', async () => {
		const authInfo = { token: 'opaque', clientId: 'public-client', scopes: ['read'] } as AuthInfo;
		const request = { headers: { authorization: 'Bearer opaque' } } as McpPolicyRequest;
		const reply = {} as FastifyReply;
		resourceServer.verifyMcpBearerToken.mockResolvedValue(authInfo);

		await controller.handle(request, reply);

		expect(routeGate.assertOpen).toHaveBeenCalledTimes(1);
		expect(proxyPolicy.assertForwardedHeadersTrusted).toHaveBeenCalledWith(request);
		expect(policyService.validateOAuthRequestOrigin).toHaveBeenCalledWith(request);
		expect(resourceServer.verifyMcpBearerToken).toHaveBeenCalledWith('Bearer opaque', [McpCapability.READ]);
		expect(serverService.handleOAuth).toHaveBeenCalledWith(request, reply, authInfo);
		expect(serverService.handle).not.toHaveBeenCalled();
	});

	it('returns the bounded RFC 6750 challenge from the OAuth verifier', async () => {
		const error = new OAuthError(OAuthErrorCode.InvalidToken, 'Invalid token');
		const challenge = new Response(null, {
			status: 401,
			headers: { 'www-authenticate': 'Bearer error="invalid_token", scope="mcp:read"' },
		});
		const hijack = jest.fn();
		const setHeader = jest.fn();
		const end = jest.fn();
		const response = {
			statusCode: 0,
			setHeader,
			end,
		} as unknown as ServerResponse;
		const reply = { hijack, raw: response } as unknown as FastifyReply;
		resourceServer.verifyMcpBearerToken.mockRejectedValue(error);
		resourceServer.getBearerChallenge.mockReturnValue(challenge);

		await controller.handle({ headers: {} } as McpPolicyRequest, reply);

		expect(resourceServer.getBearerChallenge).toHaveBeenCalledWith(error, [McpCapability.READ]);
		expect(hijack).toHaveBeenCalledTimes(1);
		expect(response.statusCode).toBe(401);
		expect(setHeader).toHaveBeenCalledWith('www-authenticate', 'Bearer error="invalid_token", scope="mcp:read"');
		expect(end).toHaveBeenCalledWith(Buffer.alloc(0));
	});
});
