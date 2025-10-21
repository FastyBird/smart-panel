import { CronExpressionParser } from 'cron-parser';
import { z } from 'zod';

import { ConfigPluginEditFormSchema } from '../../../modules/config';

const isValidCron = (expr: string): boolean => {
	try {
		// accepts 5- or 6-field expressions
		CronExpressionParser.parse(expr);

		return true;
	} catch {
		return false;
	}
};

export const RotatingFileConfigEditFormSchema = ConfigPluginEditFormSchema.extend({
	dir: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
	retentionDays: z.number().int().min(1),
	cleanupCron: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.refine((val) => val === null || isValidCron(val))
		.nullable()
		.optional(),
	filePrefix: z
		.string()
		.trim()
		.transform((val) => (val === '' ? null : val))
		.nullable()
		.optional(),
});
