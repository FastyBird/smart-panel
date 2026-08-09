export const MCP_MODULE_PREFIX = 'mcp';

export const MCP_MODULE_NAME = 'mcp-module';

export const MCP_MODULE_API_TAG_NAME = 'MCP module';

export const MCP_MODULE_API_TAG_DESCRIPTION =
	'Model Context Protocol integration for exposing a curated, capability-scoped smart home agent surface.';

export const MCP_CATALOG_REGISTRAR = Symbol('MCP_CATALOG_REGISTRAR');

export enum McpCapability {
	READ = 'read',
	WRITE = 'write',
	TRIGGER = 'trigger',
}

export enum McpOAuthScope {
	READ = 'mcp:read',
	WRITE = 'mcp:write',
	TRIGGER = 'mcp:trigger',
	OFFLINE_ACCESS = 'offline_access',
}

export const MCP_DEFAULT_ENABLED = false;

export const MCP_DEFAULT_CAPABILITIES: readonly McpCapability[] = [McpCapability.READ];

export const MCP_DEFAULT_ALLOWED_ORIGINS: readonly string[] = [];

export const MCP_DEFAULT_OAUTH_PUBLIC_BASE_URL: string | null = null;

export const MCP_OAUTH_PRINCIPAL_TYPE = 'mcp_oauth';

export const MCP_OAUTH_SERVER_STATE_KEY = 'primary';

export const MCP_OAUTH_ACCESS_TOKEN_LIFETIME_MS = 10 * 60 * 1000;

export const MCP_OAUTH_REFRESH_FAMILY_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export const MCP_OAUTH_GRANT_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

export const MCP_OAUTH_INTERACTION_RATE_LIMIT = 10;

export const MCP_OAUTH_AUTHORIZE_RATE_LIMIT = 20;

export const MCP_OAUTH_TOKEN_RATE_LIMIT = 30;

export const MCP_OAUTH_REVOCATION_RATE_LIMIT = 30;

export const MCP_OAUTH_RATE_LIMIT_TTL_MS = 60 * 1000;

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

export const MCP_MAX_CONTEXT_SPACES = 50;

export const MCP_MAX_CONTEXT_DEVICES = 100;

export const MCP_MAX_CHANNELS_PER_DEVICE = 20;

export const MCP_MAX_PROPERTIES_PER_CHANNEL = 40;

export const MCP_MAX_CONTEXT_SCENES = 50;

export const MCP_MAX_WRITABLE_PROPERTIES = 100;

export const MCP_MAX_WRITABLE_PROPERTY_CANDIDATES = 500;

export const MCP_MAX_TRIGGER_SCENES = 50;

export const MCP_MAX_TRIGGER_SPACES = 50;

export const MCP_MAX_SECURITY_ALERTS = 20;

export const MCP_MAX_SECURITY_DEVICES = 100;

export const MCP_MAX_SECURITY_CHANNELS_PER_DEVICE = 10;

export const MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL = 20;

export const MCP_MAX_FORECAST_DAYS = 5;

export const MCP_MAX_TIMESERIES_RANGE_DAYS = 14;

export const MCP_MAX_TIMESERIES_POINTS = 500;

export const MCP_MAX_ENERGY_RANGE_DAYS = 31;
