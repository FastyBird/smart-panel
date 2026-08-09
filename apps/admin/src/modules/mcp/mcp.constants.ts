import { McpModuleCapability, McpModuleOAuthScope } from '../../openapi.constants';

export const MCP_MODULE_PREFIX = 'mcp';

export const MCP_MODULE_NAME = 'mcp-module';

export const MCP_DEFAULT_TOKEN_EXPIRATION_DAYS = 90;

export const MCP_MAX_TOKEN_EXPIRATION_DAYS = 3650;

export const McpCapability = McpModuleCapability;

export type McpCapability = McpModuleCapability;

export const McpOAuthScope = {
	READ: McpModuleOAuthScope.mcp_read,
	WRITE: McpModuleOAuthScope.mcp_write,
	TRIGGER: McpModuleOAuthScope.mcp_trigger,
	OFFLINE_ACCESS: McpModuleOAuthScope.offline_access,
} as const;

export type McpOAuthScope = McpModuleOAuthScope;

export const RouteNames = {
	CLIENTS: 'mcp_module-clients',
	OAUTH_MANAGEMENT: 'mcp_module-oauth-management',
	OAUTH_CONSENT: 'mcp_module-oauth-consent',
};
