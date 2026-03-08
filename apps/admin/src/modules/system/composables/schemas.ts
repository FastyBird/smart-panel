import { z } from 'zod';

import { SystemModuleLogEntrySource, SystemModuleLogEntryType } from '../../../openapi.constants';

export const SystemLogsFilterSchema = z.object({
	search: z.string().optional(),
	levels: z.array(z.enum(SystemModuleLogEntryType)).default([]),
	sources: z.array(z.enum(SystemModuleLogEntrySource)).default([]),
	tag: z.string().optional(),
});
