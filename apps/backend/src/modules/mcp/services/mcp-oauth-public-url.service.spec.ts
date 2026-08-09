import { ConfigService } from '../../config/services/config.service';
import { MCP_MODULE_NAME } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';

import { McpOAuthPublicUrlService } from './mcp-oauth-public-url.service';

describe('McpOAuthPublicUrlService', () => {
	it('derives every identifier from the stored HTTPS base including a reverse-proxy prefix', () => {
		const config = Object.assign(new McpConfigModel(), {
			oauthPublicBaseUrl: 'https://panel.example.com/smart-panel',
		});
		const configService = {
			getModuleConfig: jest.fn().mockImplementation((type: string) => {
				expect(type).toBe(MCP_MODULE_NAME);
				return config;
			}),
		};
		const service = new McpOAuthPublicUrlService(configService as unknown as ConfigService);

		expect(service.getUrls()).toEqual({
			publicBaseUrl: 'https://panel.example.com/smart-panel',
			resource: 'https://panel.example.com/smart-panel/api/v1/modules/mcp',
			protectedResourceMetadata:
				'https://panel.example.com/.well-known/oauth-protected-resource/smart-panel/api/v1/modules/mcp',
			issuer: 'https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth',
			authorizationServerMetadata:
				'https://panel.example.com/.well-known/oauth-authorization-server/smart-panel/api/v1/modules/mcp/oauth',
			authorizationEndpoint: 'https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth/authorize',
			tokenEndpoint: 'https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth/token',
			revocationEndpoint: 'https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth/token/revocation',
		});
	});

	it('returns no public identity until the explicit configuration exists', () => {
		const configService = {
			getModuleConfig: jest.fn().mockReturnValue(new McpConfigModel()),
		};
		const service = new McpOAuthPublicUrlService(configService as unknown as ConfigService);

		expect(service.getUrls()).toBeNull();
	});
});
