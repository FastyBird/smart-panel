import { describe, expect, it } from 'vitest';

import { transformConfigModuleResponse, transformConfigModuleUpdateRequest } from '../../config/store/config-modules.store.transformers';
import { McpCapability } from '../mcp.constants';
import { isCapabilitySubset } from '../mcp.utils';
import { McpConfigSchema, McpConfigUpdateReqSchema } from '../store/config.store.schemas';

import { McpCreateClientSchema } from './client.schemas';
import { McpConfigEditFormSchema, McpOAuthPublicBaseUrlSchema, McpOriginSchema } from './config.schemas';

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

	it('accepts only normalized HTTPS OAuth public identities', () => {
		expect(McpOAuthPublicBaseUrlSchema.safeParse('https://panel.example.com').success).toBe(true);
		expect(McpOAuthPublicBaseUrlSchema.safeParse('https://panel.example.com/smart-panel').success).toBe(true);
		expect(McpOAuthPublicBaseUrlSchema.safeParse('http://panel.example.com').success).toBe(false);
		expect(McpOAuthPublicBaseUrlSchema.safeParse('https://panel.example.com/').success).toBe(false);
		expect(McpOAuthPublicBaseUrlSchema.safeParse('https://panel.example.com/path/').success).toBe(false);
		expect(McpOAuthPublicBaseUrlSchema.safeParse('https://user:secret@panel.example.com').success).toBe(false);
	});

	it('requires a public identity when active OAuth is enabled', () => {
		const base = {
			type: 'mcp-module',
			enabled: true,
			capabilities: [McpCapability.read],
			allowedOrigins: [],
		};

		expect(
			McpConfigEditFormSchema.safeParse({
				...base,
				oauthEnabled: true,
				oauthPublicBaseUrl: 'https://panel.example.com',
			}).success
		).toBe(true);
		expect(McpConfigEditFormSchema.safeParse({ ...base, oauthEnabled: true, oauthPublicBaseUrl: null }).success).toBe(false);
		expect(McpConfigEditFormSchema.safeParse({ ...base, enabled: false, oauthEnabled: true, oauthPublicBaseUrl: null }).success).toBe(true);
		expect(McpConfigEditFormSchema.safeParse({ ...base, oauthEnabled: false, oauthPublicBaseUrl: '' }).data?.oauthPublicBaseUrl).toBeNull();
	});

	it('maps the OAuth lifecycle fields across the camel-case Admin and snake-case API boundary', () => {
		const config = transformConfigModuleResponse(
			{
				type: 'mcp-module',
				enabled: true,
				oauth_enabled: true,
				oauth_public_base_url: 'https://panel.example.com',
				capabilities: [McpCapability.read],
				allowed_origins: [],
			} as never,
			McpConfigSchema
		) as Record<string, unknown>;

		expect(config).toMatchObject({
			oauthEnabled: true,
			oauthPublicBaseUrl: 'https://panel.example.com',
		});
		expect(transformConfigModuleUpdateRequest(config as never, McpConfigUpdateReqSchema)).toMatchObject({
			oauth_enabled: true,
			oauth_public_base_url: 'https://panel.example.com',
		});
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
