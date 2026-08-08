import { McpModuleCapability } from '../../openapi.constants';

export const MCP_MODULE_PREFIX = 'mcp';

export const MCP_MODULE_NAME = 'mcp-module';

export const MCP_DEFAULT_TOKEN_EXPIRATION_DAYS = 90;

export const MCP_MAX_TOKEN_EXPIRATION_DAYS = 3650;

export const McpCapability = McpModuleCapability;

export type McpCapability = McpModuleCapability;

export const RouteNames = {
	CLIENTS: 'mcp_module-clients',
};
