import { z } from 'zod';

import type {
	McpClientCredentialSchema,
	McpClientSchema,
	McpCreateClientSchema,
	McpRotateClientSchema,
	McpUpdateClientSchema,
} from './client.schemas';

export type IMcpClient = z.infer<typeof McpClientSchema>;
export type IMcpClientCredential = z.infer<typeof McpClientCredentialSchema>;
export type IMcpCreateClient = z.input<typeof McpCreateClientSchema>;
export type IMcpUpdateClient = z.input<typeof McpUpdateClientSchema>;
export type IMcpRotateClient = z.input<typeof McpRotateClientSchema>;
