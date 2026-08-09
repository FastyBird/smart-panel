import { AuthorizationServerMetadata } from '@modelcontextprotocol/server';

import { McpOAuthScope } from '../mcp.constants';

import { McpOAuthPublicUrls } from './mcp-oauth.types';

export type McpOAuthAuthorizationServerMetadata = AuthorizationServerMetadata & {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	revocation_endpoint: string;
	response_types_supported: string[];
	grant_types_supported: string[];
	code_challenge_methods_supported: string[];
	scopes_supported: string[];
	token_endpoint_auth_methods_supported: string[];
	authorization_response_iss_parameter_supported: boolean;
};

export const buildMcpOAuthAuthorizationServerMetadata = (
	urls: McpOAuthPublicUrls,
): McpOAuthAuthorizationServerMetadata => ({
	issuer: urls.issuer,
	authorization_endpoint: urls.authorizationEndpoint,
	token_endpoint: urls.tokenEndpoint,
	revocation_endpoint: urls.revocationEndpoint,
	response_types_supported: ['code'],
	grant_types_supported: ['authorization_code', 'refresh_token'],
	code_challenge_methods_supported: ['S256'],
	scopes_supported: Object.values(McpOAuthScope),
	token_endpoint_auth_methods_supported: ['none'],
	authorization_response_iss_parameter_supported: true,
});
