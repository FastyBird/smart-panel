import { describe, expect, it } from 'vitest';

import { McpCapability } from '../mcp.constants';
import { isCapabilitySubset } from '../mcp.utils';

import { McpCreateClientSchema } from './client.schemas';
import { McpConfigEditFormSchema, McpOriginSchema } from './config.schemas';

describe('MCP admin schemas', () => {
	const capabilityCombinations = [
		[],
		[McpCapability.read],
		[McpCapability.write],
		[McpCapability.trigger],
		[McpCapability.read, McpCapability.write],
		[McpCapability.read, McpCapability.trigger],
		[McpCapability.write, McpCapability.trigger],
		[McpCapability.read, McpCapability.write, McpCapability.trigger],
	];

	it.each(capabilityCombinations.map((capabilities) => [capabilities]))('accepts module capability combination %j', (capabilities) => {
		const result = McpConfigEditFormSchema.safeParse({
			type: 'mcp-module',
			enabled: true,
			capabilities,
			allowedOrigins: [],
		});

		expect(result.success, result.error?.message).toBe(true);
	});

	it('accepts only normalized HTTP(S) origins', () => {
		expect(McpOriginSchema.safeParse('https://agent.example.com').success).toBe(true);
		expect(McpOriginSchema.safeParse('http://localhost:3000').success).toBe(true);
		expect(McpOriginSchema.safeParse('https://agent.example.com/path').success).toBe(false);
		expect(McpOriginSchema.safeParse('https://user:secret@agent.example.com').success).toBe(false);
		expect(McpOriginSchema.safeParse('file:///tmp/agent').success).toBe(false);
	});

	it('requires a finite bounded credential lifetime', () => {
		const base = { name: 'Agent', description: null, capabilities: [] };

		expect(McpCreateClientSchema.safeParse({ ...base, expiresInDays: 1 }).success).toBe(true);
		expect(McpCreateClientSchema.safeParse({ ...base, expiresInDays: 3650 }).success).toBe(true);
		expect(McpCreateClientSchema.safeParse({ ...base, expiresInDays: 0 }).success).toBe(false);
		expect(McpCreateClientSchema.safeParse({ ...base, expiresInDays: null }).success).toBe(false);
	});

	it('validates client grants against the module ceiling', () => {
		expect(isCapabilitySubset([McpCapability.read], [McpCapability.read, McpCapability.write])).toBe(true);
		expect(isCapabilitySubset([], [])).toBe(true);
		expect(isCapabilitySubset([McpCapability.trigger], [McpCapability.read, McpCapability.write])).toBe(false);
	});
});
