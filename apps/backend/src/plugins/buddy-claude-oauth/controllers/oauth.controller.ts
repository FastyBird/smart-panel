import { FastifyRequest } from 'fastify';

import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Public } from '../../../modules/auth/guards/auth.guard';
import { OAuthFlowService } from '../../../modules/buddy/services/oauth-flow.service';
import {
	BUDDY_CLAUDE_OAUTH_AUTHORIZE_URL,
	BUDDY_CLAUDE_OAUTH_DEFAULT_CLIENT_ID,
	BUDDY_CLAUDE_OAUTH_PLUGIN_API_TAG_NAME,
	BUDDY_CLAUDE_OAUTH_PLUGIN_NAME,
	BUDDY_CLAUDE_OAUTH_SCOPES,
	BUDDY_CLAUDE_OAUTH_TOKEN_URL,
} from '../buddy-claude-oauth.constants';

@ApiTags(BUDDY_CLAUDE_OAUTH_PLUGIN_API_TAG_NAME)
@Controller('oauth')
export class BuddyClaudeOauthController {
	constructor(private readonly oauthFlowService: OAuthFlowService) {}

	@Public()
	@ApiOperation({
		tags: [BUDDY_CLAUDE_OAUTH_PLUGIN_API_TAG_NAME],
		summary: 'Start Claude OAuth authorization flow',
		description: 'Generates a PKCE-protected authorization URL for the Claude OAuth flow',
		operationId: 'get-buddy-claude-oauth-authorize',
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
		const resolvedClientId = clientId || BUDDY_CLAUDE_OAUTH_DEFAULT_CLIENT_ID;

		const redirectUri = origin ? `${origin}/callback` : `${req.protocol}://${req.headers.host}/callback`;

		const { authorizeUrl } = this.oauthFlowService.createFlow({
			authorizeUrl: BUDDY_CLAUDE_OAUTH_AUTHORIZE_URL,
			tokenUrl: BUDDY_CLAUDE_OAUTH_TOKEN_URL,
			clientId: resolvedClientId,
			redirectUri,
			scopes: BUDDY_CLAUDE_OAUTH_SCOPES,
			pluginType: BUDDY_CLAUDE_OAUTH_PLUGIN_NAME,
			extraParams: { code: 'true' },
			useJsonTokenExchange: true,
		});

		return { data: { authorize_url: authorizeUrl } };
	}
}
