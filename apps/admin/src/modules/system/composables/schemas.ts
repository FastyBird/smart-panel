import { z } from 'zod';

import { ConfigModuleSystemLog_levels, SystemModuleLogEntrySource } from '../../../openapi';

export const SystemLogsFilterSchema = z.object({
	search: z.string().optional(),
	levels: z.array(z.nativeEnum(ConfigModuleSystemLog_levels)).default([]),
	sources: z.array(z.nativeEnum(SystemModuleLogEntrySource)).default([]),
	tag: z.string().optional(),
});
