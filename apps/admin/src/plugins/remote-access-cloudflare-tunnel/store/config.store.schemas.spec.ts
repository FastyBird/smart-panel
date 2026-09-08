import { describe, expect, it } from 'vitest';

import { CloudflareTunnelConfigResSchema, CloudflareTunnelConfigSchema, CloudflareTunnelConfigUpdateReqSchema } from './config.store.schemas';

describe('CloudflareTunnelConfigSchema', () => {
	it('accepts a null public hostname (never configured yet)', () => {
		const result = CloudflareTunnelConfigSchema.safeParse({
			type: 'remote-access-cloudflare-tunnel-plugin',
			enabled: false,
			publicHostname: null,
			protocol: 'auto',
			tunnelTokenConfigured: false,
		});

		expect(result.success).toBe(true);
	});

	it('rejects an absent public hostname - the backend always returns it, never redacted', () => {
		const result = CloudflareTunnelConfigSchema.safeParse({
			type: 'remote-access-cloudflare-tunnel-plugin',
			enabled: false,
			protocol: 'auto',
			tunnelTokenConfigured: false,
		});

		expect(result.success).toBe(false);
	});

	it('accepts an absent tunnel token, defaulting tunnelTokenConfigured to false', () => {
		const parsed = CloudflareTunnelConfigSchema.parse({
			type: 'remote-access-cloudflare-tunnel-plugin',
			enabled: true,
			publicHostname: 'panel.example.com',
			protocol: 'auto',
		});

		expect(parsed.tunnelToken).toBeUndefined();
		expect(parsed.tunnelTokenConfigured).toBe(false);
	});
});

describe('CloudflareTunnelConfigUpdateReqSchema', () => {
	it('accepts null for public_hostname and tunnel_token, expressing a removal', () => {
		const parsed = CloudflareTunnelConfigUpdateReqSchema.parse({
			type: 'remote-access-cloudflare-tunnel-plugin',
			public_hostname: null,
			tunnel_token: null,
		});

		expect(parsed.public_hostname).toBeNull();
		expect(parsed.tunnel_token).toBeNull();
	});

	it('accepts a request carrying only the type (every other field omitted)', () => {
		expect(CloudflareTunnelConfigUpdateReqSchema.safeParse({ type: 'remote-access-cloudflare-tunnel-plugin' }).success).toBe(true);
	});
});

describe('CloudflareTunnelConfigResSchema', () => {
	it('accepts a redacted response with only the tunnel_token_configured flag', () => {
		const result = CloudflareTunnelConfigResSchema.safeParse({
			type: 'remote-access-cloudflare-tunnel-plugin',
			enabled: true,
			public_hostname: 'panel.example.com',
			protocol: 'auto',
			tunnel_token_configured: true,
		});

		expect(result.success).toBe(true);
	});

	it('rejects a response missing the always-present public_hostname field', () => {
		const result = CloudflareTunnelConfigResSchema.safeParse({
			type: 'remote-access-cloudflare-tunnel-plugin',
			enabled: true,
			protocol: 'auto',
			tunnel_token_configured: false,
		});

		expect(result.success).toBe(false);
	});
});
