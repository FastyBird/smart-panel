import { type ZodType, z } from 'zod';

import { snakeToCamel } from '../../../common';
import { McpApiException } from '../mcp.exceptions';

import { McpClientResSchema, McpClientSchema } from './client.schemas';
import type { IMcpClient } from './client.types';

/**
 * Validates a record against the wire shape generated from the backend's
 * OpenAPI spec before converting it, so a renamed field is reported as the
 * contract mismatch it is rather than as a missing property further along.
 */
const transform = <TRes, TOut>(item: unknown, resSchema: ZodType<TRes>, schema: z.ZodTypeAny, label: string): TOut => {
	const wire = resSchema.safeParse(item);

	if (!wire.success) {
		throw new McpApiException(`Received ${label} does not match the API contract.`);
	}

	const parsed = schema.safeParse(snakeToCamel(wire.data as Record<string, unknown>));

	if (!parsed.success) {
		throw new McpApiException(`Failed to validate received ${label}.`);
	}

	return parsed.data as TOut;
};

export const transformMcpClient = (item: unknown): IMcpClient => transform(item, McpClientResSchema, McpClientSchema, 'MCP client');
