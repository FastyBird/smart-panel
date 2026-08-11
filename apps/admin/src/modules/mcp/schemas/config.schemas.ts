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

export const McpOAuthPublicBaseUrlSchema = z
	.string()
	.trim()
	.refine(
		(value): boolean => {
			try {
				const url = new URL(value);

				const normalized = `${url.origin}${url.pathname === '/' ? '' : url.pathname}`;

				return (
					url.protocol === 'https:' &&
					url.hostname !== '' &&
					url.username === '' &&
					url.password === '' &&
					url.search === '' &&
					url.hash === '' &&
					(url.pathname === '/' || !url.pathname.endsWith('/')) &&
					normalized === value
				);
			} catch {
				return false;
			}
		},
		{ message: 'OAuth public base URL must be an absolute HTTPS URL without credentials, query, fragment, or trailing slash.' }
	);

const McpOptionalOAuthPublicBaseUrlSchema = z.preprocess(
	(value): unknown => (value === '' ? null : value),
	z.union([McpOAuthPublicBaseUrlSchema, z.null()])
);

export const McpConfigEditFormSchema = ConfigModuleEditFormSchema.extend({
	oauthEnabled: z.boolean().default(false),
	oauthPublicBaseUrl: McpOptionalOAuthPublicBaseUrlSchema.default(null),
	capabilities: z.array(z.nativeEnum(McpCapability)).default([McpCapability.read]),
	allowedOrigins: z.array(McpOriginSchema).default([]),
}).superRefine((value, context): void => {
	if (value.enabled && value.oauthEnabled && value.oauthPublicBaseUrl === null) {
		context.addIssue({
			code: 'custom',
			path: ['oauthPublicBaseUrl'],
			message: 'Configure the OAuth public base URL before enabling OAuth.',
		});
	}
});
