import { z } from 'zod';

import { ConfigModuleEditFormSchema } from '../../config/schemas/modules.schemas';
import { McpCapability } from '../mcp.constants';

export const McpOriginSchema = z
	.string()
	.trim()
	.refine(
		(value): boolean => {
			try {
				const url = new URL(value);

				return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value && url.username === '' && url.password === '';
			} catch {
				return false;
			}
		},
		{ message: 'Origin must be an absolute HTTP(S) origin without a path, query, fragment, or credentials.' }
	);

export const McpConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	capabilities: z.array(z.nativeEnum(McpCapability)).default([McpCapability.read]),
	allowedOrigins: z.array(McpOriginSchema).default([]),
});
