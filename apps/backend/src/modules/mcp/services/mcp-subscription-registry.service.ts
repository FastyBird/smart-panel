import { randomUUID } from 'crypto';

import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import {
	MCP_MAX_ACTIVE_SUBSCRIPTIONS,
	MCP_MAX_SUBSCRIPTIONS_PER_CLIENT,
	MCP_SUBSCRIPTION_IDLE_TIMEOUT_MS,
	McpOAuthScope,
} from '../mcp.constants';

import { McpAuditService, McpSubscriptionCloseReason } from './mcp-audit.service';

export class McpSubscriptionCapacityError extends Error {
	constructor() {
		super('Subscription limit reached');
		this.name = McpSubscriptionCapacityError.name;
	}
}

export interface McpSubscriptionHandle {
	id: string;
	clientId: string;
	signal: AbortSignal;
	close: (reason?: McpSubscriptionCloseReason) => void;
	touch: () => void;
}

export interface McpOAuthSubscriptionBinding {
	accessTokenId: string;
	grantId: string;
	refreshFamilyId?: string;
	authorizationDeadline: Date;
	effectiveScopes: McpOAuthScope[];
	modulePolicyGeneration: number;
	clientGeneration: number;
	grantGeneration: number;
}

interface SubscriptionRecord {
	id: string;
	clientId: string;
	requestId: string;
	controller: AbortController;
	timer: NodeJS.Timeout;
	authorizationTimer?: NodeJS.Timeout;
	oauth?: McpOAuthSubscriptionBinding;
}

@Injectable()
export class McpSubscriptionRegistryService implements OnApplicationShutdown {
	private readonly subscriptions = new Map<string, SubscriptionRecord>();

	constructor(private readonly auditService: McpAuditService) {}

	open(clientId: string, requestId = 'unknown', oauth?: McpOAuthSubscriptionBinding): McpSubscriptionHandle {
		if (
			this.subscriptions.size >= MCP_MAX_ACTIVE_SUBSCRIPTIONS ||
			this.countForClient(clientId) >= MCP_MAX_SUBSCRIPTIONS_PER_CLIENT
		) {
			throw new McpSubscriptionCapacityError();
		}

		const id = randomUUID();
		const controller = new AbortController();
		const record: SubscriptionRecord = {
			id,
			clientId,
			requestId,
			controller,
			timer: this.createIdleTimer(id),
			...(oauth
				? {
						oauth: { ...oauth, effectiveScopes: [...oauth.effectiveScopes] },
						authorizationTimer: this.createAuthorizationTimer(id, oauth),
					}
				: {}),
		};

		this.subscriptions.set(id, record);
		this.auditService.recordSubscriptionOpened({ requestId, clientId }, id);

		return {
			id,
			clientId,
			signal: controller.signal,
			close: (reason = 'completed') => this.close(id, reason),
			touch: () => this.touch(id),
		};
	}

	get activeCount(): number {
		return this.subscriptions.size;
	}

	countForClient(clientId: string): number {
		let count = 0;

		for (const subscription of this.subscriptions.values()) {
			if (subscription.clientId === clientId) {
				count += 1;
			}
		}

		return count;
	}

	touchClient(clientId: string): void {
		for (const subscription of this.subscriptions.values()) {
			if (subscription.clientId === clientId) {
				this.touch(subscription.id);
			}
		}
	}

	closeClient(clientId: string): void {
		for (const subscription of [...this.subscriptions.values()]) {
			if (subscription.clientId === clientId) {
				this.close(subscription.id, 'client_closed');
			}
		}
	}

	closeOAuthClient(clientId: string): void {
		this.closeMatching((subscription) => subscription.clientId === clientId && subscription.oauth !== undefined);
	}

	closeOAuthGrant(grantId: string): void {
		this.closeMatching((subscription) => subscription.oauth?.grantId === grantId);
	}

	closeOAuthAccessToken(accessTokenId: string): void {
		this.closeMatching((subscription) => subscription.oauth?.accessTokenId === accessTokenId);
	}

	closeOAuthRefreshFamily(refreshFamilyId: string): void {
		this.closeMatching((subscription) => subscription.oauth?.refreshFamilyId === refreshFamilyId);
	}

	closeAllOAuth(): void {
		this.closeMatching((subscription) => subscription.oauth !== undefined);
	}

	closeAll(): void {
		for (const id of [...this.subscriptions.keys()]) {
			this.close(id, 'shutdown');
		}
	}

	onApplicationShutdown(): void {
		this.closeAll();
	}

	private touch(id: string): void {
		const subscription = this.subscriptions.get(id);

		if (!subscription) {
			return;
		}

		clearTimeout(subscription.timer);
		subscription.timer = this.createIdleTimer(id);
	}

	private close(id: string, reason: McpSubscriptionCloseReason): void {
		const subscription = this.subscriptions.get(id);

		if (!subscription) {
			return;
		}

		this.subscriptions.delete(id);
		clearTimeout(subscription.timer);
		if (subscription.authorizationTimer) clearTimeout(subscription.authorizationTimer);
		subscription.controller.abort();
		this.auditService.recordSubscriptionClosed(
			{ requestId: subscription.requestId, clientId: subscription.clientId },
			subscription.id,
			reason,
		);
	}

	private createIdleTimer(id: string): NodeJS.Timeout {
		const timer = setTimeout(() => this.close(id, 'idle'), MCP_SUBSCRIPTION_IDLE_TIMEOUT_MS);
		timer.unref();

		return timer;
	}

	private createAuthorizationTimer(id: string, oauth: McpOAuthSubscriptionBinding): NodeJS.Timeout {
		const delay = Math.max(0, oauth.authorizationDeadline.getTime() - Date.now());
		const timer = setTimeout(() => this.close(id, 'authorization_expired'), delay);
		timer.unref();

		return timer;
	}

	private closeMatching(predicate: (subscription: SubscriptionRecord) => boolean): void {
		for (const subscription of [...this.subscriptions.values()]) {
			if (predicate(subscription)) this.close(subscription.id, 'authorization_revoked');
		}
	}
}
