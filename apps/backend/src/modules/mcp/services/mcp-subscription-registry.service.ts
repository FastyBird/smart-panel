import { randomUUID } from 'crypto';

import { Injectable, OnApplicationShutdown } from '@nestjs/common';

import {
	MCP_MAX_ACTIVE_SUBSCRIPTIONS,
	MCP_MAX_SUBSCRIPTIONS_PER_CLIENT,
	MCP_SUBSCRIPTION_IDLE_TIMEOUT_MS,
} from '../mcp.constants';

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
	close: () => void;
	touch: () => void;
}

interface SubscriptionRecord {
	id: string;
	clientId: string;
	controller: AbortController;
	timer: NodeJS.Timeout;
}

@Injectable()
export class McpSubscriptionRegistryService implements OnApplicationShutdown {
	private readonly subscriptions = new Map<string, SubscriptionRecord>();

	open(clientId: string): McpSubscriptionHandle {
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
			controller,
			timer: this.createIdleTimer(id),
		};

		this.subscriptions.set(id, record);

		return {
			id,
			clientId,
			signal: controller.signal,
			close: () => this.close(id),
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
				this.close(subscription.id);
			}
		}
	}

	closeAll(): void {
		for (const id of [...this.subscriptions.keys()]) {
			this.close(id);
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

	private close(id: string): void {
		const subscription = this.subscriptions.get(id);

		if (!subscription) {
			return;
		}

		this.subscriptions.delete(id);
		clearTimeout(subscription.timer);
		subscription.controller.abort();
	}

	private createIdleTimer(id: string): NodeJS.Timeout {
		const timer = setTimeout(() => this.close(id), MCP_SUBSCRIPTION_IDLE_TIMEOUT_MS);
		timer.unref();

		return timer;
	}
}
