import { randomUUID } from 'crypto';

import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import {
	MCP_MAX_ACTIVE_SUBSCRIPTIONS,
	MCP_MAX_SUBSCRIPTIONS_PER_CLIENT,
	MCP_SUBSCRIPTION_CLOSE_TIMEOUT_MS,
	MCP_SUBSCRIPTION_IDLE_TIMEOUT_MS,
	McpOAuthScope,
} from '../mcp.constants';

import { McpAuditService, McpSubscriptionCloseReason } from './mcp-audit.service';

export class McpSubscriptionUnavailableError extends Error {}

export class McpSubscriptionCapacityError extends McpSubscriptionUnavailableError {
	constructor() {
		super('Subscription limit reached');
		this.name = McpSubscriptionCapacityError.name;
	}
}

export class McpSubscriptionClosingError extends McpSubscriptionUnavailableError {
	constructor() {
		super('Subscription service is closing');
		this.name = McpSubscriptionClosingError.name;
	}
}

export interface McpSubscriptionHandle {
	id: string;
	clientId: string;
	wireRequestId: number | string;
	signal: AbortSignal;
	attachTransport: () => void;
	close: (reason?: McpSubscriptionCloseReason) => void;
	completeTransport: () => void;
	touch: () => void;
}

export interface McpOAuthSubscriptionBinding {
	accessTokenId: string;
	approverAuthorityGeneration: number;
	approverId: string;
	grantId: string;
	refreshFamilyId?: string;
	authorizationDeadline: Date;
	effectiveScopes: McpOAuthScope[];
	modulePolicyGeneration: number;
	oauthEnabledGeneration: number;
	publicIdentityGeneration: number;
	serverSecretVersion: number;
	clientGeneration: number;
	grantGeneration: number;
}

export interface McpOAuthSubscriptionRegistration {
	clientId: string;
	binding: McpOAuthSubscriptionBinding;
}

export type McpOAuthGenerationAdvance = () => Promise<void>;

interface SubscriptionRecord {
	id: string;
	clientId: string;
	requestId: string;
	wireRequestId: number | string;
	controller: AbortController;
	timer: NodeJS.Timeout;
	authorizationTimer?: NodeJS.Timeout;
	oauth?: McpOAuthSubscriptionBinding;
	closing?: boolean;
	transportClosure?: { promise: Promise<void>; resolve: () => void };
}

@Injectable()
export class McpSubscriptionRegistryService implements OnApplicationShutdown {
	private readonly subscriptions = new Map<string, SubscriptionRecord>();
	private oauthGateTail: Promise<void> = Promise.resolve();
	private closeAllOperations = 0;

	constructor(private readonly auditService: McpAuditService) {}

	open(clientId: string, requestId = 'unknown', wireRequestId: number | string = requestId): McpSubscriptionHandle {
		if (this.closeAllOperations > 0) {
			throw new McpSubscriptionClosingError();
		}

		return this.openRecord(clientId, requestId, wireRequestId);
	}

	async openOAuth(
		requestId: string,
		revalidate: () => Promise<McpOAuthSubscriptionRegistration>,
		wireRequestId: number | string = requestId,
		trackTransportClosure = false,
	): Promise<McpSubscriptionHandle> {
		if (this.closeAllOperations > 0) {
			throw new McpSubscriptionClosingError();
		}

		return this.withOAuthGate(async () => {
			const registration = await revalidate();

			const handle = this.openRecord(registration.clientId, requestId, wireRequestId, registration.binding);
			if (trackTransportClosure) handle.attachTransport();

			return handle;
		});
	}

	private openRecord(
		clientId: string,
		requestId: string,
		wireRequestId: number | string,
		oauth?: McpOAuthSubscriptionBinding,
	): McpSubscriptionHandle {
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
			wireRequestId,
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
			wireRequestId,
			signal: controller.signal,
			attachTransport: () => this.attachTransport(id),
			close: (reason = 'completed') => this.close(id, reason),
			completeTransport: () => this.completeTransport(record),
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

	async closeOAuthClient(clientId: string, advanceGeneration: McpOAuthGenerationAdvance): Promise<void> {
		await this.closeOAuthMatching(
			advanceGeneration,
			(subscription) => subscription.clientId === clientId && subscription.oauth !== undefined,
		);
	}

	async closeOAuthGrant(grantId: string, advanceGeneration: McpOAuthGenerationAdvance): Promise<void> {
		await this.closeOAuthMatching(advanceGeneration, (subscription) => subscription.oauth?.grantId === grantId);
	}

	async closeOAuthApprover(approverId: string, advanceGeneration: McpOAuthGenerationAdvance): Promise<void> {
		await this.closeOAuthMatching(advanceGeneration, (subscription) => subscription.oauth?.approverId === approverId);
	}

	async runOAuthMutation<T>(operation: () => Promise<T>): Promise<T> {
		return this.withOAuthGate(operation);
	}

	async closeOAuthGrantScopeContractions(
		grantId: string,
		allowedScopes: McpOAuthScope[],
		advanceGeneration: McpOAuthGenerationAdvance,
	): Promise<void> {
		const allowed = new Set(allowedScopes);

		await this.closeOAuthMatching(
			advanceGeneration,
			(subscription) =>
				subscription.oauth?.grantId === grantId &&
				subscription.oauth.effectiveScopes.some((scope) => !allowed.has(scope)),
		);
	}

	async closeOAuthAccessToken(accessTokenId: string, advanceGeneration: McpOAuthGenerationAdvance): Promise<void> {
		await this.closeOAuthMatching(
			advanceGeneration,
			(subscription) => subscription.oauth?.accessTokenId === accessTokenId,
		);
	}

	async closeOAuthRefreshFamily(refreshFamilyId: string, advanceGeneration: McpOAuthGenerationAdvance): Promise<void> {
		await this.closeOAuthMatching(
			advanceGeneration,
			(subscription) => subscription.oauth?.refreshFamilyId === refreshFamilyId,
		);
	}

	async closeAllOAuth(advanceGeneration: McpOAuthGenerationAdvance): Promise<void> {
		await this.closeOAuthMatching(advanceGeneration, (subscription) => subscription.oauth !== undefined);
	}

	async closeOAuthScopeContractions(
		allowedScopes: McpOAuthScope[],
		advanceGeneration: McpOAuthGenerationAdvance,
	): Promise<void> {
		const allowed = new Set(allowedScopes);

		await this.closeOAuthMatching(
			advanceGeneration,
			(subscription) => subscription.oauth?.effectiveScopes.some((scope) => !allowed.has(scope)) === true,
		);
	}

	async closeAll(advanceGeneration?: McpOAuthGenerationAdvance): Promise<void> {
		this.closeAllOperations += 1;

		try {
			if (!advanceGeneration) {
				for (const id of [...this.subscriptions.keys()]) {
					this.close(id, 'shutdown');
				}
			}

			await this.withOAuthGate(async () => {
				if (advanceGeneration) await advanceGeneration();

				for (const id of [...this.subscriptions.keys()]) {
					this.close(id, 'shutdown');
				}
			});
		} finally {
			this.closeAllOperations -= 1;
		}
	}

	async onApplicationShutdown(): Promise<void> {
		await this.closeAll();
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
		if (subscription.closing) {
			if (reason !== 'authorization_revoked') {
				this.subscriptions.delete(id);
				subscription.transportClosure?.resolve();
			}

			return;
		}

		const awaitsTransport = reason === 'authorization_revoked' && subscription.transportClosure !== undefined;
		if (awaitsTransport) subscription.closing = true;
		else this.subscriptions.delete(id);
		clearTimeout(subscription.timer);
		if (subscription.authorizationTimer) clearTimeout(subscription.authorizationTimer);
		subscription.controller.abort();
		this.auditService.recordSubscriptionClosed(
			{ requestId: subscription.requestId, clientId: subscription.clientId },
			subscription.id,
			reason,
		);
	}

	private attachTransport(id: string): void {
		const subscription = this.subscriptions.get(id);

		if (!subscription || subscription.transportClosure) return;

		let resolve = (): void => undefined;
		const promise = new Promise<void>((resolver) => {
			resolve = resolver;
		});
		subscription.transportClosure = { promise, resolve };
	}

	private completeTransport(subscription: SubscriptionRecord): void {
		subscription.transportClosure?.resolve();
		if (subscription.closing) this.subscriptions.delete(subscription.id);
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

	private async closeMatching(predicate: (subscription: SubscriptionRecord) => boolean): Promise<void> {
		const transportClosures: Promise<void>[] = [];

		for (const subscription of [...this.subscriptions.values()]) {
			if (!predicate(subscription)) continue;

			if (subscription.transportClosure) {
				transportClosures.push(this.waitForTransportClosure(subscription.transportClosure.promise));
			}
			this.close(subscription.id, 'authorization_revoked');
		}

		await Promise.all(transportClosures);
	}

	private async waitForTransportClosure(closure: Promise<void>): Promise<void> {
		let timer: NodeJS.Timeout | undefined;

		try {
			await Promise.race([
				closure,
				new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new Error('MCP subscription transport did not acknowledge closure')),
						MCP_SUBSCRIPTION_CLOSE_TIMEOUT_MS,
					);
					timer.unref();
				}),
			]);
		} finally {
			if (timer) clearTimeout(timer);
		}
	}

	private async closeOAuthMatching(
		advanceGeneration: McpOAuthGenerationAdvance,
		predicate: (subscription: SubscriptionRecord) => boolean,
	): Promise<void> {
		await this.withOAuthGate(async () => {
			await advanceGeneration();
			await this.closeMatching(predicate);
		});
	}

	private async withOAuthGate<T>(operation: () => Promise<T>): Promise<T> {
		const previous = this.oauthGateTail;
		let release = (): void => undefined;

		this.oauthGateTail = new Promise<void>((resolve) => {
			release = resolve;
		});

		await previous;

		try {
			return await operation();
		} finally {
			release();
		}
	}
}
