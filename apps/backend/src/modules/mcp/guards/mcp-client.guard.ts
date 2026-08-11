import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';

import { McpEndpointDisabledException } from '../mcp.exceptions';
import { McpAuditDenialReason, McpAuditService } from '../services/mcp-audit.service';
import { McpOAuthRouteGateService } from '../services/mcp-oauth-route-gate.service';
import { McpPolicyRequest, McpPolicyService } from '../services/mcp-policy.service';
import { McpServerService } from '../services/mcp-server.service';

@Injectable()
export class McpClientGuard implements CanActivate {
	constructor(
		private readonly policyService: McpPolicyService,
		private readonly serverService: McpServerService,
		private readonly auditService: McpAuditService,
		private readonly oauthRouteGate: McpOAuthRouteGateService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<McpPolicyRequest>();

		if (!request.auth && this.oauthRouteGate.isOpen) return true;

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
			const identity = {
				requestId: this.auditService.getRequestId(request.body),
				...(request.auth?.type === 'token' && request.auth.ownerId ? { clientId: request.auth.ownerId } : {}),
			};
			const denialReason = this.getDenialReason(error);

			if (denialReason) {
				this.auditService.recordPolicyDenial(identity, denialReason);
			} else {
				this.auditService.recordRequestFailure(identity, 'policy_resolution_error');
			}

			throw error;
		}

		return true;
	}

	private getDenialReason(error: unknown): McpAuditDenialReason | null {
		if (error instanceof McpEndpointDisabledException) {
			return 'endpoint_disabled';
		}

		if (error instanceof ForbiddenException) {
			return 'origin_denied';
		}

		return error instanceof UnauthorizedException ? 'request_denied' : null;
	}
}
