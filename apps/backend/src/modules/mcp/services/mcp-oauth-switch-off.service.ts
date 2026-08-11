import { Injectable } from '@nestjs/common';

import {
	McpAuditOutcome,
	McpAuditService,
	McpOAuthAuthorizationProfile,
	McpOAuthInvalidationReason,
} from './mcp-audit.service';
import { McpOAuthGlobalGeneration, McpOAuthGlobalInvalidationService } from './mcp-oauth-global-invalidation.service';
import { McpOAuthRouteGateService } from './mcp-oauth-route-gate.service';
import { McpOAuthRuntimeService } from './mcp-oauth-runtime.service';

export type McpOAuthSwitchOffCommit = () => Promise<void> | void;

export interface McpOAuthSwitchOffOptions {
	generations?: McpOAuthGlobalGeneration[];
	reasons?: McpOAuthInvalidationReason[];
	authorizationProfile?: McpOAuthAuthorizationProfile;
}

@Injectable()
export class McpOAuthSwitchOffService {
	constructor(
		private readonly routeGate: McpOAuthRouteGateService,
		private readonly runtime: McpOAuthRuntimeService,
		private readonly globalInvalidation: McpOAuthGlobalInvalidationService,
		private readonly auditService: McpAuditService,
	) {}

	async disableInternal(commit: McpOAuthSwitchOffCommit, options: McpOAuthSwitchOffOptions = {}): Promise<void> {
		this.routeGate.closeInternal();
		this.runtime.deactivateInternal();
		const generations = options.generations ?? ['oauthEnabledGeneration'];
		const reasons = options.reasons ?? ['oauth_disabled'];
		const authorizationProfile = options.authorizationProfile ?? 'oauth';

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
			if (authorizationProfile === 'all') {
				await this.globalInvalidation.invalidateAll(generations, persist);
			} else {
				await this.globalInvalidation.invalidate(generations, persist);
			}
		} catch (error) {
			if (commitFailed) {
				this.auditService.recordOAuthAuthorizationInvalidation({
					reasons,
					authorizationProfile,
					outcome: McpAuditOutcome.PARTIAL,
				});
			}

			throw error;
		}

		this.auditService.recordOAuthAuthorizationInvalidation({
			reasons,
			authorizationProfile,
			outcome: McpAuditOutcome.COMPLETED,
		});
	}
}
