import { Injectable, OnApplicationBootstrap, ServiceUnavailableException } from '@nestjs/common';

export enum McpOAuthReadinessControl {
	AUTHORIZATION_DEADLINE_ABORT = 'authorization_deadline_abort',
	TARGETED_SUBSCRIPTION_ABORT = 'targeted_subscription_abort',
	LIVE_SCOPE_REDUCTION_ABORT = 'live_scope_reduction_abort',
	AWAITED_APPROVER_LIFECYCLE = 'awaited_approver_lifecycle',
	SUBSCRIPTION_MUTATION_GATE = 'subscription_mutation_gate',
	ARTIFACT_ISSUANCE_GATE = 'artifact_issuance_gate',
	PUBLIC_IDENTITY_ROTATION = 'public_identity_rotation',
	SERVER_SECRET_ROTATION = 'server_secret_rotation',
	OAUTH_SWITCH_OFF_INVALIDATION = 'oauth_switch_off_invalidation',
	ADMIN_REVOCATION = 'admin_revocation',
	AUDIT_HOOKS = 'audit_hooks',
	ENDPOINT_RATE_LIMITS = 'endpoint_rate_limits',
	COMPLETE_ROUTE_SET = 'complete_route_set',
}

export const MCP_OAUTH_REQUIRED_READINESS_CONTROLS = Object.freeze(Object.values(McpOAuthReadinessControl));

export interface McpOAuthReadinessSnapshot {
	verified: boolean;
	ready: boolean;
	registered: readonly McpOAuthReadinessControl[];
	missing: readonly McpOAuthReadinessControl[];
}

@Injectable()
export class McpOAuthReadinessService implements OnApplicationBootstrap {
	private readonly registeredControls = new Set<McpOAuthReadinessControl>();
	private verified = false;

	register(...controls: McpOAuthReadinessControl[]): void {
		if (this.verified) {
			throw new ServiceUnavailableException('MCP OAuth readiness registration is already sealed');
		}

		for (const control of controls) {
			this.registeredControls.add(control);
		}
	}

	onApplicationBootstrap(): void {
		this.verified = true;
	}

	verify(): McpOAuthReadinessSnapshot {
		if (!this.verified) {
			throw new ServiceUnavailableException('MCP OAuth readiness has not completed application bootstrap');
		}

		return this.snapshot;
	}

	assertReady(): void {
		const snapshot = this.verify();

		if (!snapshot.ready) {
			throw new ServiceUnavailableException('MCP OAuth security controls are not ready');
		}
	}

	get snapshot(): McpOAuthReadinessSnapshot {
		const registered = MCP_OAUTH_REQUIRED_READINESS_CONTROLS.filter((control) => this.registeredControls.has(control));
		const missing = MCP_OAUTH_REQUIRED_READINESS_CONTROLS.filter((control) => !this.registeredControls.has(control));

		return Object.freeze({
			verified: this.verified,
			ready: this.verified && missing.length === 0,
			registered: Object.freeze(registered),
			missing: Object.freeze(missing),
		});
	}
}
