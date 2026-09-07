/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: `expect(res.header).toHaveBeenCalledWith(...)` reads the jest.fn()
mock off the fake FastifyReply without calling it, which ESLint flags as an
unbound method access even though it is never invoked unbound.
*/
import { FastifyReply } from 'fastify';

import { Test, TestingModule } from '@nestjs/testing';

import { PlatformService } from '../../../modules/platform/services/platform.service';
import { RemoteAccessProviderStatus } from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { TailscaleLoginService } from '../services/tailscale-login.service';
import { TailscaleNodeManagedService } from '../services/tailscale-node-managed.service';
import { TailscaleProviderService } from '../services/tailscale-provider.service';
import { TailscaleSetupService } from '../services/tailscale-setup.service';

import { StatusController } from './status.controller';

describe('StatusController', () => {
	let controller: StatusController;
	let providerService: { getStatus: jest.Mock };
	let nodeManagedService: { evaluateRequirements: jest.Mock };
	let loginService: { getPendingInteractiveAuth: jest.Mock };
	let setupService: { getLastJob: jest.Mock };
	let platformService: { getPrivilegedWorkerSupport: jest.Mock };

	const baseStatus: RemoteAccessProviderStatus = {
		type: 'remote-access-tailscale-plugin',
		state: 'connected',
		endpoints: [{ url: 'http://100.64.0.5:3000', scope: 'private', https: false, label: 'Tailscale IPv4' }],
		details: { tailnet: 'example.ts.net' },
		proxyAddresses: [],
		advisories: [],
		updatedAt: '2026-09-02T00:00:00.000Z',
	};

	const baseRequirements = [
		{ code: 'platform-supported', satisfied: true, message: 'ok' },
		{ code: 'binary-installed', satisfied: true, message: 'ok' },
		{ code: 'daemon-active', satisfied: true, message: 'ok' },
		{ code: 'operator-granted', satisfied: true, message: 'ok' },
		{ code: 'version-supported', satisfied: true, message: 'ok' },
	];

	beforeEach(async () => {
		providerService = { getStatus: jest.fn().mockResolvedValue(baseStatus) };
		nodeManagedService = { evaluateRequirements: jest.fn().mockResolvedValue(baseRequirements) };
		loginService = { getPendingInteractiveAuth: jest.fn().mockReturnValue(null) };
		setupService = { getLastJob: jest.fn().mockReturnValue(null) };
		platformService = {
			getPrivilegedWorkerSupport: jest
				.fn()
				.mockResolvedValue({ supported: true, reason: null, checkedAt: '2026-09-07T00:00:00.000Z' }),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [StatusController],
			providers: [
				{ provide: TailscaleProviderService, useValue: providerService },
				{ provide: TailscaleNodeManagedService, useValue: nodeManagedService },
				{ provide: TailscaleLoginService, useValue: loginService },
				{ provide: TailscaleSetupService, useValue: setupService },
				{ provide: PlatformService, useValue: platformService },
			],
		}).compile();

		controller = module.get<StatusController>(StatusController);
	});

	function fakeResponse(): FastifyReply {
		return { header: jest.fn() } as unknown as FastifyReply;
	}

	it('composes the endpoint, details and requirements into one response', async () => {
		const res = fakeResponse();

		const response = await controller.getStatus(res);

		expect(response.data).toMatchObject({
			type: 'remote-access-tailscale-plugin',
			state: 'connected',
			proxyAddresses: [],
			details: { tailnet: 'example.ts.net' },
		});
		expect(response.data.endpoints).toHaveLength(1);
		expect(response.data.endpoints[0]).toMatchObject({ url: 'http://100.64.0.5:3000', label: 'Tailscale IPv4' });
		expect(response.data.requirements).toHaveLength(5);
		expect(response.data.requirements[0]).toMatchObject({ code: 'platform-supported', satisfied: true });
	});

	it('does not set Cache-Control when the state is not pending-auth', async () => {
		const res = fakeResponse();

		await controller.getStatus(res);

		expect(res.header).not.toHaveBeenCalled();
	});

	it('sets Cache-Control: no-store when the state is pending-auth', async () => {
		providerService.getStatus.mockResolvedValue({ ...baseStatus, state: 'pending-auth', endpoints: [] });
		const res = fakeResponse();

		await controller.getStatus(res);

		expect(res.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
	});

	it('omits authUrl and qr while pending-auth when nothing is tracked as pending (e.g. after a restart)', async () => {
		providerService.getStatus.mockResolvedValue({ ...baseStatus, state: 'pending-auth', endpoints: [] });
		loginService.getPendingInteractiveAuth.mockReturnValue(null);
		const res = fakeResponse();

		const response = await controller.getStatus(res);

		expect(response.data).not.toHaveProperty('authUrl');
		expect(response.data).not.toHaveProperty('qr');
		expect(res.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
	});

	it('never includes an authUrl or qr field when connected, even if a login happens to be tracked', async () => {
		providerService.getStatus.mockResolvedValue(baseStatus);
		loginService.getPendingInteractiveAuth.mockReturnValue({
			authUrl: 'https://login.tailscale.com/a/xyz',
			qr: 'data:image/png;base64,AAA',
		});
		const res = fakeResponse();

		const response = await controller.getStatus(res);

		expect(response.data).not.toHaveProperty('authUrl');
		expect(response.data).not.toHaveProperty('qr');
	});

	it('fills authUrl and qr from the login service while pending-auth', async () => {
		providerService.getStatus.mockResolvedValue({ ...baseStatus, state: 'pending-auth', endpoints: [] });
		loginService.getPendingInteractiveAuth.mockReturnValue({
			authUrl: 'https://login.tailscale.com/a/xyz',
			qr: 'data:image/png;base64,AAA',
		});
		const res = fakeResponse();

		const response = await controller.getStatus(res);

		expect(response.data.authUrl).toBe('https://login.tailscale.com/a/xyz');
		expect(response.data.qr).toBe('data:image/png;base64,AAA');
		expect(res.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
	});

	describe('setup / privilegedSetup', () => {
		it('reports setup: null when no job has run since this process started', async () => {
			const res = fakeResponse();

			const response = await controller.getStatus(res);

			expect(response.data.setup).toBeNull();
		});

		it('composes the last known setup job from TailscaleSetupService.getLastJob()', async () => {
			setupService.getLastJob.mockReturnValue({
				id: 'job-1',
				status: {
					id: 'job-1',
					state: 'running',
					step: 'install-package',
					message: 'Installing tailscale',
					updatedAt: '2026-09-07T00:00:00.000Z',
				},
			});
			const res = fakeResponse();

			const response = await controller.getStatus(res);

			expect(response.data.setup).toMatchObject({
				jobId: 'job-1',
				state: 'running',
				step: 'install-package',
				message: 'Installing tailscale',
				updatedAt: '2026-09-07T00:00:00.000Z',
			});
		});

		it('falls back to null step/message when the job status omits them', async () => {
			setupService.getLastJob.mockReturnValue({
				id: 'job-1',
				status: { id: 'job-1', state: 'complete', updatedAt: '2026-09-07T00:00:00.000Z' },
			});
			const res = fakeResponse();

			const response = await controller.getStatus(res);

			expect(response.data.setup).toMatchObject({ jobId: 'job-1', state: 'complete', step: null, message: null });
		});

		it('reports privilegedSetup from PlatformService.getPrivilegedWorkerSupport()', async () => {
			platformService.getPrivilegedWorkerSupport.mockResolvedValue({
				supported: false,
				reason: 'sudo: a password is required',
				checkedAt: '2026-09-07T00:00:00.000Z',
			});
			const res = fakeResponse();

			const response = await controller.getStatus(res);

			expect(response.data.privilegedSetup).toEqual({
				available: false,
				reason: 'sudo: a password is required',
			});
		});
	});
});
