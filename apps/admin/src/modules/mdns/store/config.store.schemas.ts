import { type ZodType, z } from 'zod';

import type {
	ConfigModuleModuleSchema,
	ConfigModuleUpdateModuleSchema,
} from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { MDNS_MODULE_NAME } from '../mdns.constants';

type ApiConfigModule = ConfigModuleModuleSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const MdnsConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(MDNS_MODULE_NAME),
	serviceName: z.string(),
	serviceType: z.string(),
});

// BACKEND API
// ===========

export const MdnsConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(MDNS_MODULE_NAME),
		service_name: z.string().optional(),
		service_type: z.string().optional(),
	})
);

export const MdnsConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(MDNS_MODULE_NAME),
		service_name: z.string(),
		service_type: z.string(),
	})
);
