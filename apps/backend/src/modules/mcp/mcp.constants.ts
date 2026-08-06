export const MCP_MODULE_PREFIX = 'mcp';

export const MCP_MODULE_NAME = 'mcp-module';

export const MCP_MODULE_API_TAG_NAME = 'MCP module';

export const MCP_MODULE_API_TAG_DESCRIPTION =
	'Model Context Protocol integration for exposing a curated, capability-scoped smart home agent surface.';

export enum McpCapability {
	READ = 'read',
	WRITE = 'write',
	TRIGGER = 'trigger',
}

export const MCP_DEFAULT_ENABLED = false;

export const MCP_DEFAULT_CAPABILITIES: readonly McpCapability[] = [McpCapability.READ];

export const MCP_DEFAULT_ALLOWED_ORIGINS: readonly string[] = [];

export const MCP_DEFAULT_TOKEN_EXPIRATION_DAYS = 90;

export const MCP_MAX_TOKEN_EXPIRATION_DAYS = 3650;

export const IS_MCP_ENDPOINT_KEY = 'isMcpEndpoint';

export const MCP_REQUEST_BODY_LIMIT_BYTES = 1024 * 1024;

export const MCP_TOOL_CALL_TIMEOUT_MS = 30_000;

export const MCP_MAX_ACTIVE_SUBSCRIPTIONS = 100;

export const MCP_MAX_SUBSCRIPTIONS_PER_CLIENT = 5;

export const MCP_SUBSCRIPTION_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export const MCP_AUTHENTICATED_RATE_LIMIT = 120;

export const MCP_UNAUTHENTICATED_RATE_LIMIT = 10;

export const MCP_RATE_LIMIT_TTL_MS = 60 * 1000;
