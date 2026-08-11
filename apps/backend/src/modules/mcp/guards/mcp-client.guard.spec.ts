import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { McpEndpointDisabledException } from '../mcp.exceptions';
import { McpAuditService } from '../services/mcp-audit.service';
import { McpOAuthRouteGateService } from '../services/mcp-oauth-route-gate.service';
import { McpPolicyContext, McpPolicyRequest, McpPolicyService } from '../services/mcp-policy.service';
import { McpServerService } from '../services/mcp-server.service';

import { McpClientGuard } from './mcp-client.guard';

describe('McpClientGuard', () => {
	it('defers an unauthenticated request only to an open OAuth route gate', async () => {
		const request = {} as McpPolicyRequest;
		const policyService = { resolve: jest.fn(), validateRequestOrigin: jest.fn() };
		const guard = new McpClientGuard(
			policyService as unknown as McpPolicyService,
			{ getClientPolicyRevision: jest.fn(), getPolicyRevision: jest.fn() } as unknown as McpServerService,
			{} as McpAuditService,
			{ isOpen: true } as McpOAuthRouteGateService,
		);
		const context = {
			switchToHttp: () => ({ getRequest: () => request }),
		} as ExecutionContext;

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(policyService.resolve).not.toHaveBeenCalled();
	});

	it('resolves policy, validates transport origin, and attaches the context', async () => {
		const request = { auth: { type: 'token', ownerId: 'client-id' } } as McpPolicyRequest;
		const policy = { installationId: 'installation-id' } as McpPolicyContext;
		const policyService = {
			resolve: jest.fn().mockResolvedValue(policy),
			validateRequestOrigin: jest.fn(),
		};
		const serverService = {
			getClientPolicyRevision: jest.fn().mockReturnValue(3),
			getPolicyRevision: jest.fn().mockReturnValue(7),
		};
		const auditService = {
			getRequestId: jest.fn().mockReturnValue('request-1'),
			recordPolicyDenial: jest.fn(),
		};
		const guard = new McpClientGuard(
			policyService as unknown as McpPolicyService,
			serverService as unknown as McpServerService,
			auditService as unknown as McpAuditService,
			{ isOpen: false } as McpOAuthRouteGateService,
		);
		const context = {
			switchToHttp: () => ({ getRequest: () => request }),
		} as ExecutionContext;

		await expect(guard.canActivate(context)).resolves.toBe(true);
		expect(policyService.resolve).toHaveBeenCalledWith(request.auth);
		expect(policyService.validateRequestOrigin).toHaveBeenCalledWith(request, policy);
		expect(serverService.getClientPolicyRevision).toHaveBeenCalledWith('client-id');
		expect(request.mcpPolicy).toEqual({ ...policy, clientPolicyRevision: 3, policyRevision: 7 });
	});

	it.each([
		[new McpEndpointDisabledException(), 'endpoint_disabled'],
		[new ForbiddenException('Origin is not allowed'), 'origin_denied'],
		[new UnauthorizedException('MCP client is disabled'), 'request_denied'],
	])('records known policy rejections as denials', async (error, reason) => {
		const request = {
			auth: { type: 'token', ownerId: 'client-id' },
			body: { id: 'request-1' },
		} as McpPolicyRequest;
		const policyService = {
			resolve: jest.fn().mockRejectedValue(error),
			validateRequestOrigin: jest.fn(),
		};
		const auditService = {
			getRequestId: jest.fn().mockReturnValue('request-1'),
			recordPolicyDenial: jest.fn(),
			recordRequestFailure: jest.fn(),
		};
		const guard = new McpClientGuard(
			policyService as unknown as McpPolicyService,
			{ getClientPolicyRevision: jest.fn(), getPolicyRevision: jest.fn() } as unknown as McpServerService,
			auditService as unknown as McpAuditService,
			{ isOpen: false } as McpOAuthRouteGateService,
		);
		const context = {
			switchToHttp: () => ({ getRequest: () => request }),
		} as ExecutionContext;

		await expect(guard.canActivate(context)).rejects.toBe(error);
		expect(auditService.recordPolicyDenial).toHaveBeenCalledWith(
			{ requestId: 'request-1', clientId: 'client-id' },
			reason,
		);
		expect(auditService.recordRequestFailure).not.toHaveBeenCalled();
	});

	it('records policy-resolution outages as request failures instead of denials', async () => {
		const error = new Error('database unavailable');
		const request = {
			auth: { type: 'token', ownerId: 'client-id' },
			body: { id: 'request-1' },
		} as McpPolicyRequest;
		const policyService = {
			resolve: jest.fn().mockRejectedValue(error),
			validateRequestOrigin: jest.fn(),
		};
		const auditService = {
			getRequestId: jest.fn().mockReturnValue('request-1'),
			recordPolicyDenial: jest.fn(),
			recordRequestFailure: jest.fn(),
		};
		const guard = new McpClientGuard(
			policyService as unknown as McpPolicyService,
			{ getClientPolicyRevision: jest.fn(), getPolicyRevision: jest.fn() } as unknown as McpServerService,
			auditService as unknown as McpAuditService,
			{ isOpen: false } as McpOAuthRouteGateService,
		);
		const context = {
			switchToHttp: () => ({ getRequest: () => request }),
		} as ExecutionContext;

		await expect(guard.canActivate(context)).rejects.toBe(error);
		expect(auditService.recordPolicyDenial).not.toHaveBeenCalled();
		expect(auditService.recordRequestFailure).toHaveBeenCalledWith(
			{ requestId: 'request-1', clientId: 'client-id' },
			'policy_resolution_error',
		);
	});
});
