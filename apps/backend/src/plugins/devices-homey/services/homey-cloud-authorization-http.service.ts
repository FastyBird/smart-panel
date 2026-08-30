import { Injectable } from '@nestjs/common';

import { HOMEY_CLOUD_RESULT_PATH } from '../devices-homey.constants';
import { HomeyCloudGrantConflictError } from '../errors/homey-cloud-grant.error';

import {
	HomeyCloudAuthorizationFlow,
	HomeyCloudAuthorizationStateService,
	HomeyCloudConsumedAuthorization,
} from './homey-cloud-authorization-state.service';
import {
	HomeyCloudActivatedResult,
	HomeyCloudAuthorizationResult,
	HomeyCloudAuthorizationService,
	HomeyCloudChoice,
} from './homey-cloud-authorization.service';
import { HomeyCloudGrantMutationService } from './homey-cloud-grant-mutation.service';
import { HomeyCloudRuntimeService } from './homey-cloud-runtime.service';

export interface HomeyCloudCallbackInput {
	readonly code?: string;
	readonly providerError: boolean;
	readonly state?: string;
}

export type HomeyCloudCallbackOutcome = 'activated' | 'failed' | 'selection_required';

export interface HomeyCloudAuthorizationStatus {
	readonly connected: boolean;
	readonly selectedHomeyId: string | null;
}

export type HomeyCloudAuthorizationHomeys =
	| { readonly status: 'connected'; readonly homeyId: string; readonly homeys: readonly [] }
	| { readonly status: 'selection_required'; readonly homeyId: null; readonly homeys: readonly HomeyCloudChoice[] };

@Injectable()
export class HomeyCloudAuthorizationHttpService {
	constructor(
		private readonly authorizationState: HomeyCloudAuthorizationStateService,
		private readonly authorization: HomeyCloudAuthorizationService,
		private readonly grantMutations: HomeyCloudGrantMutationService,
		private readonly runtime: HomeyCloudRuntimeService,
	) {}

	async start(initiatingUserId: string): Promise<HomeyCloudAuthorizationFlow> {
		const context = await this.grantMutations.getAuthorizationContext(initiatingUserId);

		return this.authorizationState.create(context);
	}

	async getStatus(): Promise<HomeyCloudAuthorizationStatus> {
		const grant = await this.grantMutations.getActiveGrantReference();

		return {
			connected: grant !== null,
			selectedHomeyId: grant?.selectedHomeyId ?? null,
		};
	}

	async completeCallback(input: HomeyCloudCallbackInput): Promise<HomeyCloudCallbackOutcome> {
		let consumed: HomeyCloudConsumedAuthorization | null = null;

		try {
			consumed = this.authorizationState.consume(input.state ?? '');

			if (input.providerError || !input.code) return 'failed';

			const result: HomeyCloudAuthorizationResult = await this.authorization.exchangeAuthorizationCode({
				...consumed,
				code: input.code,
			});

			if (result.status === 'activated') this.runtime.activateGrant(() => this.grantMutations.hasActiveGrant());

			return result.status;
		} catch {
			return 'failed';
		} finally {
			if (consumed) this.authorizationState.complete(consumed.transactionId, consumed.initiatingUserId);
		}
	}

	async listHomeys(transactionId: string, initiatingUserId: string): Promise<HomeyCloudAuthorizationHomeys> {
		try {
			return {
				status: 'selection_required',
				homeyId: null,
				homeys: await this.authorization.listCandidateHomeys(transactionId, initiatingUserId),
			};
		} catch (error) {
			if (!(error instanceof HomeyCloudGrantConflictError)) throw error;

			const active = await this.grantMutations.getActiveGrantForTransaction(transactionId, initiatingUserId);
			if (!active) throw error;

			return { status: 'connected', homeyId: active.selectedHomeyId, homeys: [] };
		}
	}

	async selectHomey(
		transactionId: string,
		initiatingUserId: string,
		homeyId: string,
	): Promise<HomeyCloudActivatedResult> {
		const result = await this.authorization.selectHomey(transactionId, initiatingUserId, homeyId);
		this.runtime.activateGrant(() => this.grantMutations.hasActiveGrant());

		return result;
	}

	async cancel(transactionId: string, initiatingUserId: string): Promise<boolean> {
		const stateCancellation = this.authorizationState.cancel(transactionId, initiatingUserId);
		const grantCancelled = await this.grantMutations.cancelAuthorization(
			transactionId,
			initiatingUserId,
			stateCancellation.matched,
		);
		if (grantCancelled) await this.grantMutations.disconnectRuntimeWithoutGrant();

		return stateCancellation.changed || grantCancelled;
	}

	async disconnect(initiatingUserId: string): Promise<boolean> {
		const grantChanged = await this.grantMutations.disconnect(initiatingUserId);
		const stateChanged = this.authorizationState.clear() > 0;
		await this.grantMutations.disconnectRuntimeWithoutGrant();

		return grantChanged || stateChanged;
	}

	getResultUrl(): string {
		return HOMEY_CLOUD_RESULT_PATH;
	}
}
