import { describe, expect, it } from 'vitest';

import {
	RemoteAccessModuleAdvisorySeverity,
	RemoteAccessModuleEndpointScope,
	RemoteAccessModuleProviderKind,
	RemoteAccessModuleProviderState,
} from '../../../openapi.constants';
import { RemoteAccessValidationException } from '../remote-access.exceptions';

import type { IRemoteAccessStatus, IRemoteAccessStatusRes } from './remote-access-status.store.types';
import {
	applyRemoteAccessProviderStatusEvent,
	applyRemoteAccessUrlsChangedEvent,
	transformRemoteAccessStatusResponse,
} from './remote-access-status.transformers';

const mockStatusRes: IRemoteAccessStatusRes = {
	enabled: true,
	providers: [
		{
			type: 'remote-access-tailscale',
			kind: RemoteAccessModuleProviderKind.mesh,
			capabilities: {
				https: true,
				public_url: false,
				identity_headers: false,
				ssh: true,
			},
			state: RemoteAccessModuleProviderState.connected,
			endpoints: [
				{
					url: 'https://node.tailnet.ts.net',
					scope: RemoteAccessModuleEndpointScope.private,
					https: true,
					label: 'Tailscale (HTTPS)',
				},
			],
			message: null,
			details: {},
			proxy_addresses: ['127.0.0.1'],
			advisories: [],
			updated_at: '2026-01-01T00:00:00.000Z',
		},
	],
	urls: {
		internal: 'http://localhost:3000',
		candidates: ['http://192.168.1.5:3000'],
		external: [
			{
				url: 'https://node.tailnet.ts.net',
				scope: RemoteAccessModuleEndpointScope.private,
				https: true,
				label: 'Tailscale (HTTPS)',
			},
		],
		primary: 'https://node.tailnet.ts.net',
	},
	advisories: [],
};

describe('transformRemoteAccessStatusResponse', () => {
	it('maps the snake_case REST response onto the camelCase store shape', () => {
		const result = transformRemoteAccessStatusResponse(mockStatusRes);

		expect(result.enabled).toBe(true);
		expect(result.providers[0]).toMatchObject({
			type: 'remote-access-tailscale',
			proxyAddresses: ['127.0.0.1'],
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
		expect(result.providers[0]!.capabilities).toMatchObject({
			publicUrl: false,
			identityHeaders: false,
		});
		expect(result.urls).toMatchObject({
			internal: 'http://localhost:3000',
			primary: 'https://node.tailnet.ts.net',
		});
	});

	it('throws when the response fails validation', () => {
		expect(() => transformRemoteAccessStatusResponse({ enabled: true } as unknown as IRemoteAccessStatusRes)).toThrow(
			RemoteAccessValidationException
		);
	});
});

describe('applyRemoteAccessProviderStatusEvent', () => {
	const baseStatus: IRemoteAccessStatus = transformRemoteAccessStatusResponse(mockStatusRes);

	// The websocket event payload carries the raw `RemoteAccessProviderStatus` interface: a plain
	// object emitted directly by the backend, already camelCase (never run through
	// class-transformer, unlike the REST response above).
	it('merges a known provider status event, preserving kind and capabilities', () => {
		const result = applyRemoteAccessProviderStatusEvent(baseStatus, {
			type: 'remote-access-tailscale',
			state: 'error',
			endpoints: [],
			message: 'Daemon stopped',
			details: {},
			proxyAddresses: [],
			advisories: [],
			updatedAt: '2026-01-02T00:00:00.000Z',
		});

		expect(result.providers).toHaveLength(1);
		expect(result.providers[0]).toMatchObject({
			type: 'remote-access-tailscale',
			kind: 'mesh',
			state: 'error',
			message: 'Daemon stopped',
			updatedAt: '2026-01-02T00:00:00.000Z',
		});
		expect(result.providers[0]!.capabilities).toMatchObject({ https: true, ssh: true });
	});

	it('tags advisories without an explicit provider with the event type and rebuilds the aggregate list, mirroring the backend posture service', () => {
		const withModuleAdvisory: IRemoteAccessStatus = {
			...baseStatus,
			advisories: [{ code: 'public-exposure', severity: RemoteAccessModuleAdvisorySeverity.warning, message: 'Reachable from the internet.' }],
		};

		const result = applyRemoteAccessProviderStatusEvent(withModuleAdvisory, {
			type: 'remote-access-tailscale',
			state: 'connected',
			endpoints: [],
			details: {},
			proxyAddresses: [],
			advisories: [{ code: 'key-expiring', severity: 'warning', message: 'Node key expires in 14 days.' }],
			updatedAt: '2026-01-02T00:00:00.000Z',
		});

		// The module-level advisory (no `provider`) survives untouched; the provider's own advisory
		// is appended, tagged with its type.
		expect(result.advisories).toContainEqual({ code: 'public-exposure', severity: 'warning', message: 'Reachable from the internet.' });
		expect(result.advisories).toContainEqual({
			code: 'key-expiring',
			severity: 'warning',
			message: 'Node key expires in 14 days.',
			provider: 'remote-access-tailscale',
		});
	});

	it('replaces a provider’s previous advisories rather than accumulating them', () => {
		const withStaleAdvisory: IRemoteAccessStatus = {
			...baseStatus,
			advisories: [{ code: 'stale', severity: RemoteAccessModuleAdvisorySeverity.info, message: 'stale', provider: 'remote-access-tailscale' }],
		};

		const result = applyRemoteAccessProviderStatusEvent(withStaleAdvisory, {
			type: 'remote-access-tailscale',
			state: 'connected',
			endpoints: [],
			details: {},
			proxyAddresses: [],
			advisories: [],
			updatedAt: '2026-01-02T00:00:00.000Z',
		});

		expect(result.advisories).toEqual([]);
	});

	it('ignores an event for a provider this store has not fetched yet', () => {
		const result = applyRemoteAccessProviderStatusEvent(baseStatus, {
			type: 'remote-access-cloudflare-tunnel',
			state: 'connected',
			endpoints: [],
			details: {},
			proxyAddresses: [],
			advisories: [],
			updatedAt: '2026-01-02T00:00:00.000Z',
		});

		expect(result).toBe(baseStatus);
	});

	it('throws when the event payload fails validation', () => {
		expect(() => applyRemoteAccessProviderStatusEvent(baseStatus, { type: 'remote-access-tailscale' })).toThrow(RemoteAccessValidationException);
	});
});

describe('applyRemoteAccessUrlsChangedEvent', () => {
	const baseStatus: IRemoteAccessStatus = transformRemoteAccessStatusResponse(mockStatusRes);

	it('replaces internal, external and primary while leaving candidates untouched', () => {
		const result = applyRemoteAccessUrlsChangedEvent(baseStatus, {
			internal: 'http://localhost:3000',
			external: [
				{
					url: 'https://panel.example.com',
					scope: 'public',
					https: true,
					label: 'Manual external URL',
				},
			],
			// The event never carries `candidates` - only the REST response does.
			primaryExternalUrl: 'https://panel.example.com',
		});

		expect(result.urls.primary).toBe('https://panel.example.com');
		expect(result.urls.external).toHaveLength(1);
		expect(result.urls.external[0]!.url).toBe('https://panel.example.com');
		expect(result.urls.candidates).toEqual(baseStatus.urls.candidates);
	});

	it('accepts a null primary when no external endpoint is available', () => {
		const result = applyRemoteAccessUrlsChangedEvent(baseStatus, {
			internal: 'http://localhost:3000',
			external: [],
			primaryExternalUrl: null,
		});

		expect(result.urls.primary).toBeNull();
		expect(result.urls.external).toEqual([]);
	});

	it('throws when the event payload fails validation', () => {
		expect(() => applyRemoteAccessUrlsChangedEvent(baseStatus, { internal: 'http://localhost:3000' })).toThrow(RemoteAccessValidationException);
	});
});
