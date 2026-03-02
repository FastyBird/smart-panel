import { FastifyRequest } from 'fastify';

import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Public } from '../../../modules/auth/guards/auth.guard';
import { OAuthFlowService } from '../../../modules/buddy/services/oauth-flow.service';
import {
	BUDDY_OPENAI_CODEX_AUTHORIZE_URL,
	BUDDY_OPENAI_CODEX_DEFAULT_CLIENT_ID,
	BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME,
	BUDDY_OPENAI_CODEX_PLUGIN_NAME,
	BUDDY_OPENAI_CODEX_SCOPES,
	BUDDY_OPENAI_CODEX_TOKEN_URL,
} from '../buddy-openai-codex.constants';

@ApiTags(BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME)
@Controller('oauth')
export class BuddyOpenaiCodexOauthController {
	constructor(private readonly oauthFlowService: OAuthFlowService) {}

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
		name: 'origin',
		description: 'Browser origin for OAuth redirect URI (e.g. http://localhost:3003)',
		required: false,
		type: 'string',
	})
	@Get('authorize')
	authorize(
		@Req() req: FastifyRequest,
		@Query('client_id') clientId?: string,
		@Query('origin') origin?: string,
	): { data: { authorize_url: string } } {
		const resolvedClientId = clientId || BUDDY_OPENAI_CODEX_DEFAULT_CLIENT_ID;

		const redirectUri = origin ? `${origin}/auth/callback` : `${req.protocol}://${req.headers.host}/auth/callback`;

		const { authorizeUrl } = this.oauthFlowService.createFlow({
			authorizeUrl: BUDDY_OPENAI_CODEX_AUTHORIZE_URL,
			tokenUrl: BUDDY_OPENAI_CODEX_TOKEN_URL,
			clientId: resolvedClientId,
			redirectUri,
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
}
