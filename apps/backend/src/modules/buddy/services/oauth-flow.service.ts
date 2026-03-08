import { createHash, randomBytes } from 'crypto';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { BUDDY_MODULE_NAME } from '../buddy.constants';

export interface OAuthFlowParams {
	authorizeUrl: string;
	tokenUrl: string;
	clientId: string;
	redirectUri: string;
	scopes: string;
	pluginType: string;
	extraParams?: Record<string, string>;
	useJsonTokenExchange?: boolean;
}

export interface OAuthFlowResult {
	authorizeUrl: string;
	state: string;
}

export interface OAuthTokens {
	accessToken: string | null;
	refreshToken: string | null;
	clientId: string;
	pluginType: string;
}

interface PendingFlow {
	codeVerifier: string;
	tokenUrl: string;
	clientId: string;
	redirectUri: string;
	pluginType: string;
	useJsonTokenExchange: boolean;
	expiresAt: number;
}

const FLOW_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_EXCHANGE_TIMEOUT_MS = 15_000;

@Injectable()
export class OAuthFlowService {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'OAuthFlowService');
	private readonly pendingFlows = new Map<string, PendingFlow>();

	createFlow(params: OAuthFlowParams): OAuthFlowResult {
		this.cleanupExpired();

		const state = randomBytes(32).toString('hex');
		const codeVerifier = randomBytes(32).toString('base64url');
		const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

		this.pendingFlows.set(state, {
			codeVerifier,
			tokenUrl: params.tokenUrl,
			clientId: params.clientId,
			redirectUri: params.redirectUri,
			pluginType: params.pluginType,
			useJsonTokenExchange: params.useJsonTokenExchange ?? false,
			expiresAt: Date.now() + FLOW_TTL_MS,
		});

		const url = new URL(params.authorizeUrl);

		url.searchParams.set('response_type', 'code');
		url.searchParams.set('client_id', params.clientId);
		url.searchParams.set('redirect_uri', params.redirectUri);
		url.searchParams.set('state', state);
		url.searchParams.set('code_challenge', codeChallenge);
		url.searchParams.set('code_challenge_method', 'S256');

		if (params.scopes) {
			url.searchParams.set('scope', params.scopes);
		}

		if (params.extraParams) {
			for (const [key, value] of Object.entries(params.extraParams)) {
				url.searchParams.set(key, value);
			}
		}

		this.logger.debug(`Created OAuth flow state=${state.slice(0, 8)}...`);

		return { authorizeUrl: url.toString(), state };
	}

	async exchangeCode(state: string, code: string): Promise<OAuthTokens> {
		const flow = this.pendingFlows.get(state);

		if (!flow) {
			throw new Error('Invalid or expired OAuth state');
		}

		if (Date.now() > flow.expiresAt) {
			this.pendingFlows.delete(state);

			throw new Error('OAuth flow has expired');
		}

		this.pendingFlows.delete(state);

		this.logger.debug(`Exchanging authorization code state=${state.slice(0, 8)}...`);

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), TOKEN_EXCHANGE_TIMEOUT_MS);

		try {
			const tokenParams = {
				grant_type: 'authorization_code',
				code,
				redirect_uri: flow.redirectUri,
				client_id: flow.clientId,
				code_verifier: flow.codeVerifier,
			};

			const headers: Record<string, string> = flow.useJsonTokenExchange
				? { 'Content-Type': 'application/json' }
				: { 'Content-Type': 'application/x-www-form-urlencoded' };

			const body = flow.useJsonTokenExchange ? JSON.stringify(tokenParams) : new URLSearchParams(tokenParams);

			const response = await fetch(flow.tokenUrl, {
				method: 'POST',
				headers,
				body,
				signal: controller.signal,
			});

			if (!response.ok) {
				const body = await response.text().catch(() => '');

				this.logger.error(`Token exchange failed status=${response.status} body=${body}`);

				throw new Error(`Token exchange failed: ${response.status}`);
			}

			const data = (await response.json()) as {
				access_token?: string;
				refresh_token?: string;
			};

			this.logger.debug('Token exchange successful');

			return {
				accessToken: data.access_token ?? null,
				refreshToken: data.refresh_token ?? null,
				clientId: flow.clientId,
				pluginType: flow.pluginType,
			};
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private cleanupExpired(): void {
		const now = Date.now();

		for (const [state, flow] of this.pendingFlows) {
			if (now > flow.expiresAt) {
				this.pendingFlows.delete(state);
			}
		}
	}
}
