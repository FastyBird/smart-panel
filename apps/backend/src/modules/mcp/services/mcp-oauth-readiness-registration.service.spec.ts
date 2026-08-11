import { McpOAuthProviderFactory } from '../oauth/mcp-oauth-provider.factory';

import { McpAuditService } from './mcp-audit.service';
import { McpOAuthApproverAuthorityService } from './mcp-oauth-approver-authority.service';
import { McpOAuthGlobalInvalidationService } from './mcp-oauth-global-invalidation.service';
import { McpOAuthManagementService } from './mcp-oauth-management.service';
import { McpOAuthModuleConfigMutationService } from './mcp-oauth-module-config-mutation.service';
import { McpOAuthReadinessRegistrationService } from './mcp-oauth-readiness-registration.service';
import { McpOAuthReadinessControl, McpOAuthReadinessService } from './mcp-oauth-readiness.service';
import { McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

describe('McpOAuthReadinessRegistrationService', () => {
	it('registers only controls backed by the completed Phase 5 services', () => {
		const readiness = new McpOAuthReadinessService();
		const service = new McpOAuthReadinessRegistrationService(
			readiness,
			{} as McpSubscriptionRegistryService,
			{} as McpOAuthApproverAuthorityService,
			{} as McpOAuthProviderFactory,
			{} as McpOAuthGlobalInvalidationService,
			{} as McpOAuthModuleConfigMutationService,
			{} as McpOAuthManagementService,
			{} as McpAuditService,
		);

		service.onModuleInit();
		readiness.onApplicationBootstrap();

		expect(readiness.snapshot.ready).toBe(false);
		expect(readiness.snapshot.registered).toEqual([
			McpOAuthReadinessControl.AUTHORIZATION_DEADLINE_ABORT,
			McpOAuthReadinessControl.TARGETED_SUBSCRIPTION_ABORT,
			McpOAuthReadinessControl.LIVE_SCOPE_REDUCTION_ABORT,
			McpOAuthReadinessControl.AWAITED_APPROVER_LIFECYCLE,
			McpOAuthReadinessControl.SUBSCRIPTION_MUTATION_GATE,
			McpOAuthReadinessControl.ARTIFACT_ISSUANCE_GATE,
			McpOAuthReadinessControl.PUBLIC_IDENTITY_ROTATION,
			McpOAuthReadinessControl.SERVER_SECRET_ROTATION,
			McpOAuthReadinessControl.ADMIN_REVOCATION,
			McpOAuthReadinessControl.AUDIT_HOOKS,
		]);
		expect(readiness.snapshot.missing).toEqual([
			McpOAuthReadinessControl.OAUTH_SWITCH_OFF_INVALIDATION,
			McpOAuthReadinessControl.ENDPOINT_RATE_LIMITS,
			McpOAuthReadinessControl.COMPLETE_ROUTE_SET,
		]);
	});
});
