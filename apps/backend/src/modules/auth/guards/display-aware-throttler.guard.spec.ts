/* eslint-disable @typescript-eslint/unbound-method */
import { Request } from 'express';
import { v4 as uuid } from 'uuid';

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { THROTTLER_LIMIT, THROTTLER_SKIP } from '@nestjs/throttler/dist/throttler.constants';

import { TokenOwnerType } from '../auth.constants';

import { DisplayAwareThrottlerGuard } from './display-aware-throttler.guard';

type ContextOptions = {
	authorization?: string;
	type?: 'http' | 'ws' | 'rpc';
};

describe('DisplayAwareThrottlerGuard.shouldSkip', () => {
	let guard: DisplayAwareThrottlerGuard;
	let jwtService: { verifyAsync: jest.Mock };
	let reflector: { getAllAndOverride: jest.Mock };

	const buildContext = ({ authorization, type = 'http' }: ContextOptions = {}): ExecutionContext => {
		const request =
			type === 'http'
				? ({ headers: authorization ? { authorization } : {} } as unknown as Request)
				: ({} as unknown as Request);
		return {
			getType: () => type,
			switchToHttp: () => ({
				getRequest: <T>(): T => request as unknown as T,
				getResponse: <T>(): T => ({}) as T,
				getNext: <T>(): T => ({}) as T,
			}),
			getHandler: jest.fn(() => 'handler'),
			getClass: jest.fn(() => 'class'),
		} as unknown as ExecutionContext;
	};

	beforeEach(async () => {
		jwtService = { verifyAsync: jest.fn() };
		// `getAllAndOverride` is the standard reflector lookup the parent
		// uses for `@Throttle` / `@SkipThrottle` metadata. Default to
		// `undefined` (no per-route override); individual tests can stub
		// specific keys.
		reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DisplayAwareThrottlerGuard,
				{ provide: Reflector, useValue: reflector },
				{
					provide: 'THROTTLER:MODULE_OPTIONS',
					useValue: { throttlers: [{ name: 'default', ttl: 60_000, limit: 30 }] } as ThrottlerModuleOptions,
				},
				{
					provide: ThrottlerStorage,
					useValue: { increment: jest.fn(), getRecord: jest.fn() } as unknown as ThrottlerStorage,
				},
				{ provide: JwtService, useValue: jwtService },
			],
		}).compile();

		guard = module.get<DisplayAwareThrottlerGuard>(DisplayAwareThrottlerGuard);
		// `super.shouldSkip` reads `this.throttlers` (set by `onModuleInit`).
		// Hydrate it manually since the test doesn't bootstrap the lifecycle.
		(guard as unknown as { throttlers: { name: string }[] }).throttlers = [{ name: 'default' }];
	});

	const callShouldSkip = (ctx: ExecutionContext) =>
		(guard as unknown as { shouldSkip(c: ExecutionContext): Promise<boolean> }).shouldSkip(ctx);

	it('skips throttling for a request bearing a valid display JWT', async () => {
		jwtService.verifyAsync.mockResolvedValue({ sub: uuid(), type: TokenOwnerType.DISPLAY });

		const skipped = await callShouldSkip(buildContext({ authorization: 'Bearer display.signed.token' }));

		expect(skipped).toBe(true);
		expect(jwtService.verifyAsync).toHaveBeenCalledWith('display.signed.token');
	});

	it('does NOT skip for valid USER (long-live) tokens', async () => {
		jwtService.verifyAsync.mockResolvedValue({ sub: uuid(), type: TokenOwnerType.USER });

		expect(await callShouldSkip(buildContext({ authorization: 'Bearer user.long.live.token' }))).toBe(false);
	});

	it('does NOT skip for user access tokens (no `type` claim)', async () => {
		jwtService.verifyAsync.mockResolvedValue({ sub: uuid() });

		expect(await callShouldSkip(buildContext({ authorization: 'Bearer user.access.token' }))).toBe(false);
	});

	it('does NOT skip when the JWT signature is invalid', async () => {
		jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

		expect(await callShouldSkip(buildContext({ authorization: 'Bearer forged.bad.signature' }))).toBe(false);
	});

	it('does NOT skip when the Authorization header is missing', async () => {
		expect(await callShouldSkip(buildContext({}))).toBe(false);
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('does NOT skip for non-Bearer auth schemes', async () => {
		expect(await callShouldSkip(buildContext({ authorization: 'Basic dXNlcjpwYXNz' }))).toBe(false);
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('does NOT skip when the display payload lacks `sub`', async () => {
		jwtService.verifyAsync.mockResolvedValue({ type: TokenOwnerType.DISPLAY });

		expect(await callShouldSkip(buildContext({ authorization: 'Bearer malformed.display' }))).toBe(false);
	});

	// Cursor High: ws/rpc contexts have no `request.headers`. Defer to parent.
	it('does NOT touch headers on WebSocket contexts', async () => {
		const skipped = await callShouldSkip(buildContext({ type: 'ws' }));

		expect(skipped).toBe(false);
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
		// Reflector reads only happen when context is HTTP — WS short-circuits.
		expect(reflector.getAllAndOverride).not.toHaveBeenCalled();
	});

	// Codex P1: per-route `@Throttle({ limit: 5 })` (e.g. on auth endpoints)
	// MUST take precedence — a stolen display token must not unlock unbounded
	// brute-force on `/auth/login`.
	it('does NOT skip when the route has an explicit @Throttle limit override', async () => {
		jwtService.verifyAsync.mockResolvedValue({ sub: uuid(), type: TokenOwnerType.DISPLAY });
		// Simulate `@Throttle({ default: { limit: 5, ttl: 60000 } })` on the route.
		reflector.getAllAndOverride.mockImplementation((key: string) =>
			key === THROTTLER_LIMIT + 'default' ? 5 : undefined,
		);

		const skipped = await callShouldSkip(buildContext({ authorization: 'Bearer display.signed.token' }));

		expect(skipped).toBe(false);
		// The JWT verification step is never reached — the per-route override
		// short-circuits before the display check.
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('does NOT skip when the route has explicit @SkipThrottle metadata', async () => {
		// `@SkipThrottle()` on a route means "the parent already decided" —
		// the parent's `shouldSkip` will honor it; we just defer.
		jwtService.verifyAsync.mockResolvedValue({ sub: uuid(), type: TokenOwnerType.DISPLAY });
		reflector.getAllAndOverride.mockImplementation((key: string) =>
			key === THROTTLER_SKIP + 'default' ? true : undefined,
		);

		const skipped = await callShouldSkip(buildContext({ authorization: 'Bearer display.signed.token' }));

		expect(skipped).toBe(false);
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});
});
