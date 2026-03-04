import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Public } from '../../../modules/auth/guards/auth.guard';
import { OAuthCallbackService } from '../../../modules/buddy/services/oauth-callback.service';
import { OAuthFlowService } from '../../../modules/buddy/services/oauth-flow.service';
import {
	BUDDY_OPENAI_CODEX_AUTHORIZE_URL,
	BUDDY_OPENAI_CODEX_DEFAULT_CLIENT_ID,
	BUDDY_OPENAI_CODEX_DEFAULT_REDIRECT_URI,
	BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME,
	BUDDY_OPENAI_CODEX_PLUGIN_NAME,
	BUDDY_OPENAI_CODEX_SCOPES,
	BUDDY_OPENAI_CODEX_TOKEN_URL,
} from '../buddy-openai-codex.constants';

@ApiTags(BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME)
@Controller('oauth')
export class BuddyOpenaiCodexOauthController {
	constructor(
		private readonly oauthFlowService: OAuthFlowService,
		private readonly oauthCallbackService: OAuthCallbackService,
	) {}

	@Public()
	@ApiOperation({
		tags: [BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME],
		summary: 'Start OpenAI Codex OAuth authorization flow',
		description: 'Generates a PKCE-protected authorization URL for the OpenAI Codex OAuth flow',
		operationId: 'get-buddy-openai-codex-oauth-authorize',
	})
	@ApiQuery({
		name: 'client_id',
		description: 'OAuth client ID (optional, uses default if omitted)',
		required: false,
		type: 'string',
	})
	@ApiQuery({
		name: 'redirect_uri',
		description: 'OAuth redirect URI (optional, uses default if omitted)',
		required: false,
		type: 'string',
	})
	@Get('authorize')
	authorize(
		@Query('client_id') clientId?: string,
		@Query('redirect_uri') redirectUri?: string,
	): { data: { authorize_url: string } } {
		const resolvedClientId = clientId || BUDDY_OPENAI_CODEX_DEFAULT_CLIENT_ID;
		const resolvedRedirectUri = redirectUri || BUDDY_OPENAI_CODEX_DEFAULT_REDIRECT_URI;

		const { authorizeUrl } = this.oauthFlowService.createFlow({
			authorizeUrl: BUDDY_OPENAI_CODEX_AUTHORIZE_URL,
			tokenUrl: BUDDY_OPENAI_CODEX_TOKEN_URL,
			clientId: resolvedClientId,
			redirectUri: resolvedRedirectUri,
			scopes: BUDDY_OPENAI_CODEX_SCOPES,
			pluginType: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
			extraParams: {
				codex_cli_simplified_flow: 'true',
				id_token_add_organizations: 'true',
				originator: 'codex_cli_rs',
			},
		});

		return { data: { authorize_url: authorizeUrl } };
	}

	@Public()
	@ApiOperation({
		tags: [BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME],
		summary: 'Exchange OAuth callback URL for tokens',
		description: 'Parses code and state from the callback URL, exchanges for tokens, and saves to config',
		operationId: 'post-buddy-openai-codex-oauth-exchange',
	})
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				callback_url: { type: 'string', description: 'The full callback URL containing code and state params' },
			},
			required: ['callback_url'],
		},
	})
	@Post('exchange')
	async exchange(@Body() body: { callback_url: string }): Promise<{ data: { success: boolean; error?: string } }> {
		const parsed = new URL(body.callback_url);
		const code = parsed.searchParams.get('code');
		const state = parsed.searchParams.get('state');

		if (!code || !state) {
			return { data: { success: false, error: 'Missing code or state in callback URL' } };
		}

		const result = await this.oauthCallbackService.handleCallback(code, state);

		return { data: { success: result.success, error: result.error } };
	}
}
