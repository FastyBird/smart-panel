import { type ZodType, z } from 'zod';

import { ConfigPluginResSchema, ConfigPluginSchema, ConfigPluginUpdateReqSchema } from '../../../modules/config/store/config-plugins.store.schemas';
import type { RemoteAccessTailscalePluginConfigSchema, RemoteAccessTailscalePluginUpdateConfigSchema } from '../../../openapi.constants';
import { REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME } from '../remote-access-tailscale.constants';

type ApiConfig = RemoteAccessTailscalePluginConfigSchema;
type ApiUpdateConfig = RemoteAccessTailscalePluginUpdateConfigSchema;

export const TailscaleConfigSchema = ConfigPluginSchema.extend({
	hostname: z.string(),
	loginServer: z.string(),
	acceptDns: z.boolean(),
	acceptRoutes: z.boolean(),
	advertiseTags: z.array(z.string()),
	ssh: z.boolean(),
	serveHttps: z.boolean(),
	funnel: z.boolean(),
});

// BACKEND API
// ===========

export const TailscaleConfigUpdateReqSchema: ZodType<ApiUpdateConfig> = ConfigPluginUpdateReqSchema.and(
	z.object({
		type: z.literal(REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME),
		hostname: z.string().optional(),
		login_server: z.string().optional(),
		accept_dns: z.boolean().optional(),
		accept_routes: z.boolean().optional(),
		advertise_tags: z.array(z.string()).optional(),
		ssh: z.boolean().optional(),
		serve_https: z.boolean().optional(),
		funnel: z.boolean().optional(),
	})
);

export const TailscaleConfigResSchema: ZodType<ApiConfig> = ConfigPluginResSchema.and(
	z.object({
		type: z.literal(REMOTE_ACCESS_TAILSCALE_PLUGIN_NAME),
		hostname: z.string(),
		login_server: z.string(),
		accept_dns: z.boolean(),
		accept_routes: z.boolean(),
		advertise_tags: z.array(z.string()),
		ssh: z.boolean(),
		serve_https: z.boolean(),
		funnel: z.boolean(),
	})
);
