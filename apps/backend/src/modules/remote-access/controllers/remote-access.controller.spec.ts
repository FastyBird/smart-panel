import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../config/services/config.service';
import { RemoteAccessProviderModel } from '../models/provider.model';
import { REMOTE_ACCESS_MODULE_NAME } from '../remote-access.constants';
import { RemoteAccessProviderNotFoundException } from '../remote-access.exceptions';
import { RemoteAccessPostureService } from '../services/remote-access-posture.service';
import { RemoteAccessStatusService } from '../services/remote-access-status.service';
import { RemoteAccessUrlService } from '../services/remote-access-url.service';

import { RemoteAccessController } from './remote-access.controller';

describe('RemoteAccessController', () => {
	let controller: RemoteAccessController;
	let configService: { getModuleConfig: jest.Mock };
	let statusService: { getAggregatedStatuses: jest.Mock; getProviderStatus: jest.Mock };
	let urlService: { getUrls: jest.Mock; getCandidates: jest.Mock };
	let postureService: { getAdvisories: jest.Mock };

	const mockProvider: RemoteAccessProviderModel = {
		type: 'remote-access-tailscale',
		kind: 'mesh',
		capabilities: { https: true, publicUrl: false, identityHeaders: false, ssh: false },
		state: 'connected',
		endpoints: [],
		details: {},
		proxyAddresses: [],
		advisories: [],
		updatedAt: '2025-01-18T12:00:00Z',
	};

	const mockUrls = { internal: 'http://localhost:3000', external: [], primaryExternalUrl: null };

	beforeEach(async () => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue({ type: REMOTE_ACCESS_MODULE_NAME, enabled: true }),
		};
		statusService = {
			getAggregatedStatuses: jest.fn().mockResolvedValue([mockProvider]),
			getProviderStatus: jest.fn().mockResolvedValue(mockProvider),
		};
		urlService = {
			getUrls: jest.fn().mockReturnValue(mockUrls),
			getCandidates: jest.fn().mockResolvedValue(['http://192.168.1.50:3000']),
		};
		postureService = { getAdvisories: jest.fn().mockReturnValue([]) };

		const module: TestingModule = await Test.createTestingModule({
			controllers: [RemoteAccessController],
			providers: [
				{ provide: ConfigService, useValue: configService },
				{ provide: RemoteAccessStatusService, useValue: statusService },
				{ provide: RemoteAccessUrlService, useValue: urlService },
				{ provide: RemoteAccessPostureService, useValue: postureService },
			],
		}).compile();

		controller = module.get<RemoteAccessController>(RemoteAccessController);
	});

	describe('getStatus', () => {
		it('assembles enabled, providers, urls and advisories', async () => {
			const response = await controller.getStatus();

			expect(response.data).toEqual({
				enabled: true,
				providers: [mockProvider],
				urls: {
					internal: 'http://localhost:3000',
					candidates: ['http://192.168.1.50:3000'],
					external: [],
					primary: null,
				},
				advisories: [],
			});
		});
	});

	describe('getProviders', () => {
		it('returns every provider', async () => {
			const response = await controller.getProviders();

			expect(response.data).toEqual([mockProvider]);
			expect(statusService.getAggregatedStatuses).toHaveBeenCalled();
		});
	});

	describe('getProvider', () => {
		it('returns a single provider by type', async () => {
			const response = await controller.getProvider('remote-access-tailscale');

			expect(response.data).toEqual(mockProvider);
			expect(statusService.getProviderStatus).toHaveBeenCalledWith('remote-access-tailscale');
		});

		it('maps RemoteAccessProviderNotFoundException to a 404', async () => {
			statusService.getProviderStatus.mockRejectedValue(new RemoteAccessProviderNotFoundException('not found'));

			await expect(controller.getProvider('unknown')).rejects.toThrow(NotFoundException);
		});

		it('rethrows an unrelated error', async () => {
			statusService.getProviderStatus.mockRejectedValue(new Error('boom'));

			await expect(controller.getProvider('remote-access-tailscale')).rejects.toThrow('boom');
		});
	});

	describe('getUrls', () => {
		it('combines the URL snapshot with async candidates', async () => {
			const response = await controller.getUrls();

			expect(response.data).toEqual({
				internal: 'http://localhost:3000',
				candidates: ['http://192.168.1.50:3000'],
				external: [],
				primary: null,
			});
		});
	});
});
