import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { McpPolicyRequest, McpPolicyService } from '../services/mcp-policy.service';
import { McpServerService } from '../services/mcp-server.service';

@Injectable()
export class McpClientGuard implements CanActivate {
	constructor(
		private readonly policyService: McpPolicyService,
		private readonly serverService: McpServerService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<McpPolicyRequest>();
		const policyRevision = this.serverService.getPolicyRevision();
		const clientPolicyRevision =
			request.auth?.type === 'token' && request.auth.ownerId
				? this.serverService.getClientPolicyRevision(request.auth.ownerId)
				: 0;
		const policy = await this.policyService.resolve(request.auth);

		this.policyService.validateRequestOrigin(request, policy);
		request.mcpPolicy = { ...policy, clientPolicyRevision, policyRevision };

		return true;
	}
}
