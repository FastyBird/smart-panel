import { Injectable, OnModuleInit } from '@nestjs/common';

import { McpOAuthProviderFactory } from '../oauth/mcp-oauth-provider.factory';

import { McpAuditService } from './mcp-audit.service';
import { McpOAuthApproverAuthorityService } from './mcp-oauth-approver-authority.service';
import { McpOAuthEndpointRateLimitService } from './mcp-oauth-endpoint-rate-limit.service';
import { McpOAuthGlobalInvalidationService } from './mcp-oauth-global-invalidation.service';
import { McpOAuthManagementService } from './mcp-oauth-management.service';
import { McpOAuthModuleConfigMutationService } from './mcp-oauth-module-config-mutation.service';
import { McpOAuthReadinessControl, McpOAuthReadinessService } from './mcp-oauth-readiness.service';
import { McpOAuthSwitchOffService } from './mcp-oauth-switch-off.service';
import { McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

@Injectable()
export class McpOAuthReadinessRegistrationService implements OnModuleInit {
	constructor(
		private readonly readiness: McpOAuthReadinessService,
		private readonly subscriptions: McpSubscriptionRegistryService,
		private readonly approverAuthority: McpOAuthApproverAuthorityService,
		private readonly endpointRateLimit: McpOAuthEndpointRateLimitService,
		private readonly providerFactory: McpOAuthProviderFactory,
		private readonly globalInvalidation: McpOAuthGlobalInvalidationService,
		private readonly moduleConfigMutation: McpOAuthModuleConfigMutationService,
		private readonly management: McpOAuthManagementService,
		private readonly audit: McpAuditService,
		private readonly switchOff: McpOAuthSwitchOffService,
	) {}

	onModuleInit(): void {
		const registrations = new Map<McpOAuthReadinessControl, object>([
			[McpOAuthReadinessControl.AUTHORIZATION_DEADLINE_ABORT, this.subscriptions],
			[McpOAuthReadinessControl.TARGETED_SUBSCRIPTION_ABORT, this.subscriptions],
			[McpOAuthReadinessControl.LIVE_SCOPE_REDUCTION_ABORT, this.moduleConfigMutation],
			[McpOAuthReadinessControl.AWAITED_APPROVER_LIFECYCLE, this.approverAuthority],
			[McpOAuthReadinessControl.SUBSCRIPTION_MUTATION_GATE, this.subscriptions],
			[McpOAuthReadinessControl.ARTIFACT_ISSUANCE_GATE, this.providerFactory],
			[McpOAuthReadinessControl.PUBLIC_IDENTITY_ROTATION, this.globalInvalidation],
			[McpOAuthReadinessControl.SERVER_SECRET_ROTATION, this.globalInvalidation],
			[McpOAuthReadinessControl.ADMIN_REVOCATION, this.management],
			[McpOAuthReadinessControl.AUDIT_HOOKS, this.audit],
			[McpOAuthReadinessControl.ENDPOINT_RATE_LIMITS, this.endpointRateLimit],
			[McpOAuthReadinessControl.OAUTH_SWITCH_OFF_INVALIDATION, this.switchOff],
		]);

		this.readiness.register(...registrations.keys());
	}
}
