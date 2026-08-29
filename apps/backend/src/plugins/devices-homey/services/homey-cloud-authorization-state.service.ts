import { createHash, randomBytes } from 'crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';

import { HomeySdkClientFactoryService } from '../connectors/homey-sdk.client';
import {
	HOMEY_CLOUD_AUTHORIZATION_STATE_TTL_MS,
	HOMEY_CLOUD_MAX_PENDING_AUTHORIZATIONS,
	HOMEY_CLOUD_SCOPES,
} from '../devices-homey.constants';
import {
	HomeyCloudAuthorizationCapacityError,
	HomeyCloudAuthorizationStateError,
} from '../errors/homey-cloud-authorization.error';

import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';

interface PendingAuthorizationState {
	readonly activeGrantGeneration: number;
	readonly authorityGeneration: number;
	readonly configurationGeneration: number;
	cancelled: boolean;
	consumed: boolean;
	readonly expiresAt: number;
	readonly initiatingUserId: string;
	readonly redirectUrl: string;
	readonly timer: NodeJS.Timeout;
	readonly transactionId: string;
}

export interface HomeyCloudAuthorizationStart {
	readonly activeGrantGeneration: number;
	readonly authorityGeneration: number;
	readonly configurationGeneration: number;
	readonly initiatingUserId: string;
}

export interface HomeyCloudAuthorizationFlow {
	readonly authorizeUrl: string;
	readonly expiresAt: Date;
	readonly transactionId: string;
}

export interface HomeyCloudConsumedAuthorization {
	readonly activeGrantGeneration: number;
	readonly authorityGeneration: number;
	readonly configurationGeneration: number;
	readonly expiresAt: Date;
	readonly initiatingUserId: string;
	readonly redirectUrl: string;
	readonly transactionId: string;
}

@Injectable()
export class HomeyCloudAuthorizationStateService implements OnModuleDestroy {
	private readonly pending = new Map<string, PendingAuthorizationState>();

	constructor(
		private readonly clientConfig: HomeyCloudClientConfigService,
		private readonly sdkClientFactory: HomeySdkClientFactoryService,
	) {}

	create(start: HomeyCloudAuthorizationStart): HomeyCloudAuthorizationFlow {
		this.assertStart(start);

		if (this.pending.size >= HOMEY_CLOUD_MAX_PENDING_AUTHORIZATIONS) {
			throw new HomeyCloudAuthorizationCapacityError();
		}

		const configuration = this.clientConfig.getConfiguration();
		const state = randomBytes(32).toString('base64url');
		const stateHash = this.hashState(state);
		const transactionId = randomBytes(16).toString('base64url');
		const expiresAt = Date.now() + HOMEY_CLOUD_AUTHORIZATION_STATE_TTL_MS;
		const authorizeUrl = this.sdkClientFactory.createCloudAuthorizationUrl({
			clientId: configuration.clientId,
			clientSecret: configuration.clientSecret,
			redirectUrl: configuration.redirectUrl,
			scopes: [...HOMEY_CLOUD_SCOPES],
			state,
		});
		const timer = setTimeout(() => this.expire(stateHash), HOMEY_CLOUD_AUTHORIZATION_STATE_TTL_MS);

		timer.unref();

		this.pending.set(stateHash, {
			activeGrantGeneration: start.activeGrantGeneration,
			authorityGeneration: start.authorityGeneration,
			configurationGeneration: start.configurationGeneration,
			cancelled: false,
			consumed: false,
			expiresAt,
			initiatingUserId: start.initiatingUserId,
			redirectUrl: configuration.redirectUrl,
			timer,
			transactionId,
		});

		return {
			authorizeUrl,
			expiresAt: new Date(expiresAt),
			transactionId,
		};
	}

	consume(state: string): HomeyCloudConsumedAuthorization {
		if (typeof state !== 'string' || state.length === 0) throw new HomeyCloudAuthorizationStateError();

		const stateHash = this.hashState(state);
		const pending = this.pending.get(stateHash);

		if (!pending || pending.consumed) throw new HomeyCloudAuthorizationStateError();

		if (pending.expiresAt <= Date.now()) {
			this.remove(stateHash, pending);
			throw new HomeyCloudAuthorizationStateError();
		}

		pending.consumed = true;
		clearTimeout(pending.timer);

		return {
			activeGrantGeneration: pending.activeGrantGeneration,
			authorityGeneration: pending.authorityGeneration,
			configurationGeneration: pending.configurationGeneration,
			expiresAt: new Date(pending.expiresAt),
			initiatingUserId: pending.initiatingUserId,
			redirectUrl: pending.redirectUrl,
			transactionId: pending.transactionId,
		};
	}

	cancel(transactionId: string, initiatingUserId: string): boolean {
		this.assertCancellationContext(transactionId, initiatingUserId);

		for (const [stateHash, pending] of this.pending) {
			if (pending.transactionId !== transactionId || pending.initiatingUserId !== initiatingUserId) continue;

			if (pending.consumed) {
				if (pending.cancelled) return false;
				pending.cancelled = true;
			} else this.remove(stateHash, pending);

			return true;
		}

		return false;
	}

	complete(transactionId: string, initiatingUserId: string): void {
		this.assertCancellationContext(transactionId, initiatingUserId);

		for (const [stateHash, pending] of this.pending) {
			if (
				pending.consumed &&
				pending.transactionId === transactionId &&
				pending.initiatingUserId === initiatingUserId
			) {
				this.remove(stateHash, pending);
				return;
			}
		}
	}

	onModuleDestroy(): void {
		for (const pending of this.pending.values()) clearTimeout(pending.timer);

		this.pending.clear();
	}

	private assertStart(start: HomeyCloudAuthorizationStart): void {
		if (
			typeof start.initiatingUserId !== 'string' ||
			start.initiatingUserId.trim().length === 0 ||
			!Number.isSafeInteger(start.authorityGeneration) ||
			start.authorityGeneration < 0 ||
			!Number.isSafeInteger(start.activeGrantGeneration) ||
			start.activeGrantGeneration < 0 ||
			!Number.isSafeInteger(start.configurationGeneration) ||
			start.configurationGeneration < 0
		) {
			throw new TypeError('Homey Cloud authorization start context is invalid');
		}
	}

	private assertCancellationContext(transactionId: string, initiatingUserId: string): void {
		if (
			typeof transactionId !== 'string' ||
			transactionId.trim().length === 0 ||
			typeof initiatingUserId !== 'string' ||
			initiatingUserId.trim().length === 0
		) {
			throw new TypeError('Homey Cloud authorization cancellation context is invalid');
		}
	}

	private expire(stateHash: string): void {
		const pending = this.pending.get(stateHash);

		if (!pending) return;

		this.remove(stateHash, pending);
	}

	private remove(stateHash: string, pending: PendingAuthorizationState): void {
		this.pending.delete(stateHash);
		clearTimeout(pending.timer);
	}

	private hashState(state: string): string {
		return createHash('sha256').update(state).digest('base64url');
	}
}
