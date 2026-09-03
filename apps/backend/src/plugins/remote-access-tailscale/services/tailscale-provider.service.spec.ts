import { Test, TestingModule } from '@nestjs/testing';

import { RemoteAccessProviderStatus } from '../../../modules/remote-access/platforms/remote-access-provider.platform';

import { TailscaleNodeManagedService } from './tailscale-node-managed.service';
import { TailscaleProviderService } from './tailscale-provider.service';

describe('TailscaleProviderService', () => {
	let service: TailscaleProviderService;
	let nodeManagedService: { computeStatus: jest.Mock };

	beforeEach(async () => {
		nodeManagedService = { computeStatus: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [TailscaleProviderService, { provide: TailscaleNodeManagedService, useValue: nodeManagedService }],
		}).compile();

		service = module.get<TailscaleProviderService>(TailscaleProviderService);
	});

	it('declares the expected static provider metadata', () => {
		expect(service.type).toBe('remote-access-tailscale-plugin');
		expect(service.kind).toBe('mesh');
		expect(service.capabilities).toEqual({ https: true, publicUrl: true, identityHeaders: true, ssh: true });
	});

	it('delegates getStatus() to the node managed service instead of recomputing it', async () => {
		const status: RemoteAccessProviderStatus = {
			type: 'remote-access-tailscale-plugin',
			state: 'connected',
			endpoints: [],
			details: {},
			proxyAddresses: [],
			advisories: [],
			updatedAt: '2026-09-02T00:00:00.000Z',
		};
		nodeManagedService.computeStatus.mockResolvedValue(status);

		await expect(service.getStatus()).resolves.toBe(status);
		expect(nodeManagedService.computeStatus).toHaveBeenCalledTimes(1);
	});
});
