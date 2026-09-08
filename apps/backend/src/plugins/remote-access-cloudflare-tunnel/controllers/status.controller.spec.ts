import { Test, TestingModule } from '@nestjs/testing';

import { PlatformService } from '../../../modules/platform/services/platform.service';
import { RemoteAccessProviderStatus } from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { CloudflareTunnelManagedService } from '../services/cloudflare-tunnel-managed.service';
import { CloudflareTunnelProviderService } from '../services/cloudflare-tunnel-provider.service';
import { CloudflareTunnelSetupService } from '../services/cloudflare-tunnel-setup.service';

import { StatusController } from './status.controller';

describe('StatusController', () => {
	let controller: StatusController;
	let providerService: { getStatus: jest.Mock };
	let tunnelManagedService: { refreshRequirements: jest.Mock };
	let setupService: { getLastJob: jest.Mock };
	let platformService: { getPrivilegedWorkerSupport: jest.Mock };

	const baseStatus: RemoteAccessProviderStatus = {
		type: 'remote-access-cloudflare-tunnel-plugin',
		state: 'connected',
		endpoints: [{ url: 'https://panel.example.com', scope: 'public', https: true, label: 'Cloudflare Tunnel' }],
		details: { hostname: 'panel.example.com', connector_id: 'abc', ready_connections: 4, version: '2024.6.1' },
		proxyAddresses: ['127.0.0.1', '::1'],
		advisories: [{ code: 'public-exposure', severity: 'warning', message: 'reachable from the internet' }],
		updatedAt: '2026-09-08T00:00:00.000Z',
	};

	const baseRequirements = [
		{ code: 'platform-supported', satisfied: true, message: 'ok', remedy: null },
		{ code: 'binary-installed', satisfied: true, message: 'ok', remedy: null },
		{ code: 'version-supported', satisfied: true, message: 'ok', remedy: null },
		{ code: 'token-configured', satisfied: true, message: 'ok', remedy: null },
	];

	beforeEach(async () => {
		providerService = { getStatus: jest.fn().mockResolvedValue(baseStatus) };
		tunnelManagedService = { refreshRequirements: jest.fn().mockResolvedValue(baseRequirements) };
		setupService = { getLastJob: jest.fn().mockReturnValue(null) };
		platformService = {
			getPrivilegedWorkerSupport: jest
				.fn()
				.mockResolvedValue({ supported: true, reason: null, checkedAt: '2026-09-08T00:00:00.000Z' }),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [StatusController],
			providers: [
				{ provide: CloudflareTunnelProviderService, useValue: providerService },
				{ provide: CloudflareTunnelManagedService, useValue: tunnelManagedService },
				{ provide: CloudflareTunnelSetupService, useValue: setupService },
				{ provide: PlatformService, useValue: platformService },
			],
		}).compile();

		controller = module.get<StatusController>(StatusController);
	});

	it('composes the endpoint, details and requirements into one response', async () => {
		const response = await controller.getStatus();

		expect(response.data).toMatchObject({
			type: 'remote-access-cloudflare-tunnel-plugin',
			state: 'connected',
			proxyAddresses: ['127.0.0.1', '::1'],
			details: { hostname: 'panel.example.com', connector_id: 'abc', ready_connections: 4, version: '2024.6.1' },
		});
		expect(response.data.endpoints).toHaveLength(1);
		expect(response.data.endpoints[0]).toMatchObject({ url: 'https://panel.example.com', label: 'Cloudflare Tunnel' });
		expect(response.data.requirements).toHaveLength(4);
		expect(response.data.requirements[0]).toMatchObject({ code: 'platform-supported', satisfied: true });
		expect(response.data.advisories).toHaveLength(1);
		expect(response.data.advisories[0]).toMatchObject({ code: 'public-exposure' });
	});

	describe('setup / privilegedSetup', () => {
		it('reports setup: null when no job has run since this process started', async () => {
			const response = await controller.getStatus();

			expect(response.data.setup).toBeNull();
		});

		it('composes the last known setup job from CloudflareTunnelSetupService.getLastJob()', async () => {
			setupService.getLastJob.mockReturnValue({
				id: 'job-1',
				status: {
					id: 'job-1',
					state: 'running',
					step: 'install',
					message: 'Installing cloudflared',
					updatedAt: '2026-09-08T00:00:00.000Z',
				},
			});

			const response = await controller.getStatus();

			expect(response.data.setup).toMatchObject({
				jobId: 'job-1',
				state: 'running',
				step: 'install',
				message: 'Installing cloudflared',
				updatedAt: '2026-09-08T00:00:00.000Z',
			});
		});

		it('falls back to null step/message when the job status omits them', async () => {
			setupService.getLastJob.mockReturnValue({
				id: 'job-1',
				status: { id: 'job-1', state: 'complete', updatedAt: '2026-09-08T00:00:00.000Z' },
			});

			const response = await controller.getStatus();

			expect(response.data.setup).toMatchObject({ jobId: 'job-1', state: 'complete', step: null, message: null });
		});

		it('reports privilegedSetup from PlatformService.getPrivilegedWorkerSupport()', async () => {
			platformService.getPrivilegedWorkerSupport.mockResolvedValue({
				supported: false,
				reason: 'sudo: a password is required',
				checkedAt: '2026-09-08T00:00:00.000Z',
			});

			const response = await controller.getStatus();

			expect(response.data.privilegedSetup).toEqual({
				available: false,
				reason: 'sudo: a password is required',
			});
		});
	});
});
