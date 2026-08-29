import { Injectable } from '@nestjs/common';

import { HOMEY_CLOUD_RESULT_PATH } from '../devices-homey.constants';

import {
	HomeyCloudAuthorizationFlow,
	HomeyCloudAuthorizationStateService,
} from './homey-cloud-authorization-state.service';
import {
	HomeyCloudActivatedResult,
	HomeyCloudAuthorizationResult,
	HomeyCloudAuthorizationService,
	HomeyCloudChoice,
} from './homey-cloud-authorization.service';
import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';
import { HomeyCloudGrantMutationService } from './homey-cloud-grant-mutation.service';

export interface HomeyCloudCallbackInput {
	readonly code?: string;
	readonly providerError: boolean;
	readonly state?: string;
}

export type HomeyCloudCallbackOutcome = 'activated' | 'failed' | 'selection_required';

@Injectable()
export class HomeyCloudAuthorizationHttpService {
	constructor(
		private readonly authorizationState: HomeyCloudAuthorizationStateService,
		private readonly authorization: HomeyCloudAuthorizationService,
		private readonly clientConfig: HomeyCloudClientConfigService,
		private readonly grantMutations: HomeyCloudGrantMutationService,
	) {}

	async start(initiatingUserId: string): Promise<HomeyCloudAuthorizationFlow> {
		const context = await this.grantMutations.getAuthorizationContext(initiatingUserId);

		return this.authorizationState.create(context);
	}

	async completeCallback(input: HomeyCloudCallbackInput): Promise<HomeyCloudCallbackOutcome> {
		try {
			const consumed = this.authorizationState.consume(input.state ?? '');

			if (input.providerError || !input.code) return 'failed';

			const result: HomeyCloudAuthorizationResult = await this.authorization.exchangeAuthorizationCode({
				...consumed,
				code: input.code,
			});

			return result.status;
		} catch {
			return 'failed';
		}
	}

	async listHomeys(transactionId: string, initiatingUserId: string): Promise<readonly HomeyCloudChoice[]> {
		return this.authorization.listCandidateHomeys(transactionId, initiatingUserId);
	}

	async selectHomey(
		transactionId: string,
		initiatingUserId: string,
		homeyId: string,
	): Promise<HomeyCloudActivatedResult> {
		return this.authorization.selectHomey(transactionId, initiatingUserId, homeyId);
	}

	async cancel(transactionId: string, initiatingUserId: string): Promise<boolean> {
		const stateCancelled = this.authorizationState.cancel(transactionId, initiatingUserId);
		const candidateCancelled = await this.grantMutations.cancelCandidate(transactionId, initiatingUserId);

		return stateCancelled || candidateCancelled;
	}

	async disconnect(initiatingUserId: string): Promise<boolean> {
		return this.grantMutations.disconnect(initiatingUserId);
	}

	getResultUrl(): string {
		try {
			return new URL(HOMEY_CLOUD_RESULT_PATH, this.clientConfig.getConfiguration().redirectUrl).toString();
		} catch {
			return HOMEY_CLOUD_RESULT_PATH;
		}
	}
}
