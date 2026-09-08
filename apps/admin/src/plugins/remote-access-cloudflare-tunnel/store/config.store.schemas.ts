import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import {
	type RemoteAccessCloudflareTunnelPluginConfigSchema,
	RemoteAccessCloudflareTunnelPluginProtocol,
	type RemoteAccessCloudflareTunnelPluginUpdateConfigSchema,
} from '../../../openapi.constants';
import { REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME } from '../remote-access-cloudflare-tunnel.constants';

type ApiConfig = RemoteAccessCloudflareTunnelPluginConfigSchema;
type ApiUpdateConfig = RemoteAccessCloudflareTunnelPluginUpdateConfigSchema;

export const CloudflareTunnelConfigSchema = ConfigPluginSchema.extend({
	// `public_hostname` is not a secret - the backend always returns it (never redacted), so it is
	// `.nullable()` only, never `.optional()`. Unlike `tunnelToken` below, getting this wrong would
	// not silently drop the field, but it would misrepresent a field the backend always sends as
	// "possibly absent" - exactly the kind of nullability mismatch the schema-binding tests below
	// guard against.
	publicHostname: z.string().nullable(),
	protocol: z.nativeEnum(RemoteAccessCloudflareTunnelPluginProtocol),
	// The backend redacts the token on read and answers with `tunnelTokenConfigured` instead - see
	// the identical note on `WebhookConfigSchema.url`. Stays declared so the edit form can write a
	// replacement into it before submitting; never present in a fetched status.
	tunnelToken: z.string().nullable().optional(),
	tunnelTokenConfigured: z.boolean().default(false),
});

// BACKEND API
// ===========

export const CloudflareTunnelConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME),
		public_hostname: z.string().nullable().optional(),
		protocol: z.nativeEnum(RemoteAccessCloudflareTunnelPluginProtocol).optional(),
		tunnel_token: z.string().nullable().optional(),
	})
);

export const CloudflareTunnelConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(REMOTE_ACCESS_CLOUDFLARE_TUNNEL_PLUGIN_NAME),
		public_hostname: z.string().nullable(),
		protocol: z.nativeEnum(RemoteAccessCloudflareTunnelPluginProtocol),
		tunnel_token: z.string().nullable().optional(),
		tunnel_token_configured: z.boolean(),
	})
);
