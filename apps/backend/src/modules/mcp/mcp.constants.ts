import {
	HOME_CONTEXT_LIMIT_PROFILES,
	HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY,
} from '../home-context/home-context.constants';

const MCP_HOME_CONTEXT_LIMITS = HOME_CONTEXT_LIMIT_PROFILES[HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY];

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

export const MCP_DEFAULT_OAUTH_ENABLED = false;

export const MCP_OAUTH_PROVIDER_MATERIAL_FILENAME = '.mcp-oauth-provider.json';

export const MCP_OAUTH_PRINCIPAL_TYPE = 'mcp_oauth';

export const MCP_OAUTH_SERVER_STATE_KEY = 'primary';

export const MCP_OAUTH_RESOURCE_PATH = '/api/v1/modules/mcp';

export const MCP_OAUTH_ISSUER_PATH = `${MCP_OAUTH_RESOURCE_PATH}/oauth`;

export const MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_OAUTH_RESOURCE_PATH}`;

export const MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH = `/.well-known/oauth-authorization-server${MCP_OAUTH_ISSUER_PATH}`;

export const MCP_OAUTH_AUTHORIZATION_PATH = `${MCP_OAUTH_ISSUER_PATH}/authorize`;

export const MCP_OAUTH_TOKEN_PATH = `${MCP_OAUTH_ISSUER_PATH}/token`;

export const MCP_OAUTH_REVOCATION_PATH = `${MCP_OAUTH_TOKEN_PATH}/revocation`;

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

export const MCP_SUBSCRIPTION_CLOSE_TIMEOUT_MS = 5_000;

export const MCP_AUTHENTICATED_RATE_LIMIT = 120;

export const MCP_UNAUTHENTICATED_RATE_LIMIT = 10;

export const MCP_RATE_LIMIT_TTL_MS = 60 * 1000;

export const MCP_MAX_CONTEXT_SPACES = MCP_HOME_CONTEXT_LIMITS.spaces;

export const MCP_MAX_CONTEXT_DEVICES = MCP_HOME_CONTEXT_LIMITS.devices;

export const MCP_MAX_CHANNELS_PER_DEVICE = MCP_HOME_CONTEXT_LIMITS.channelsPerDevice;

export const MCP_MAX_PROPERTIES_PER_CHANNEL = MCP_HOME_CONTEXT_LIMITS.propertiesPerChannel;

export const MCP_MAX_CONTEXT_SCENES = MCP_HOME_CONTEXT_LIMITS.scenes;

export const MCP_MAX_WRITABLE_PROPERTIES = MCP_HOME_CONTEXT_LIMITS.writableProperties;

export const MCP_MAX_WRITABLE_PROPERTY_CANDIDATES = MCP_HOME_CONTEXT_LIMITS.writablePropertyCandidates;

export const MCP_MAX_TRIGGER_SCENES = MCP_HOME_CONTEXT_LIMITS.triggerScenes;

export const MCP_MAX_TRIGGER_SPACES = MCP_HOME_CONTEXT_LIMITS.triggerSpaces;

export const MCP_MAX_SECURITY_ALERTS = MCP_HOME_CONTEXT_LIMITS.securityAlerts;

export const MCP_MAX_SECURITY_DEVICES = MCP_HOME_CONTEXT_LIMITS.securityDevices;

export const MCP_MAX_SECURITY_CHANNELS_PER_DEVICE = MCP_HOME_CONTEXT_LIMITS.securityChannelsPerDevice;

export const MCP_MAX_SECURITY_PROPERTIES_PER_CHANNEL = MCP_HOME_CONTEXT_LIMITS.securityPropertiesPerChannel;

export const MCP_MAX_FORECAST_DAYS = MCP_HOME_CONTEXT_LIMITS.forecastDays;

export const MCP_MAX_TIMESERIES_RANGE_DAYS = MCP_HOME_CONTEXT_LIMITS.timeseriesRangeDays;

export const MCP_MAX_TIMESERIES_POINTS = MCP_HOME_CONTEXT_LIMITS.timeseriesPoints;

export const MCP_MAX_ENERGY_RANGE_DAYS = MCP_HOME_CONTEXT_LIMITS.energyRangeDays;
