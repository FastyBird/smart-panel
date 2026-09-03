import { type ZodType, z } from 'zod';

import type { ConfigModuleRemoteAccessSchema, ConfigModuleUpdateRemoteAccessSchema } from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';

type ApiConfigModule = ConfigModuleRemoteAccessSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateRemoteAccessSchema;

// STORE STATE
// ===========

export const RemoteAccessConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(REMOTE_ACCESS_MODULE_NAME),
	internalUrl: z.string().nullable().default(null),
	externalUrl: z.string().nullable().default(null),
	trustForwardedHeaders: z.boolean().default(false),
	trustedProxies: z.array(z.string()).default([]),
});

// BACKEND API
// ===========

export const RemoteAccessConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(REMOTE_ACCESS_MODULE_NAME),
		internal_url: z.string().nullable().optional(),
		external_url: z.string().nullable().optional(),
		trust_forwarded_headers: z.boolean().optional(),
		trusted_proxies: z.array(z.string()).optional(),
	})
);

export const RemoteAccessConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(REMOTE_ACCESS_MODULE_NAME),
		internal_url: z.string().nullable().optional(),
		external_url: z.string().nullable().optional(),
		trust_forwarded_headers: z.boolean(),
		trusted_proxies: z.array(z.string()),
	})
);
