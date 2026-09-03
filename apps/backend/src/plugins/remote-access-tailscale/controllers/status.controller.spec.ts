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

import { RemoteAccessProviderStatus } from '../../../modules/remote-access/platforms/remote-access-provider.platform';
import { TailscaleNodeManagedService } from '../services/tailscale-node-managed.service';
import { TailscaleProviderService } from '../services/tailscale-provider.service';

import { StatusController } from './status.controller';

describe('StatusController', () => {
	let controller: StatusController;
	let providerService: { getStatus: jest.Mock };
	let nodeManagedService: { evaluateRequirements: jest.Mock };

	const baseStatus: RemoteAccessProviderStatus = {
		type: 'remote-access-tailscale',
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

		const module: TestingModule = await Test.createTestingModule({
			controllers: [StatusController],
			providers: [
				{ provide: TailscaleProviderService, useValue: providerService },
				{ provide: TailscaleNodeManagedService, useValue: nodeManagedService },
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
			type: 'remote-access-tailscale',
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

	it('never includes an authUrl or qr field, even while pending-auth', async () => {
		providerService.getStatus.mockResolvedValue({ ...baseStatus, state: 'pending-auth', endpoints: [] });
		const res = fakeResponse();

		const response = await controller.getStatus(res);

		expect(response.data).not.toHaveProperty('authUrl');
		expect(response.data).not.toHaveProperty('qr');
	});
});
