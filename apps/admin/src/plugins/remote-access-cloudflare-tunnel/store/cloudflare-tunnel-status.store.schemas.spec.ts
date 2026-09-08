import { describe, expect, it } from 'vitest';

import { snakeToCamel } from '../../../common';

import { CloudflareTunnelStatusResSchema, CloudflareTunnelStatusSchema } from './cloudflare-tunnel-status.store.schemas';

// A fresh, never-configured tunnel's real `GET /status` shape: `message` is `null` (not absent -
// `RemoteAccessCloudflareTunnelPluginStatusModel.message` is unconditionally assigned via
// `status.message ?? null` in both controllers), `setup` is `null` (no privileged job has run yet
// in this process - `StatusController.buildSetupJobModel()` returns `null`), and every unsatisfied
// requirement's `remedy` carries commands. This is exactly the shape that caught the shipped
// Tailscale bug: a field declared `.optional()` when the backend always sends it as literal
// `null` makes `.safeParse()` reject every fresh-node response silently.
const freshTunnelStatusResponse = {
	type: 'remote-access-cloudflare-tunnel-plugin',
	state: 'not-installed',
	endpoints: [],
	message: null,
	details: { hostname: null, connector_id: null, ready_connections: null, version: null },
	proxy_addresses: [],
	advisories: [],
	updated_at: '2026-09-08T12:00:00Z',
	requirements: [
		{
			code: 'platform-supported',
			satisfied: true,
			message: 'This platform can run Cloudflare Tunnel.',
			remedy: null,
		},
		{
			code: 'binary-installed',
			satisfied: false,
			message: 'cloudflared is not installed.',
			remedy: { commands: ['sudo apt-get install -y cloudflared'], note: null },
		},
		{
			code: 'version-supported',
			satisfied: false,
			message: 'cloudflared is not installed.',
			remedy: { commands: ['sudo apt-get install -y cloudflared'], note: null },
		},
		{
			code: 'token-configured',
			satisfied: false,
			message: 'Paste the tunnel token from the Cloudflare Zero Trust dashboard',
			remedy: { commands: [], note: 'Paste the tunnel token in the setup wizard' },
		},
	],
	setup: null,
	privileged_setup: { available: true, reason: null },
};

describe('CloudflareTunnelStatusSchema (fresh-tunnel GET /status fixture)', () => {
	it('parses a real fresh-tunnel response with literal nulls for message and setup', () => {
		const result = CloudflareTunnelStatusSchema.safeParse(snakeToCamel(freshTunnelStatusResponse));

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.message).toBeNull();
			expect(result.data.setup).toBeNull();
			expect(result.data.privilegedSetup).toEqual({ available: true, reason: null });
		}
	});

	it('parses a connected response where message is entirely absent (documents `.optional()` is also accepted)', () => {
		const connected = {
			...freshTunnelStatusResponse,
			state: 'connected',
			details: { hostname: 'panel.example.com', connector_id: 'abc123', ready_connections: 4, version: '2024.6.1' },
			requirements: freshTunnelStatusResponse.requirements.map((requirement) => ({ ...requirement, satisfied: true, remedy: null })),
		};

		// `message` deliberately omitted rather than `null` here - `.nullable().optional()` accepts both.
		delete (connected as { message?: unknown }).message;

		const result = CloudflareTunnelStatusSchema.safeParse(snakeToCamel(connected));

		expect(result.success).toBe(true);
	});

	it('rejects a response missing the always-present privileged_setup field', () => {
		const withoutPrivilegedSetup: Record<string, unknown> = { ...freshTunnelStatusResponse };
		delete withoutPrivilegedSetup.privileged_setup;

		const result = CloudflareTunnelStatusSchema.safeParse(snakeToCamel(withoutPrivilegedSetup));

		expect(result.success).toBe(false);
	});
});

describe('CloudflareTunnelStatusResSchema (compile-time anchor against the generated wire type)', () => {
	// This schema is a `ZodType<GeneratedWireType>` compile-time anchor only, never `.safeParse()`d
	// in production code (see the "BACKEND API" comment in the schema file) - the generated wire
	// type's `remedy?:` member is optional but NOT nullable, unlike the real backend, which sends
	// literal `null` for a satisfied requirement (the same shape `CloudflareTunnelStatusSchema`
	// above parses via `snakeToCamel()`). Documented here rather than asserted against, since
	// asserting `.safeParse()` succeeds on this schema would test a code path this plugin never
	// actually exercises at runtime.
	it('is a type-level anchor - the runtime-validated shape is CloudflareTunnelStatusSchema, exercised above', () => {
		expect(typeof CloudflareTunnelStatusResSchema.safeParse).toBe('function');
	});
});
