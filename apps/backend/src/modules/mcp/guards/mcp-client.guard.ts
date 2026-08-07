import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { McpAuditDenialReason, McpAuditService } from '../services/mcp-audit.service';
import { McpPolicyRequest, McpPolicyService } from '../services/mcp-policy.service';
import { McpServerService } from '../services/mcp-server.service';

@Injectable()
export class McpClientGuard implements CanActivate {
	constructor(
		private readonly policyService: McpPolicyService,
		private readonly serverService: McpServerService,
		private readonly auditService: McpAuditService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<McpPolicyRequest>();
		const policyRevision = this.serverService.getPolicyRevision();
		const clientPolicyRevision =
			request.auth?.type === 'token' && request.auth.ownerId
				? this.serverService.getClientPolicyRevision(request.auth.ownerId)
				: 0;
		try {
			const policy = await this.policyService.resolve(request.auth);

			this.policyService.validateRequestOrigin(request, policy);
			request.mcpPolicy = { ...policy, clientPolicyRevision, policyRevision };
		} catch (error) {
			this.auditService.recordPolicyDenial(
				{
					requestId: this.auditService.getRequestId(request.body),
					...(request.auth?.type === 'token' && request.auth.ownerId ? { clientId: request.auth.ownerId } : {}),
				},
				this.getDenialReason(error),
			);

			throw error;
		}

		return true;
	}

	private getDenialReason(error: unknown): McpAuditDenialReason {
		if (error instanceof NotFoundException) {
			return 'endpoint_disabled';
		}

		if (error instanceof ForbiddenException) {
			return 'origin_denied';
		}

		return 'request_denied';
	}
}
