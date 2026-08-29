import { Injectable } from '@nestjs/common';

import {
	HomeyCloudProviderClient,
	HomeyCloudProviderTokenResponse,
	HomeySdkClientFactoryService,
	isEligibleHomeyCloudProviderHomey,
	isSafeHomeyCloudProviderHomeyId,
} from '../connectors/homey-sdk.client';
import {
	HOMEY_CLOUD_MAX_AUTHORIZATION_CODE_LENGTH,
	HOMEY_CLOUD_MAX_HOMEY_NAME_LENGTH,
	HOMEY_CLOUD_MAX_TOKEN_LENGTH,
	HOMEY_CLOUD_PENDING_GRANT_TTL_MS,
	HOMEY_CLOUD_PROVIDER_TIMEOUT_MS,
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
	HomeyCloudTokenMaterial,
} from './homey-cloud-grant-mutation.service';

const UNICODE_CONTROL_PATTERN = /[\p{Cc}\p{Cf}]/u;
const PROVIDER_TIMEOUT_CODES = new Set([
	'ABORTERROR',
	'ABORT_ERR',
	'ECONNABORTED',
	'ETIMEDOUT',
	'TIMEOUTERROR',
	'UND_ERR_BODY_TIMEOUT',
	'UND_ERR_CONNECT_TIMEOUT',
	'UND_ERR_HEADERS_TIMEOUT',
]);
const PROVIDER_UNAVAILABLE_CODES = new Set([
	'EAI_AGAIN',
	'ECONNREFUSED',
	'ECONNRESET',
	'EHOSTDOWN',
	'EHOSTUNREACH',
	'ENETDOWN',
	'ENETRESET',
	'ENETUNREACH',
	'ENOTFOUND',
	'EPIPE',
	'ERR_STREAM_PREMATURE_CLOSE',
	'UND_ERR_SOCKET',
]);

class ProviderTimeoutError extends Error {}

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
		const response = await this.runProviderOperation(HomeyCloudProviderOperation.EXCHANGE_CODE, (signal) =>
			provider.exchangeAuthorizationCode(input.code, signal),
		);
		const token = this.normalizeToken(response, issuedAt);
		const tokenExpiresAt = this.tokenExpiresAt(token);
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

		await this.runProviderOperation(HomeyCloudProviderOperation.AUTHENTICATE_HOMEY, (signal) =>
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
		const response = await this.runProviderOperation(HomeyCloudProviderOperation.LIST_HOMEYS, (signal) =>
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

		const rawName = typeof record.name === 'string' ? record.name : '';
		const normalizedName = [...rawName]
			.map((character) => (this.isControlCharacter(character) ? ' ' : character))
			.join('')
			.replace(/\s+/gu, ' ')
			.trim();
		const name = [...normalizedName].slice(0, HOMEY_CLOUD_MAX_HOMEY_NAME_LENGTH).join('');

		return { id: record.id, name: name || 'Homey' };
	}

	private normalizeToken(response: HomeyCloudProviderTokenResponse, issuedAt: number): HomeyCloudTokenMaterial {
		if (!response || typeof response !== 'object') {
			throw new HomeyCloudProviderError(
				HomeyCloudProviderErrorCategory.PROTOCOL,
				HomeyCloudProviderOperation.EXCHANGE_CODE,
			);
		}

		const tokenType = this.boundedString(response.token_type)?.toLowerCase();
		const accessToken = this.boundedString(response.access_token);
		const refreshToken = response.refresh_token == null ? null : this.boundedString(response.refresh_token);
		const grantType = response.grant_type == null ? null : this.boundedString(response.grant_type);
		const expiresIn = response.expires_in == null ? null : response.expires_in;

		if (
			tokenType !== 'bearer' ||
			!accessToken ||
			(response.refresh_token != null && !refreshToken) ||
			(response.grant_type != null && !grantType) ||
			(expiresIn !== null && (!Number.isSafeInteger(expiresIn) || (expiresIn as number) <= 0))
		) {
			throw new HomeyCloudProviderError(
				HomeyCloudProviderErrorCategory.PROTOCOL,
				HomeyCloudProviderOperation.EXCHANGE_CODE,
			);
		}

		return {
			tokenType,
			accessToken,
			refreshToken,
			expiresIn: expiresIn as number | null,
			grantType,
			issuedAt,
		};
	}

	private tokenExpiresAt(token: HomeyCloudTokenMaterial): number | null {
		if (token.expiresIn === null) return null;

		const lifetimeMs = token.expiresIn * 1000;
		const expiresAt = token.issuedAt + lifetimeMs;

		if (!Number.isSafeInteger(lifetimeMs) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
			throw new HomeyCloudProviderError(
				HomeyCloudProviderErrorCategory.INVALID_TOKEN,
				HomeyCloudProviderOperation.EXCHANGE_CODE,
			);
		}

		return expiresAt;
	}

	private boundedString(value: unknown): string | null {
		return typeof value === 'string' && value.length > 0 && value.length <= HOMEY_CLOUD_MAX_TOKEN_LENGTH ? value : null;
	}

	private async runProviderOperation<T>(
		operation: HomeyCloudProviderOperation,
		execute: (signal: AbortSignal) => Promise<T>,
	): Promise<T> {
		let timeout: NodeJS.Timeout | null = null;
		const controller = new AbortController();
		const timeoutError = new ProviderTimeoutError();

		try {
			return await Promise.race([
				execute(controller.signal),
				new Promise<never>((_resolve, reject) => {
					timeout = setTimeout(() => {
						controller.abort(timeoutError);
						reject(timeoutError);
					}, HOMEY_CLOUD_PROVIDER_TIMEOUT_MS);
					timeout.unref();
				}),
			]);
		} catch (error) {
			if (error instanceof HomeyCloudSelectionError) throw error;

			throw this.mapProviderError(error, operation);
		} finally {
			if (timeout) clearTimeout(timeout);
		}
	}

	private mapProviderError(error: unknown, operation: HomeyCloudProviderOperation): HomeyCloudProviderError {
		if (error instanceof HomeyCloudProviderError) return error;
		if (error instanceof ProviderTimeoutError) {
			return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.TIMEOUT, operation);
		}

		const records = this.providerErrorChain(error);
		const statusCode = records
			.flatMap((record) => [record.statusCode, record.status, record.code])
			.find((value): value is number => typeof value === 'number' && Number.isInteger(value));

		if (statusCode === 401 || (operation === HomeyCloudProviderOperation.EXCHANGE_CODE && statusCode === 400)) {
			return new HomeyCloudProviderError(
				operation === HomeyCloudProviderOperation.EXCHANGE_CODE
					? HomeyCloudProviderErrorCategory.INVALID_GRANT
					: HomeyCloudProviderErrorCategory.INVALID_TOKEN,
				operation,
			);
		}
		if (statusCode === 408 || statusCode === 504) {
			return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.TIMEOUT, operation);
		}
		if (statusCode === 429) {
			return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.RATE_LIMITED, operation);
		}
		if (statusCode !== undefined && statusCode >= 500) {
			return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.UNAVAILABLE, operation);
		}

		const codes = records.flatMap((record) =>
			[record.code, record.name, record.type]
				.filter((value): value is string => typeof value === 'string')
				.map((value) => value.toUpperCase()),
		);

		if (codes.some((code) => PROVIDER_TIMEOUT_CODES.has(code))) {
			return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.TIMEOUT, operation);
		}
		if (codes.some((code) => PROVIDER_UNAVAILABLE_CODES.has(code))) {
			return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.UNAVAILABLE, operation);
		}

		return new HomeyCloudProviderError(HomeyCloudProviderErrorCategory.PROTOCOL, operation);
	}

	private providerErrorChain(error: unknown): readonly Record<string, unknown>[] {
		const records: Record<string, unknown>[] = [];
		const seen = new Set<object>();
		let current = error;

		while (typeof current === 'object' && current !== null && records.length < 5 && !seen.has(current)) {
			seen.add(current);
			const record = current as Record<string, unknown>;

			records.push(record);
			current = record.cause;
		}

		return records;
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
