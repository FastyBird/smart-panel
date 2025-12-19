import { z } from 'zod';

import { SystemModuleLogEntrySource, SystemModuleLogEntryType } from '../../../openapi.constants';

export const SystemLogsFilterSchema = z.object({
	search: z.string().optional(),
	levels: z.array(z.nativeEnum(SystemModuleLogEntryType)).default([]),
	sources: z.array(z.nativeEnum(SystemModuleLogEntrySource)).default([]),
	tag: z.string().optional(),
});
