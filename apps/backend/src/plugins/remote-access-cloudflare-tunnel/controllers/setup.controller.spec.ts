import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { RemoteAccessProviderStatus } from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { PrivilegedWorkerUnavailableException } from '../../../modules/system/system.exceptions';
import { CloudflareTunnelManagedService } from '../services/cloudflare-tunnel-managed.service';
import { CloudflareTunnelProviderService } from '../services/cloudflare-tunnel-provider.service';
import {
	CloudflareTunnelSetupService,
	CloudflareTunnelSetupUnavailableException,
} from '../services/cloudflare-tunnel-setup.service';

import { SetupController } from './setup.controller';

describe('SetupController', () => {
	let controller: SetupController;
	let setupService: { install: jest.Mock };
	let providerService: { getStatus: jest.Mock };
	let tunnelManagedService: { stop: jest.Mock; refreshRequirements: jest.Mock };
	let configService: { updatePluginConfig: jest.Mock };

	const baseStatus: RemoteAccessProviderStatus = {
		type: 'remote-access-cloudflare-tunnel-plugin',
		state: 'setup-required',
		endpoints: [],
		message: 'Paste the tunnel token from the Cloudflare Zero Trust dashboard',
		details: { hostname: null, connector_id: null, ready_connections: null, version: null },
		proxyAddresses: [],
		advisories: [],
		updatedAt: '2026-09-08T00:00:00.000Z',
	};

	beforeEach(async () => {
		setupService = { install: jest.fn() };
		providerService = { getStatus: jest.fn().mockResolvedValue(baseStatus) };
		tunnelManagedService = {
			stop: jest.fn().mockResolvedValue(undefined),
			refreshRequirements: jest.fn().mockResolvedValue([]),
		};
		configService = { updatePluginConfig: jest.fn().mockResolvedValue(undefined) };

		const module: TestingModule = await Test.createTestingModule({
			controllers: [SetupController],
			providers: [
				{ provide: CloudflareTunnelSetupService, useValue: setupService },
				{ provide: CloudflareTunnelProviderService, useValue: providerService },
				{ provide: CloudflareTunnelManagedService, useValue: tunnelManagedService },
				{ provide: ConfigService, useValue: configService },
			],
		}).compile();

		controller = module.get<SetupController>(SetupController);
	});

	describe('install', () => {
		it('returns the job id on success', async () => {
			setupService.install.mockResolvedValue({ id: 'job-1' });

			const response = await controller.install();

			expect(response.data.job).toBe('job-1');
		});

		it('maps a busy-unit refusal to ConflictException', async () => {
			setupService.install.mockRejectedValue(
				new PrivilegedWorkerUnavailableException('Privileged worker unit is already busy.'),
			);

			await expect(controller.install()).rejects.toBeInstanceOf(ConflictException);
		});

		it('maps a platform-unsupported refusal to UnprocessableEntityException with the code', async () => {
			setupService.install.mockRejectedValue(
				new CloudflareTunnelSetupUnavailableException('not supported here', 'platform-unsupported'),
			);

			await expect(controller.install()).rejects.toMatchObject({
				status: 422,
				response: { code: 'platform-unsupported', message: 'not supported here' },
			});
		});

		it('maps a privileged-worker-unavailable refusal to UnprocessableEntityException with the code', async () => {
			setupService.install.mockRejectedValue(
				new CloudflareTunnelSetupUnavailableException('sudo: a password is required', 'privileged-worker-unavailable'),
			);

			await expect(controller.install()).rejects.toBeInstanceOf(UnprocessableEntityException);
		});

		it('maps an unexpected error to InternalServerErrorException', async () => {
			setupService.install.mockRejectedValue(new Error('boom'));

			await expect(controller.install()).rejects.toMatchObject({ status: 500 });
		});
	});

	describe('reset', () => {
		it('stops the tunnel service before clearing the configuration', async () => {
			const callOrder: string[] = [];

			tunnelManagedService.stop.mockImplementation(() => {
				callOrder.push('stop');

				return Promise.resolve();
			});
			configService.updatePluginConfig.mockImplementation(() => {
				callOrder.push('update');

				return Promise.resolve();
			});

			await controller.reset();

			expect(callOrder).toEqual(['stop', 'update']);
		});

		it('clears the tunnel token and public hostname through ConfigService', async () => {
			await controller.reset();

			expect(configService.updatePluginConfig).toHaveBeenCalledWith(
				'remote-access-cloudflare-tunnel-plugin',
				expect.objectContaining({ tunnelToken: null, publicHostname: null }),
				expect.objectContaining({ tunnel_token: null, public_hostname: null }),
			);
		});

		it('returns the fresh status after resetting', async () => {
			const response = await controller.reset();

			expect(response.data.type).toBe('remote-access-cloudflare-tunnel-plugin');
			expect(response.data.state).toBe('setup-required');
		});

		it('tolerates a stop failure and still clears the configuration', async () => {
			tunnelManagedService.stop.mockRejectedValue(new Error('already stopped'));

			await controller.reset();

			expect(configService.updatePluginConfig).toHaveBeenCalled();
		});

		it('raises InternalServerErrorException when clearing the configuration fails', async () => {
			configService.updatePluginConfig.mockRejectedValue(new Error('disk full'));

			await expect(controller.reset()).rejects.toMatchObject({ status: 500 });
		});
	});
});
