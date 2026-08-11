import { Injectable } from '@nestjs/common';

import { McpAuditOutcome, McpAuditService } from './mcp-audit.service';
import { McpOAuthGlobalInvalidationService } from './mcp-oauth-global-invalidation.service';
import { McpOAuthRouteGateService } from './mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from './mcp-oauth-runtime.service';

export type McpOAuthSwitchOffCommit = () => Promise<void> | void;

@Injectable()
export class McpOAuthSwitchOffService {
	constructor(
		private readonly routeGate: McpOAuthRouteGateService,
		private readonly runtime: McpOAuthRuntimeService,
		private readonly globalInvalidation: McpOAuthGlobalInvalidationService,
		private readonly auditService: McpAuditService,
	) {}

	async disableInternal(commit: McpOAuthSwitchOffCommit): Promise<void> {
		this.routeGate.closeInternal();
		this.runtime.deactivateInternal();

		let commitFailed = false;
		const persist = async (): Promise<void> => {
			try {
				await commit();
			} catch (error) {
				commitFailed = true;
				throw error;
			}
		};

		try {
			await this.globalInvalidation.invalidate(['oauthEnabledGeneration'], persist);
		} catch (error) {
			if (commitFailed) {
				this.auditService.recordOAuthAuthorizationInvalidation({
					reasons: ['oauth_disabled'],
					authorizationProfile: 'oauth',
					outcome: McpAuditOutcome.PARTIAL,
				});
			}

			throw error;
		}

		this.auditService.recordOAuthAuthorizationInvalidation({
			reasons: ['oauth_disabled'],
			authorizationProfile: 'oauth',
			outcome: McpAuditOutcome.COMPLETED,
		});
	}
}
