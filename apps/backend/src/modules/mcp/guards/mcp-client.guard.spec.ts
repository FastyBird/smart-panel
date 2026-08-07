import { ExecutionContext } from '@nestjs/common';

import { McpPolicyContext, McpPolicyRequest, McpPolicyService } from '../services/mcp-policy.service';
import { McpServerService } from '../services/mcp-server.service';

import { McpClientGuard } from './mcp-client.guard';

describe('McpClientGuard', () => {
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
		const guard = new McpClientGuard(
			policyService as unknown as McpPolicyService,
			serverService as unknown as McpServerService,
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
});
