import { Injectable } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { MCP_MODULE_NAME } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';
import { McpOAuthPublicUrls } from '../oauth/mcp-oauth.types';

@Injectable()
export class McpOAuthPublicUrlService {
	constructor(private readonly configService: ConfigService) {}

	getUrls(): McpOAuthPublicUrls | null {
		const publicBaseUrl = this.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME).oauthPublicBaseUrl;

		if (!publicBaseUrl) {
			return null;
		}

		const base = new URL(publicBaseUrl);
		const prefix = base.pathname === '/' ? '' : base.pathname;
		const resourcePath = `${prefix}/api/v1/modules/mcp`;
		const issuerPath = `${resourcePath}/oauth`;
		const issuer = `${base.origin}${issuerPath}`;

		return {
			publicBaseUrl,
			resource: `${base.origin}${resourcePath}`,
			protectedResourceMetadata: `${base.origin}/.well-known/oauth-protected-resource${resourcePath}`,
			issuer,
			authorizationServerMetadata: `${base.origin}/.well-known/oauth-authorization-server${issuerPath}`,
			authorizationEndpoint: `${issuer}/authorize`,
			tokenEndpoint: `${issuer}/token`,
			revocationEndpoint: `${issuer}/token/revocation`,
		};
	}
}
