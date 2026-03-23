import { type ZodType, z } from 'zod';

import type {
	ConfigModuleModuleSchema,
	ConfigModuleUpdateModuleSchema,
} from '../../../openapi.constants';
import { ConfigModuleResSchema, ConfigModuleSchema, ConfigModuleUpdateReqSchema } from '../../config/store/config-modules.store.schemas';
import { STORAGE_MODULE_NAME } from '../storage.constants';

type ApiConfigModule = ConfigModuleModuleSchema;
type ApiConfigUpdateModule = ConfigModuleUpdateModuleSchema;

// STORE STATE
// ===========

export const StorageConfigSchema = ConfigModuleSchema.extend({
	type: z.literal(STORAGE_MODULE_NAME),
	primaryStorage: z.string(),
	fallbackStorage: z.string().optional(),
});

// BACKEND API
// ===========

export const StorageConfigUpdateReqSchema: ZodType<ApiConfigUpdateModule> = ConfigModuleUpdateReqSchema.and(
	z.object({
		type: z.literal(STORAGE_MODULE_NAME),
		primaryStorage: z.string().optional(),
		fallbackStorage: z.string().optional(),
	})
);

export const StorageConfigResSchema: ZodType<ApiConfigModule> = ConfigModuleResSchema.and(
	z.object({
		type: z.literal(STORAGE_MODULE_NAME),
		primaryStorage: z.string(),
		fallbackStorage: z.string().optional(),
	})
);
