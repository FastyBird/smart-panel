import { v4 as uuid } from 'uuid';

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';

import { UserRole } from '../../users/users.constants';
import { TokenOwnerType } from '../auth.constants';

import { AuthenticatedRequest } from './auth.guard';
import { DisplayAwareThrottlerGuard } from './display-aware-throttler.guard';

describe('DisplayAwareThrottlerGuard.shouldSkip', () => {
	let guard: DisplayAwareThrottlerGuard;

	const buildContext = (auth: AuthenticatedRequest['auth'] | undefined): ExecutionContext => {
		const request = { auth } as AuthenticatedRequest;
		return {
			switchToHttp: () => ({
				getRequest: <T>(): T => request as unknown as T,
				getResponse: <T>(): T => ({}) as T,
				getNext: <T>(): T => ({}) as T,
			}),
			getHandler: jest.fn(),
			getClass: jest.fn(),
		} as unknown as ExecutionContext;
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DisplayAwareThrottlerGuard,
				Reflector,
				{
					provide: 'THROTTLER:MODULE_OPTIONS',
					useValue: { throttlers: [{ ttl: 60_000, limit: 30 }] } as ThrottlerModuleOptions,
				},
				{
					provide: ThrottlerStorage,
					useValue: { increment: jest.fn(), getRecord: jest.fn() } as unknown as ThrottlerStorage,
				},
			],
		}).compile();

		guard = module.get<DisplayAwareThrottlerGuard>(DisplayAwareThrottlerGuard);
	});

	it('skips throttling for requests authenticated with a display token', async () => {
		const skipped = await (guard as unknown as { shouldSkip(ctx: ExecutionContext): Promise<boolean> }).shouldSkip(
			buildContext({
				type: 'token',
				tokenId: uuid(),
				ownerType: TokenOwnerType.DISPLAY,
				ownerId: uuid(),
				role: UserRole.USER,
			}),
		);

		expect(skipped).toBe(true);
	});

	it('does NOT skip throttling for long-live USER tokens', async () => {
		// Reflector returns no metadata → super.shouldSkip falls back to false.
		const skipped = await (guard as unknown as { shouldSkip(ctx: ExecutionContext): Promise<boolean> }).shouldSkip(
			buildContext({
				type: 'token',
				tokenId: uuid(),
				ownerType: TokenOwnerType.USER,
				ownerId: uuid(),
				role: UserRole.ADMIN,
			}),
		);

		expect(skipped).toBe(false);
	});

	it('does NOT skip throttling for web admin user sessions', async () => {
		const skipped = await (guard as unknown as { shouldSkip(ctx: ExecutionContext): Promise<boolean> }).shouldSkip(
			buildContext({ type: 'user', id: uuid(), role: UserRole.ADMIN }),
		);

		expect(skipped).toBe(false);
	});

	it('does NOT skip throttling for unauthenticated requests', async () => {
		// `request.auth` is undefined when AuthGuard hasn't populated it yet
		// (e.g. unauthenticated traffic that the global guard rejects later, or
		// a transient module-load order in which AuthGuard runs after this).
		// Fail-safe direction: throttle still applies.
		const skipped = await (guard as unknown as { shouldSkip(ctx: ExecutionContext): Promise<boolean> }).shouldSkip(
			buildContext(undefined),
		);

		expect(skipped).toBe(false);
	});
});
