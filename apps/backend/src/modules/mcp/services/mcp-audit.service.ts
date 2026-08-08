import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { MCP_MODULE_NAME, McpCapability } from '../mcp.constants';

export enum McpAuditOutcome {
	COMPLETED = 'completed',
	PARTIAL = 'partial',
	FAILED = 'failed',
	TIMED_OUT = 'timed_out',
	DENIED = 'denied',
}

export type McpAuditDenialReason =
	| 'authentication_required'
	| 'invalid_credential'
	| 'authentication_error'
	| 'endpoint_disabled'
	| 'origin_denied'
	| 'policy_changed'
	| 'capability_denied'
	| 'request_denied';

export type McpSubscriptionCloseReason = 'cancelled' | 'client_closed' | 'completed' | 'error' | 'idle' | 'shutdown';

export interface McpAuditMetricsSnapshot {
	activeSubscriptions: number;
	callsByCapability: Record<McpCapability, number>;
	callsByTool: Record<string, number>;
	failures: number;
	denials: number;
	timeouts: number;
}

interface RequestIdentity {
	requestId: string;
	clientId?: string;
}

interface ToolResult extends RequestIdentity {
	tool: string;
	capability: McpCapability;
	durationMs: number;
	outcome: McpAuditOutcome;
	arguments?: Record<string, unknown>;
}

@Injectable()
export class McpAuditService {
	private readonly logger = createExtensionLogger(MCP_MODULE_NAME, 'McpAuditService');
	private activeSubscriptions = 0;
	private readonly callsByCapability: Record<McpCapability, number> = {
		[McpCapability.READ]: 0,
		[McpCapability.WRITE]: 0,
		[McpCapability.TRIGGER]: 0,
	};
	private readonly callsByTool = new Map<string, number>();
	private failures = 0;
	private denials = 0;
	private timeouts = 0;

	recordAuthenticationFailure(identity: RequestIdentity, reason: McpAuditDenialReason): void {
		this.log('authentication_failure', identity, { reason });
	}

	recordPolicyDenial(
		identity: RequestIdentity,
		reason: McpAuditDenialReason,
		options?: { capability?: McpCapability; tool?: string },
	): void {
		this.denials += 1;
		this.log('policy_denial', identity, {
			reason,
			...(options?.capability ? { capability: options.capability } : {}),
			...(options?.tool ? { tool: options.tool } : {}),
		});
	}

	recordProtocolRequest(
		identity: RequestIdentity,
		options: { kind: 'discovery' | 'initialization'; method: string; protocolVersion?: string },
	): void {
		this.log(options.kind, identity, {
			method: options.method,
			...(options.protocolVersion ? { protocol_version: options.protocolVersion } : {}),
		});
	}

	recordSubscriptionOpened(identity: RequestIdentity, subscriptionId: string): void {
		this.activeSubscriptions += 1;
		this.log('subscription_open', identity, { subscription_id: subscriptionId });
	}

	recordSubscriptionClosed(
		identity: RequestIdentity,
		subscriptionId: string,
		reason: McpSubscriptionCloseReason,
	): void {
		this.activeSubscriptions = Math.max(0, this.activeSubscriptions - 1);
		this.log('subscription_close', identity, { subscription_id: subscriptionId, reason });
	}

	recordToolResult(result: ToolResult): void {
		this.callsByCapability[result.capability] += 1;
		this.callsByTool.set(result.tool, (this.callsByTool.get(result.tool) ?? 0) + 1);

		if (result.outcome === McpAuditOutcome.TIMED_OUT) {
			this.timeouts += 1;
		} else if (result.outcome === McpAuditOutcome.FAILED) {
			this.failures += 1;
		}

		this.log('tool_execution', result, {
			tool: result.tool,
			capability: result.capability,
			duration_ms: Math.max(0, Math.round(result.durationMs)),
			outcome: result.outcome,
			...this.getTargetIds(result.tool, result.arguments),
		});
	}

	getMetricsSnapshot(): McpAuditMetricsSnapshot {
		return {
			activeSubscriptions: this.activeSubscriptions,
			callsByCapability: { ...this.callsByCapability },
			callsByTool: Object.fromEntries(this.callsByTool),
			failures: this.failures,
			denials: this.denials,
			timeouts: this.timeouts,
		};
	}

	getRequestId(body: unknown): string {
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return 'unknown';
		}

		const id = (body as { id?: unknown }).id;

		return typeof id === 'string' || typeof id === 'number' ? String(id) : 'unknown';
	}

	private getTargetIds(tool: string, args?: Record<string, unknown>): Record<string, string> {
		if (!args) {
			return {};
		}

		const key =
			tool === 'set_device_property'
				? 'property_id'
				: tool === 'run_scene'
					? 'scene_id'
					: tool === 'set_space_lighting'
						? 'space_id'
						: undefined;

		if (!key || typeof args[key] !== 'string') {
			return {};
		}

		return { [key]: args[key] };
	}

	private log(event: string, identity: RequestIdentity, details: Record<string, unknown>): void {
		this.logger.log('MCP audit event', {
			event,
			request_id: identity.requestId,
			...(identity.clientId ? { client_id: identity.clientId } : {}),
			...details,
		});
	}
}
