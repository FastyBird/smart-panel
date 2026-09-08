/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: `expect(tunnelManagedService.computeStatus).toHaveBeenCalledTimes(...)` reads the
jest.fn() mock off the fake managed service without calling it, which ESLint flags as an
unbound method access even though it is never invoked unbound.
*/
import { RemoteAccessProviderStatus } from '../../../modules/remote-access/platforms/remote-access-provider.platform';

import { CloudflareTunnelManagedService } from './cloudflare-tunnel-managed.service';
import { CloudflareTunnelProviderService } from './cloudflare-tunnel-provider.service';

describe('CloudflareTunnelProviderService', () => {
	it('declares kind: tunnel and the D9-specified capability flags', () => {
		const tunnelManagedService = { computeStatus: jest.fn() } as unknown as CloudflareTunnelManagedService;
		const service = new CloudflareTunnelProviderService(tunnelManagedService);

		expect(service.type).toBe('remote-access-cloudflare-tunnel-plugin');
		expect(service.kind).toBe('tunnel');
		expect(service.capabilities).toEqual({ https: true, publicUrl: true, identityHeaders: false, ssh: false });
	});

	it('delegates getStatus() to the managed service, without duplicating status composition', async () => {
		const status: RemoteAccessProviderStatus = {
			type: 'remote-access-cloudflare-tunnel-plugin',
			state: 'connected',
			endpoints: [],
			details: {},
			proxyAddresses: [],
			advisories: [],
			updatedAt: '2026-09-08T00:00:00.000Z',
		};
		const tunnelManagedService = {
			computeStatus: jest.fn().mockResolvedValue(status),
		} as unknown as CloudflareTunnelManagedService;
		const service = new CloudflareTunnelProviderService(tunnelManagedService);

		await expect(service.getStatus()).resolves.toBe(status);
		expect(tunnelManagedService.computeStatus).toHaveBeenCalledTimes(1);
	});
});
