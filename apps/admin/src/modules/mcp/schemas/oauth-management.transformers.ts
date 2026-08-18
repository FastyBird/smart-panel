import { type ZodType, z } from 'zod';

import { snakeToCamel } from '../../../common';
import { McpApiException } from '../mcp.exceptions';

import {
	McpOAuthAccessTokenResSchema,
	McpOAuthAccessTokenSchema,
	McpOAuthClientResSchema,
	McpOAuthClientSchema,
	McpOAuthGrantResSchema,
	McpOAuthGrantSchema,
	McpOAuthRefreshFamilyResSchema,
	McpOAuthRefreshFamilySchema,
} from './oauth-management.schemas';
import type { IMcpOAuthAccessToken, IMcpOAuthClient, IMcpOAuthGrant, IMcpOAuthRefreshFamily } from './oauth-management.types';

/**
 * Validates a record against the wire shape generated from the backend's
 * OpenAPI spec before converting it, so a field the backend renames is
 * reported as the mismatch it is rather than surfacing as a missing property
 * further along.
 */
const transform = <TRes, TOut>(item: unknown, resSchema: ZodType<TRes>, schema: ZodType<TOut> | z.ZodTypeAny, label: string): TOut => {
	const wire = resSchema.safeParse(item);

	if (!wire.success) {
		throw new McpApiException(`Received ${label} does not match the API contract.`);
	}

	const parsed = (schema as z.ZodTypeAny).safeParse(snakeToCamel(wire.data as Record<string, unknown>));

	if (!parsed.success) {
		throw new McpApiException(`Failed to validate received ${label}.`);
	}

	return parsed.data as TOut;
};

export const transformOAuthClient = (item: unknown): IMcpOAuthClient =>
	transform(item, McpOAuthClientResSchema, McpOAuthClientSchema, 'OAuth client');

export const transformOAuthGrant = (item: unknown): IMcpOAuthGrant => transform(item, McpOAuthGrantResSchema, McpOAuthGrantSchema, 'OAuth grant');

export const transformOAuthAccessToken = (item: unknown): IMcpOAuthAccessToken =>
	transform(item, McpOAuthAccessTokenResSchema, McpOAuthAccessTokenSchema, 'OAuth access token');

export const transformOAuthRefreshFamily = (item: unknown): IMcpOAuthRefreshFamily =>
	transform(item, McpOAuthRefreshFamilyResSchema, McpOAuthRefreshFamilySchema, 'OAuth refresh family');
