import { FastifyReply } from 'fastify';

import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';

import { AuthenticatedRequest, IS_PUBLIC_KEY } from '../../../modules/auth/guards/auth.guard';
import { ROLES_KEY } from '../../../modules/users/guards/roles.guard';
import { UserRole } from '../../../modules/users/users.constants';
import {
	HomeyCloudAuthorizationSelectionRequestDto,
	HomeyCloudAuthorizationTransactionRequestDto,
} from '../dto/cloud-authorization.dto';
import { HomeyCloudAuthorizationCompletionStatus } from '../models/cloud-authorization.model';
import { HomeyCloudAuthorizationHttpService } from '../services/homey-cloud-authorization-http.service';

import { HomeyCloudAuthorizationController } from './homey-cloud-authorization.controller';

describe('HomeyCloudAuthorizationController', () => {
	let cloudAuthorization: jest.Mocked<
		Pick<
			HomeyCloudAuthorizationHttpService,
			| 'cancel'
			| 'completeCallback'
			| 'disconnect'
			| 'getResultUrl'
			| 'getStatus'
			| 'listHomeys'
			| 'selectHomey'
			| 'start'
		>
	>;
	let controller: HomeyCloudAuthorizationController;

	beforeEach(() => {
		cloudAuthorization = {
			cancel: jest.fn(),
			completeCallback: jest.fn(),
			disconnect: jest.fn(),
			getResultUrl: jest.fn().mockReturnValue('https://panel.example.com/config/plugins/devices-homey-plugin'),
			getStatus: jest.fn(),
			listHomeys: jest.fn(),
			selectHomey: jest.fn(),
			start: jest.fn(),
		};
		controller = new HomeyCloudAuthorizationController(
			cloudAuthorization as unknown as HomeyCloudAuthorizationHttpService,
		);
	});

	it('marks only the callback public and restricts every management route to owner and admin roles', () => {
		const prototype = HomeyCloudAuthorizationController.prototype;

		// Metadata is read from the method object without invoking the unbound handler.
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.callback)).toBe(true);

		for (const route of ['status', 'start', 'reconnect', 'listHomeys', 'select', 'cancel', 'disconnect'] as const) {
			expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype[route])).not.toBe(true);
			expect(Reflect.getMetadata(ROLES_KEY, prototype[route])).toEqual([UserRole.OWNER, UserRole.ADMIN]);
		}
	});

	it('returns credential-free cloud authorization status', async () => {
		cloudAuthorization.getStatus.mockResolvedValue({ connected: true, selectedHomeyId: 'homey-1' });

		await expect(controller.status()).resolves.toMatchObject({
			data: { connected: true, selectedHomeyId: 'homey-1' },
		});
	});

	it('starts an authorization transaction for the exact authenticated user', async () => {
		cloudAuthorization.start.mockResolvedValue({
			authorizeUrl: 'https://api.athom.com/oauth2/authorise?state=secret-state',
			expiresAt: new Date('2026-08-29T12:05:00.000Z'),
			transactionId: 'transaction-1',
		});

		const response = await controller.start({
			auth: { type: 'user', id: 'admin-user', role: UserRole.ADMIN },
		} as AuthenticatedRequest);

		expect(cloudAuthorization.start).toHaveBeenCalledWith('admin-user');
		expect(response.data).toMatchObject({
			authorizeUrl: 'https://api.athom.com/oauth2/authorise?state=secret-state',
			expiresAt: '2026-08-29T12:05:00.000Z',
			transactionId: 'transaction-1',
		});
	});

	it('uses the owning user for a privileged long-lived credential', async () => {
		cloudAuthorization.disconnect.mockResolvedValue(true);

		const response = await controller.disconnect({
			auth: {
				type: 'token',
				tokenId: 'token-1',
				ownerType: 'user',
				ownerId: 'owner-user',
				role: UserRole.OWNER,
			},
		} as AuthenticatedRequest);

		expect(cloudAuthorization.disconnect).toHaveBeenCalledWith('owner-user');
		expect(response.data).toMatchObject({
			status: HomeyCloudAuthorizationCompletionStatus.DISCONNECTED,
			changed: true,
			homeyId: null,
		});
	});

	it('rejects credentials that are not associated with a user before a mutation', async () => {
		await expect(
			controller.disconnect({
				auth: {
					type: 'token',
					tokenId: 'display-token',
					ownerType: 'display',
					ownerId: null,
					role: UserRole.OWNER,
				},
			} as AuthenticatedRequest),
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(cloudAuthorization.disconnect).not.toHaveBeenCalled();
	});

	it('always redirects callback responses to the clean result URL with defensive headers', async () => {
		cloudAuthorization.completeCallback.mockRejectedValue(new Error('provider-secret raw callback failure'));
		const reply = createReply();

		await controller.callback(
			{
				code: 'provider-secret-code',
				state: 'single-use-secret-state',
				error_description: 'private provider description',
			},
			reply.value,
		);

		expect(cloudAuthorization.completeCallback).toHaveBeenCalledWith({
			code: 'provider-secret-code',
			providerError: false,
			state: 'single-use-secret-state',
		});
		expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
		expect(reply.header).toHaveBeenCalledWith('Pragma', 'no-cache');
		expect(reply.header).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
		expect(reply.redirect).toHaveBeenCalledWith('https://panel.example.com/config/plugins/devices-homey-plugin', 303);
		expect(JSON.stringify(reply.redirect.mock.calls)).not.toContain('provider-secret');
	});

	it('treats a provider error parameter as cancellation without forwarding its value', async () => {
		const reply = createReply();

		await controller.callback(
			{ error: 'access_denied', error_description: 'private', state: 'single-use-state' },
			reply.value,
		);

		expect(cloudAuthorization.completeCallback).toHaveBeenCalledWith({
			code: undefined,
			providerError: true,
			state: 'single-use-state',
		});
	});

	it('binds list, selection, and cancellation to the authenticated initiating user', async () => {
		const request = { auth: { type: 'user', id: 'admin-user', role: UserRole.ADMIN } } as AuthenticatedRequest;

		cloudAuthorization.listHomeys.mockResolvedValue({
			status: 'selection_required',
			homeyId: null,
			homeys: [{ id: 'homey-1', name: 'Homey One' }],
		});
		cloudAuthorization.selectHomey.mockResolvedValue({
			status: 'activated',
			homey: { id: 'homey-1', name: 'Homey One' },
			grant: {
				activatedById: 'admin-user',
				authorityGeneration: 1,
				configurationGeneration: 1,
				generation: 2,
				grantIdentifier: 'grant-1',
				selectedHomeyId: 'homey-1',
			},
		});
		cloudAuthorization.cancel.mockResolvedValue(true);

		const list = await controller.listHomeys('transaction-1', request);
		const select = await controller.select(
			{ data: { transactionId: 'transaction-1', homeyId: 'homey-1' } } as HomeyCloudAuthorizationSelectionRequestDto,
			request,
		);
		const cancel = await controller.cancel(
			{ data: { transactionId: 'transaction-1' } } as HomeyCloudAuthorizationTransactionRequestDto,
			request,
		);

		expect(cloudAuthorization.listHomeys).toHaveBeenCalledWith('transaction-1', 'admin-user');
		expect(cloudAuthorization.selectHomey).toHaveBeenCalledWith('transaction-1', 'admin-user', 'homey-1');
		expect(cloudAuthorization.cancel).toHaveBeenCalledWith('transaction-1', 'admin-user');
		expect(list.data.status).toBe('selection_required');
		expect(list.data.homeyId).toBeNull();
		expect(list.data.homeys).toEqual([{ id: 'homey-1', name: 'Homey One' }]);
		expect(select.data).toMatchObject({ status: 'connected', changed: true, homeyId: 'homey-1' });
		expect(cancel.data).toMatchObject({ status: 'cancelled', changed: true, homeyId: null });
	});

	it('replaces unknown failures with a fixed credential-safe server error', async () => {
		cloudAuthorization.listHomeys.mockRejectedValue(new Error('raw-token-value'));

		await expect(
			controller.listHomeys('transaction-1', {
				auth: { type: 'user', id: 'admin-user', role: UserRole.ADMIN },
			} as AuthenticatedRequest),
		).rejects.toEqual(new InternalServerErrorException('Homey Cloud authorization could not be completed'));
	});

	it('returns exact-transaction callback completion without exposing grant metadata', async () => {
		cloudAuthorization.listHomeys.mockResolvedValue({
			status: 'connected',
			homeyId: 'homey-1',
			homeys: [],
		});

		const response = await controller.listHomeys('transaction-1', {
			auth: { type: 'user', id: 'admin-user', role: UserRole.ADMIN },
		} as AuthenticatedRequest);

		expect(response.data).toMatchObject({ status: 'connected', homeyId: 'homey-1', homeys: [] });
		expect(JSON.stringify(response)).not.toContain('grantIdentifier');
	});
});

const createReply = (): {
	value: FastifyReply;
	header: jest.Mock;
	redirect: jest.Mock;
} => {
	const header = jest.fn();
	const redirect = jest.fn();
	const value = { header, redirect } as unknown as FastifyReply;

	header.mockReturnValue(value);
	redirect.mockReturnValue(value);

	return { value, header, redirect };
};
