import { Injectable } from '@nestjs/common';

import {
	HomeyCloudProviderClient,
	HomeySdkClientFactoryService,
	isEligibleHomeyCloudProviderHomey,
	isSafeHomeyCloudProviderHomeyId,
} from '../connectors/homey-sdk.client';
import {
	HOMEY_CLOUD_MAX_AUTHORIZATION_CODE_LENGTH,
	HOMEY_CLOUD_MAX_HOMEY_NAME_LENGTH,
	HOMEY_CLOUD_PENDING_GRANT_TTL_MS,
} from '../devices-homey.constants';
import {
	HomeyCloudProviderError,
	HomeyCloudProviderErrorCategory,
	HomeyCloudProviderOperation,
	HomeyCloudSelectionError,
} from '../errors/homey-cloud-authorization.error';
import { HomeyCloudGrantConflictError } from '../errors/homey-cloud-grant.error';

import { HomeyCloudClientConfigService } from './homey-cloud-client-config.service';
import {
	HomeyCloudActiveGrantReference,
	HomeyCloudAuthorizationContext,
	HomeyCloudCandidateCredentials,
	HomeyCloudGrantMutationService,
} from './homey-cloud-grant-mutation.service';
import { runHomeyCloudProviderOperation } from './homey-cloud-provider-operation';
import { homeyCloudTokenExpiresAt, normalizeHomeyCloudToken } from './homey-cloud-token';

const UNICODE_CONTROL_PATTERN = /[\p{Cc}\p{Cf}]/u;

export interface HomeyCloudAuthorizationExchange extends HomeyCloudAuthorizationContext {
	readonly code: string;
	readonly redirectUrl: string;
	readonly transactionId: string;
}

export interface HomeyCloudChoice {
	readonly id: string;
	readonly name: string;
}

export interface HomeyCloudSelectionRequiredResult {
	readonly expiresAt: Date;
	readonly homeys: readonly HomeyCloudChoice[];
	readonly status: 'selection_required';
	readonly transactionId: string;
}

export interface HomeyCloudActivatedResult {
	readonly grant: HomeyCloudActiveGrantReference;
	readonly homey: HomeyCloudChoice;
	readonly status: 'activated';
}

export type HomeyCloudAuthorizationResult = HomeyCloudActivatedResult | HomeyCloudSelectionRequiredResult;

@Injectable()
export class HomeyCloudAuthorizationService {
	constructor(
		private readonly clientConfig: HomeyCloudClientConfigService,
		private readonly sdkClientFactory: HomeySdkClientFactoryService,
		private readonly grantMutations: HomeyCloudGrantMutationService,
	) {}

	async exchangeAuthorizationCode(input: HomeyCloudAuthorizationExchange): Promise<HomeyCloudAuthorizationResult> {
		this.assertExchange(input);
		await this.grantMutations.validateAuthorizationContext(input);

		const configuration = this.clientConfig.getConfiguration();

		if (configuration.redirectUrl !== input.redirectUrl) throw new HomeyCloudGrantConflictError();

		const provider = this.sdkClientFactory.createCloudProviderClient(configuration);
		const issuedAt = Date.now();
		const response = await runHomeyCloudProviderOperation(HomeyCloudProviderOperation.EXCHANGE_CODE, (signal) =>
			provider.exchangeAuthorizationCode(input.code, signal),
		);
		const token = normalizeHomeyCloudToken(response, issuedAt, HomeyCloudProviderOperation.EXCHANGE_CODE);
		const tokenExpiresAt = homeyCloudTokenExpiresAt(token, HomeyCloudProviderOperation.EXCHANGE_CODE);
		const { expiresAt } = await this.grantMutations.stageCandidate({
			activeGrantGeneration: input.activeGrantGeneration,
			authorityGeneration: input.authorityGeneration,
			configurationGeneration: input.configurationGeneration,
			initiatingUserId: input.initiatingUserId,
			redirectUrl: input.redirectUrl,
			transactionId: input.transactionId,
			expiresAt:
				tokenExpiresAt === null ? undefined : Math.min(issuedAt + HOMEY_CLOUD_PENDING_GRANT_TTL_MS, tokenExpiresAt),
			token,
		});

		try {
			const homeys = await this.loadEligibleHomeys(input.transactionId, input.initiatingUserId);

			if (homeys.length === 0) {
				throw new HomeyCloudProviderError(
					HomeyCloudProviderErrorCategory.NO_ELIGIBLE_HOMEYS,
					HomeyCloudProviderOperation.LIST_HOMEYS,
				);
			}

			if (homeys.length === 1) {
				return await this.activateSelectedHomey(input.transactionId, input.initiatingUserId, homeys[0].id, true);
			}

			return {
				status: 'selection_required',
				transactionId: input.transactionId,
				expiresAt: new Date(expiresAt),
				homeys,
			};
		} catch (error) {
			await this.clearTerminalCandidate(input.transactionId, input.initiatingUserId, error);
			throw error;
		}
	}

	async listCandidateHomeys(transactionId: string, initiatingUserId: string): Promise<readonly HomeyCloudChoice[]> {
		this.assertIdentifier(transactionId);
		this.assertIdentifier(initiatingUserId);

		try {
			const homeys = await this.loadEligibleHomeys(transactionId, initiatingUserId);

			if (homeys.length === 0) {
				throw new HomeyCloudProviderError(
					HomeyCloudProviderErrorCategory.NO_ELIGIBLE_HOMEYS,
					HomeyCloudProviderOperation.LIST_HOMEYS,
				);
			}

			return homeys;
		} catch (error) {
			await this.clearTerminalCandidate(transactionId, initiatingUserId, error);
			throw error;
		}
	}

	async selectHomey(
		transactionId: string,
		initiatingUserId: string,
		selectedHomeyId: string,
	): Promise<HomeyCloudActivatedResult> {
		this.assertIdentifier(transactionId);
		this.assertIdentifier(initiatingUserId);
		this.assertHomeyId(selectedHomeyId);

		try {
			return await this.activateSelectedHomey(transactionId, initiatingUserId, selectedHomeyId, false);
		} catch (error) {
			await this.clearTerminalCandidate(transactionId, initiatingUserId, error);
			throw error;
		}
	}

	private async activateSelectedHomey(
		transactionId: string,
		initiatingUserId: string,
		selectedHomeyId: string,
		requireSingleton: boolean,
	): Promise<HomeyCloudActivatedResult> {
		const candidate = await this.grantMutations.loadCandidateCredentials(transactionId, initiatingUserId);
		const provider = this.createCandidateProvider(candidate);
		const homeys = await this.getEligibleHomeys(provider);
		const selectedHomey = homeys.find((homey) => homey.id === selectedHomeyId);

		if (!selectedHomey || (requireSingleton && homeys.length !== 1)) throw new HomeyCloudSelectionError();

		await runHomeyCloudProviderOperation(HomeyCloudProviderOperation.AUTHENTICATE_HOMEY, (signal) =>
			provider.authenticateHomey(selectedHomey.id, signal, requireSingleton),
		);
		const grant = await this.grantMutations.activateCandidate(transactionId, initiatingUserId, selectedHomey.id);

		return { status: 'activated', homey: selectedHomey, grant };
	}

	private async loadEligibleHomeys(
		transactionId: string,
		initiatingUserId: string,
	): Promise<readonly HomeyCloudChoice[]> {
		const candidate = await this.grantMutations.loadCandidateCredentials(transactionId, initiatingUserId);

		return this.getEligibleHomeys(this.createCandidateProvider(candidate));
	}

	private createCandidateProvider(candidate: HomeyCloudCandidateCredentials): HomeyCloudProviderClient {
		const configuration = this.clientConfig.getConfiguration();

		if (configuration.redirectUrl !== candidate.redirectUrl) throw new HomeyCloudGrantConflictError();

		return this.sdkClientFactory.createCloudProviderClient({
			...configuration,
			token: candidate.token,
		});
	}

	private async getEligibleHomeys(provider: HomeyCloudProviderClient): Promise<readonly HomeyCloudChoice[]> {
		const response = await runHomeyCloudProviderOperation(HomeyCloudProviderOperation.LIST_HOMEYS, (signal) =>
			provider.getHomeys(signal),
		);
		const choices: HomeyCloudChoice[] = [];
		const identifiers = new Set<string>();

		if (!Array.isArray(response)) {
			throw new HomeyCloudProviderError(
				HomeyCloudProviderErrorCategory.PROTOCOL,
				HomeyCloudProviderOperation.LIST_HOMEYS,
			);
		}

		for (const homey of response as readonly unknown[]) {
			const choice = this.normalizeHomey(homey);

			if (!choice) continue;
			if (identifiers.has(choice.id)) {
				throw new HomeyCloudProviderError(
					HomeyCloudProviderErrorCategory.PROTOCOL,
					HomeyCloudProviderOperation.LIST_HOMEYS,
				);
			}

			identifiers.add(choice.id);
			choices.push(choice);
		}

		return choices.sort(
			(left, right) => this.compareStrings(left.name, right.name) || this.compareStrings(left.id, right.id),
		);
	}

	private normalizeHomey(homey: unknown): HomeyCloudChoice | null {
		if (typeof homey !== 'object' || homey === null || Array.isArray(homey)) return null;

		const record = homey as Record<string, unknown>;

		if (!isEligibleHomeyCloudProviderHomey(record)) return null;

		const providerText = typeof record.name === 'string' ? record.name : '';
		const normalizedText = [...providerText]
			.map((character) => (this.isControlCharacter(character) ? ' ' : character))
			.join('')
			.replace(/\s+/gu, ' ')
			.trim();
		const displayText = [...normalizedText].slice(0, HOMEY_CLOUD_MAX_HOMEY_NAME_LENGTH).join('');

		return { id: record.id, name: displayText || 'Homey' };
	}

	private async clearTerminalCandidate(transactionId: string, initiatingUserId: string, error: unknown): Promise<void> {
		if (error instanceof HomeyCloudProviderError && !error.retryable) {
			await this.grantMutations.cancelCandidate(transactionId, initiatingUserId);
		}
	}

	private assertExchange(input: HomeyCloudAuthorizationExchange): void {
		this.assertIdentifier(input.transactionId);
		this.assertIdentifier(input.initiatingUserId);
		this.assertIdentifier(input.redirectUrl);

		if (
			typeof input.code !== 'string' ||
			input.code.length === 0 ||
			input.code.length > HOMEY_CLOUD_MAX_AUTHORIZATION_CODE_LENGTH ||
			[...input.code].some((character) => /\s/u.test(character) || this.isControlCharacter(character))
		) {
			throw new TypeError('Homey Cloud authorization code is invalid');
		}
	}

	private assertHomeyId(value: string): void {
		this.assertIdentifier(value);

		if (!isSafeHomeyCloudProviderHomeyId(value)) {
			throw new TypeError('Homey Cloud Homey identifier is invalid');
		}
	}

	private assertIdentifier(value: string): void {
		if (typeof value !== 'string' || value.trim().length === 0 || this.containsControlCharacter(value)) {
			throw new TypeError('Homey Cloud authorization identifier is invalid');
		}
	}

	private containsControlCharacter(value: string): boolean {
		return [...value].some((character) => this.isControlCharacter(character));
	}

	private compareStrings(left: string, right: string): number {
		if (left < right) return -1;
		if (left > right) return 1;

		return 0;
	}

	private isControlCharacter(character: string): boolean {
		return UNICODE_CONTROL_PATTERN.test(character);
	}
}
