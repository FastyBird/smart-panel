/* eslint-disable @typescript-eslint/unbound-method -- Execution contexts inspect controller methods as metadata; they never invoke them. */
import { ExecutionContext, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';

import { CloudflareTunnelSetupController } from '../../../plugins/remote-access-cloudflare-tunnel/controllers/setup.controller';
import { CloudflareTunnelStatusController } from '../../../plugins/remote-access-cloudflare-tunnel/controllers/status.controller';
import { TailscaleSetupController } from '../../../plugins/remote-access-tailscale/controllers/setup.controller';
import { TailscaleStatusController } from '../../../plugins/remote-access-tailscale/controllers/status.controller';
import { ClientAddressService } from '../../api/services/client-address.service';
import { TrustedProxyRegistryService } from '../../api/services/trusted-proxy-registry.service';
import { AuthController } from '../controllers/auth.controller';

import { DisplayAwareThrottlerGuard } from './display-aware-throttler.guard';

describe('DisplayAwareThrottlerGuard with real route metadata and storage', () => {
	let guard: DisplayAwareThrottlerGuard;
	let storage: ThrottlerStorageService;

	const context = (
		controller: Type<unknown>,
		handler: ReturnType<ExecutionContext['getHandler']>,
		address = '192.168.2.50',
		authorization?: string,
	) => {
		const request = {
			headers: authorization ? { authorization } : {},
			raw: { socket: { remoteAddress: address } },
		};
		const response = { header: jest.fn() };
		return {
			context: {
				getType: () => 'http',
				getClass: () => controller,
				getHandler: () => handler,
				switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
			} as unknown as ExecutionContext,
			response,
		};
	};
	const statusContext = (address = '192.168.2.50', authorization?: string) =>
		context(TailscaleStatusController, TailscaleStatusController.prototype.getStatus, address, authorization);
	const consume = async (route: ReturnType<typeof context>, count: number): Promise<void> => {
		for (let index = 0; index < count; index++) {
			await expect(guard.canActivate(route.context)).resolves.toBe(true);
		}
	};

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(0);
		storage = new ThrottlerStorageService();
		guard = new DisplayAwareThrottlerGuard(
			[{ ttl: 60_000, limit: 30 }],
			storage,
			new Reflector(),
			new JwtService(),
			new ClientAddressService(new TrustedProxyRegistryService()),
		);
		await guard.onModuleInit();
	});
	afterEach(() => {
		storage.onApplicationShutdown();
		jest.useRealTimers();
	});

	it.each([
		{
			name: 'status reads',
			first: () => context(TailscaleStatusController, TailscaleStatusController.prototype.getStatus),
			second: () => context(CloudflareTunnelStatusController, CloudflareTunnelStatusController.prototype.getStatus),
		},
		{
			name: 'installation actions',
			first: () => context(TailscaleSetupController, TailscaleSetupController.prototype.install),
			second: () => context(CloudflareTunnelSetupController, CloudflareTunnelSetupController.prototype.install),
		},
	])('gives each provider an independent 30-request budget for $name', async ({ first, second }) => {
		const tailscale = first();
		const cloudflare = second();
		await consume(tailscale, 30);
		await consume(cloudflare, 30);
		await expect(guard.canActivate(tailscale.context)).rejects.toBeInstanceOf(ThrottlerException);
		await expect(guard.canActivate(cloudflare.context)).rejects.toBeInstanceOf(ThrottlerException);
	});

	it('gives clients independent budgets while enforcing the same-route limit for each', async () => {
		const first = statusContext('192.168.2.50');
		const second = statusContext('127.0.0.1');
		await consume(first, 30);
		await consume(second, 30);
		await expect(guard.canActivate(first.context)).rejects.toBeInstanceOf(ThrottlerException);
		await expect(guard.canActivate(second.context)).rejects.toBeInstanceOf(ThrottlerException);
		expect(first.response.header).toHaveBeenCalledWith('X-RateLimit-Limit', 30);
		expect(second.response.header).toHaveBeenCalledWith('X-RateLimit-Limit', 30);
	});

	it('shares a client budget across user tokens', async () => {
		const first = statusContext('192.168.2.50', 'Bearer first-user-token');
		const second = statusContext('192.168.2.50', 'Bearer second-user-token');
		await consume(first, 15);
		await consume(second, 15);
		await expect(guard.canActivate(second.context)).rejects.toBeInstanceOf(ThrottlerException);
	});

	it('keeps auth login at five requests per minute and blocks for sixty seconds', async () => {
		const login = context(AuthController, AuthController.prototype.login);
		await consume(login, 5);
		expect(login.response.header).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
		await expect(guard.canActivate(login.context)).rejects.toBeInstanceOf(ThrottlerException);
		expect(login.response.header).toHaveBeenCalledWith('Retry-After', 60);
		jest.advanceTimersByTime(59_999);
		await expect(guard.canActivate(login.context)).rejects.toBeInstanceOf(ThrottlerException);
		jest.advanceTimersByTime(1);
		await consume(login, 5);
		await expect(guard.canActivate(login.context)).rejects.toBeInstanceOf(ThrottlerException);
	});

	it("expires another client's hits when a blocked client resumes", async () => {
		const blocked = statusContext('127.0.0.1');
		const other = statusContext('192.168.2.50');
		await consume(blocked, 30);
		await expect(guard.canActivate(blocked.context)).rejects.toBeInstanceOf(ThrottlerException);
		jest.advanceTimersByTime(30_000);
		await consume(other, 10);
		jest.advanceTimersByTime(30_001);
		await consume(blocked, 1);
		jest.advanceTimersByTime(30_000);
		await consume(other, 30);
		await expect(guard.canActivate(other.context)).rejects.toBeInstanceOf(ThrottlerException);
	});

	it('expires provider hits when an auth route on the same client leaves its block', async () => {
		const login = context(AuthController, AuthController.prototype.login);
		const status = statusContext();
		await consume(login, 5);
		await expect(guard.canActivate(login.context)).rejects.toBeInstanceOf(ThrottlerException);
		jest.advanceTimersByTime(30_000);
		await consume(status, 10);
		jest.advanceTimersByTime(30_001);
		await consume(login, 1);
		jest.advanceTimersByTime(30_000);
		await consume(status, 30);
		await expect(guard.canActivate(status.context)).rejects.toBeInstanceOf(ThrottlerException);
	});

	it('recovers from a prior burst and allows five-second status polling for eight minutes', async () => {
		const status = statusContext();
		await consume(status, 30);
		await expect(guard.canActivate(status.context)).rejects.toBeInstanceOf(ThrottlerException);
		jest.advanceTimersByTime(60_000);
		for (let index = 0; index < 96; index++) {
			await consume(status, 1);
			jest.advanceTimersByTime(5_000);
		}
	});
});
