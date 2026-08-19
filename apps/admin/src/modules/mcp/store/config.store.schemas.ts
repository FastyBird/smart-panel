import { type ZodType, z } from 'zod';

import type { ConfigModuleMcpSchema, ConfigModuleUpdateModuleSchema } from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { MCP_MODULE_NAME, McpCapability } from '../mcp.constants';

type ApiConfigModule = ConfigModuleMcpSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

export const McpConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(MCP_MODULE_NAME),
	oauthEnabled: z.boolean().default(false),
	oauthPublicBaseUrl: z.string().nullable().default(null),
	capabilities: z.array(z.nativeEnum(McpCapability)).default([McpCapability.read]),
	allowedOrigins: z.array(z.string()).default([]),
});

export const McpConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(MCP_MODULE_NAME),
		oauth_enabled: z.boolean().optional(),
		oauth_public_base_url: z.string().nullable().optional(),
		capabilities: z.array(z.nativeEnum(McpCapability)).optional(),
		allowed_origins: z.array(z.string()).optional(),
	})
);

export const McpConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(MCP_MODULE_NAME),
		oauth_enabled: z.boolean(),
		oauth_public_base_url: z.string().nullable(),
		capabilities: z.array(z.nativeEnum(McpCapability)),
		allowed_origins: z.array(z.string()),
	})
);
