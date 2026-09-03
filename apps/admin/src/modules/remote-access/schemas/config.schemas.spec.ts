import { describe, expect, it } from 'vitest';

import { transformConfigModuleResponse, transformConfigModuleUpdateRequest } from '../../config/store/config-modules.store.transformers';
import { REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';
import { RemoteAccessConfigSchema, RemoteAccessConfigUpdateReqSchema } from '../store/config.store.schemas';

import { RemoteAccessConfigEditFormSchema, RemoteAccessOriginSchema, RemoteAccessTrustedProxySchema } from './config.schemas';

describe('Remote access admin config schemas', () => {
	it('accepts only normalized absolute HTTP(S) origins', () => {
		expect(RemoteAccessOriginSchema.safeParse('https://panel.example.com').success).toBe(true);
		expect(RemoteAccessOriginSchema.safeParse('http://192.168.1.5:8123').success).toBe(true);
		// Unlike MCP's OAuth base URL, a path is never tolerated, not even a reverse-proxy prefix.
		expect(RemoteAccessOriginSchema.safeParse('https://panel.example.com/smart-panel').success).toBe(false);
		expect(RemoteAccessOriginSchema.safeParse('https://panel.example.com/').success).toBe(false);
		expect(RemoteAccessOriginSchema.safeParse('https://user:secret@panel.example.com').success).toBe(false);
		expect(RemoteAccessOriginSchema.safeParse('https://panel.example.com?query=1').success).toBe(false);
		expect(RemoteAccessOriginSchema.safeParse('ftp://panel.example.com').success).toBe(false);
		expect(RemoteAccessOriginSchema.safeParse('not-a-url').success).toBe(false);
	});

	it('accepts valid IPv4/IPv6 trusted proxy entries and CIDR ranges', () => {
		expect(RemoteAccessTrustedProxySchema.safeParse('10.0.0.1').success).toBe(true);
		expect(RemoteAccessTrustedProxySchema.safeParse('10.0.0.0/8').success).toBe(true);
		expect(RemoteAccessTrustedProxySchema.safeParse('192.168.1.0/24').success).toBe(true);
		expect(RemoteAccessTrustedProxySchema.safeParse('fe80::1').success).toBe(true);
		expect(RemoteAccessTrustedProxySchema.safeParse('fe80::/10').success).toBe(true);
	});

	it('rejects malformed trusted proxy entries', () => {
		expect(RemoteAccessTrustedProxySchema.safeParse('not-an-ip').success).toBe(false);
		expect(RemoteAccessTrustedProxySchema.safeParse('10.0.0.0/33').success).toBe(false);
		expect(RemoteAccessTrustedProxySchema.safeParse('10.0.0.999').success).toBe(false);
		expect(RemoteAccessTrustedProxySchema.safeParse('').success).toBe(false);
	});

	it('accepts a fully populated edit form model', () => {
		const result = RemoteAccessConfigEditFormSchema.safeParse({
			type: REMOTE_ACCESS_MODULE_NAME,
			enabled: true,
			internalUrl: 'http://panel.local:3000',
			externalUrl: 'https://panel.example.com',
			trustForwardedHeaders: true,
			trustedProxies: ['10.0.0.1', '192.168.1.0/24'],
		});

		expect(result.success, result.error?.message).toBe(true);
	});

	it('defaults an empty string URL to null instead of rejecting it', () => {
		const result = RemoteAccessConfigEditFormSchema.safeParse({
			type: REMOTE_ACCESS_MODULE_NAME,
			enabled: true,
			internalUrl: '',
			externalUrl: '',
			trustForwardedHeaders: false,
			trustedProxies: [],
		});

		expect(result.success).toBe(true);
		expect(result.data?.internalUrl).toBeNull();
		expect(result.data?.externalUrl).toBeNull();
	});

	it('rejects an invalid external URL on the edit form', () => {
		const result = RemoteAccessConfigEditFormSchema.safeParse({
			type: REMOTE_ACCESS_MODULE_NAME,
			enabled: true,
			internalUrl: null,
			externalUrl: 'not-a-url',
			trustForwardedHeaders: false,
			trustedProxies: [],
		});

		expect(result.success).toBe(false);
	});

	it('maps the four settings fields across the camel-case Admin and snake-case API boundary', () => {
		const config = transformConfigModuleResponse(
			{
				type: REMOTE_ACCESS_MODULE_NAME,
				enabled: true,
				internal_url: 'http://panel.local:3000',
				external_url: 'https://panel.example.com',
				trust_forwarded_headers: true,
				trusted_proxies: ['10.0.0.1'],
			} as never,
			RemoteAccessConfigSchema
		) as Record<string, unknown>;

		expect(config).toMatchObject({
			internalUrl: 'http://panel.local:3000',
			externalUrl: 'https://panel.example.com',
			trustForwardedHeaders: true,
			trustedProxies: ['10.0.0.1'],
		});

		expect(transformConfigModuleUpdateRequest(config as never, RemoteAccessConfigUpdateReqSchema)).toMatchObject({
			internal_url: 'http://panel.local:3000',
			external_url: 'https://panel.example.com',
			trust_forwarded_headers: true,
			trusted_proxies: ['10.0.0.1'],
		});
	});
});
