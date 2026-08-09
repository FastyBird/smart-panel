import { MCP_OAUTH_PRINCIPAL_TYPE, McpCapability, McpOAuthScope } from '../mcp.constants';

export interface McpOAuthPrincipal {
	type: typeof MCP_OAUTH_PRINCIPAL_TYPE;
	accessTokenId: string;
	authorizationDeadline: number;
	clientId: string;
	clientGeneration: number;
	effectiveScopes: McpOAuthScope[];
	grantId: string;
	grantGeneration: number;
	installationId: string;
	modulePolicyGeneration: number;
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
