import { MCP_OAUTH_PRINCIPAL_TYPE, McpCapability, McpOAuthScope } from '../mcp.constants';

export interface McpOAuthPrincipal {
	type: typeof MCP_OAUTH_PRINCIPAL_TYPE;
	accessTokenId: string;
	clientId: string;
	grantId: string;
	installationId: string;
	refreshFamilyId?: string;
	scopes: McpOAuthScope[];
	effectiveCapabilities: McpCapability[];
}

export interface McpOAuthPublicUrls {
	publicBaseUrl: string;
	resource: string;
	protectedResourceMetadata: string;
	issuer: string;
	authorizationServerMetadata: string;
	authorizationEndpoint: string;
	tokenEndpoint: string;
	revocationEndpoint: string;
}
