/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: `expect(res.header).toHaveBeenCalledWith(...)` reads the jest.fn()
mock off the fake FastifyReply without calling it, which ESLint flags as an
unbound method access even though it is never invoked unbound.
*/
import { FastifyReply } from 'fastify';

import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { RemoteAccessProviderStatus } from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { PrivilegedWorkerUnavailableException } from '../../../modules/system/system.exceptions';
import { TailscaleLoginService } from '../services/tailscale-login.service';
import { TailscaleNodeManagedService } from '../services/tailscale-node-managed.service';
import { TailscaleProviderService } from '../services/tailscale-provider.service';
import { TailscaleSetupService, TailscaleSetupUnavailableException } from '../services/tailscale-setup.service';

import { SetupController } from './setup.controller';

describe('SetupController', () => {
	let controller: SetupController;
	let setupService: { install: jest.Mock };
	let loginService: {
		login: jest.Mock;
		logout: jest.Mock;
		resetPreferences: jest.Mock;
		getPendingInteractiveAuth: jest.Mock;
	};
	let providerService: { getStatus: jest.Mock };
	let nodeManagedService: { evaluateRequirements: jest.Mock };

	const baseStatus: RemoteAccessProviderStatus = {
		type: 'remote-access-tailscale',
		state: 'connected',
		endpoints: [],
		details: {},
		proxyAddresses: [],
		advisories: [],
		updatedAt: '2026-09-02T00:00:00.000Z',
	};

	beforeEach(async () => {
		setupService = { install: jest.fn() };
		loginService = {
			login: jest.fn(),
			logout: jest.fn().mockResolvedValue({ state: 'setup-required' }),
			resetPreferences: jest.fn().mockResolvedValue({ state: 'connected' }),
			getPendingInteractiveAuth: jest.fn().mockReturnValue(null),
		};
		providerService = { getStatus: jest.fn().mockResolvedValue(baseStatus) };
		nodeManagedService = { evaluateRequirements: jest.fn().mockResolvedValue([]) };

		const module: TestingModule = await Test.createTestingModule({
			controllers: [SetupController],
			providers: [
				{ provide: TailscaleSetupService, useValue: setupService },
				{ provide: TailscaleLoginService, useValue: loginService },
				{ provide: TailscaleProviderService, useValue: providerService },
				{ provide: TailscaleNodeManagedService, useValue: nodeManagedService },
			],
		}).compile();

		controller = module.get<SetupController>(SetupController);
	});

	function fakeResponse(): FastifyReply {
		return { header: jest.fn() } as unknown as FastifyReply;
	}

	describe('install', () => {
		it('returns the job id from the setup service', async () => {
			setupService.install.mockResolvedValue({ id: 'job-1' });

			const response = await controller.install();

			expect(response.data.job).toBe('job-1');
		});

		it('maps a busy-unit refusal to 409 Conflict', async () => {
			setupService.install.mockRejectedValue(
				new PrivilegedWorkerUnavailableException('Privileged worker unit "smart-panel-remote-access" is already busy.'),
			);

			await expect(controller.install()).rejects.toBeInstanceOf(ConflictException);
		});

		it('maps an unsupported-platform refusal to 409 Conflict', async () => {
			setupService.install.mockRejectedValue(
				new PrivilegedWorkerUnavailableException('Privileged workers are not supported on this platform (docker).'),
			);

			await expect(controller.install()).rejects.toBeInstanceOf(ConflictException);
		});

		it('maps the dev-override refusal to 409 Conflict', async () => {
			setupService.install.mockRejectedValue(
				new TailscaleSetupUnavailableException(
					'Tailscale setup is unavailable while FB_REMOTE_ACCESS_ALLOW_DEV is set.',
				),
			);

			await expect(controller.install()).rejects.toBeInstanceOf(ConflictException);
		});

		it('maps an unexpected failure to 500', async () => {
			setupService.install.mockRejectedValue(new Error('script not found'));

			await expect(controller.install()).rejects.toBeInstanceOf(InternalServerErrorException);
		});
	});

	describe('login', () => {
		it('returns the state, auth URL and QR from the login service', async () => {
			loginService.login.mockResolvedValue({
				state: 'pending-auth',
				authUrl: 'https://login.tailscale.com/a/xyz',
				qr: 'data:image/png;base64,AAA',
			});
			const res = fakeResponse();

			const response = await controller.login({ authKey: undefined }, res);

			expect(response.data).toMatchObject({
				state: 'pending-auth',
				authUrl: 'https://login.tailscale.com/a/xyz',
				qr: 'data:image/png;base64,AAA',
			});
		});

		it('forwards the auth key from the request body', async () => {
			loginService.login.mockResolvedValue({ state: 'connected' });
			const res = fakeResponse();

			await controller.login({ authKey: 'tskey-auth-secret' }, res);

			expect(loginService.login).toHaveBeenCalledWith('tskey-auth-secret');
		});

		it('always sets Cache-Control: no-store, even on a connected (no-URL) result', async () => {
			loginService.login.mockResolvedValue({ state: 'connected' });
			const res = fakeResponse();

			await controller.login({ authKey: undefined }, res);

			expect(res.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
		});

		it('never leaks the auth key into a thrown error message', async () => {
			loginService.login.mockRejectedValue(new Error('spawn tailscale ENOENT'));
			const res = fakeResponse();

			await expect(controller.login({ authKey: 'tskey-auth-secret' }, res)).rejects.toBeInstanceOf(
				InternalServerErrorException,
			);

			try {
				await controller.login({ authKey: 'tskey-auth-secret' }, res);
			} catch (error) {
				expect((error as Error).message).not.toContain('tskey-auth-secret');
			}
		});
	});

	describe('logout', () => {
		it('signs out and returns the resulting node status', async () => {
			const res = fakeResponse();

			const response = await controller.logout(res);

			expect(loginService.logout).toHaveBeenCalledTimes(1);
			expect(response.data.type).toBe('remote-access-tailscale');
		});

		it('maps an unexpected failure to 500', async () => {
			loginService.logout.mockRejectedValue(new Error('boom'));
			const res = fakeResponse();

			await expect(controller.logout(res)).rejects.toBeInstanceOf(InternalServerErrorException);
		});

		it('sets Cache-Control: no-store when the resulting status is pending-auth', async () => {
			providerService.getStatus.mockResolvedValue({ ...baseStatus, state: 'pending-auth' });
			const res = fakeResponse();

			await controller.logout(res);

			expect(res.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
		});
	});

	describe('resetPreferences', () => {
		it('resets preferences and returns the resulting node status', async () => {
			const res = fakeResponse();

			const response = await controller.resetPreferences(res);

			expect(loginService.resetPreferences).toHaveBeenCalledTimes(1);
			expect(response.data.type).toBe('remote-access-tailscale');
		});

		it('maps an unexpected failure to 500', async () => {
			loginService.resetPreferences.mockRejectedValue(new Error('boom'));
			const res = fakeResponse();

			await expect(controller.resetPreferences(res)).rejects.toBeInstanceOf(InternalServerErrorException);
		});
	});
});
