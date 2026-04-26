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
	let jwtService: { verifyAsync: jest.Mock; decode: jest.Mock };
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
		jwtService = {
			verifyAsync: jest.fn(),
			// `decode` is the cheap base64-only pre-filter the guard uses to
			// avoid running signature verification on tokens that don't even
			// claim to be display-class. Most tests want it to mirror what
			// `verifyAsync` would return; the DoS-amplification tests
			// override it with a non-display payload to assert the
			// short-circuit.
			decode: jest.fn(),
		};
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

	const stubDisplayPayload = (sub: string = uuid()) => {
		const payload = { sub, type: TokenOwnerType.DISPLAY };
		jwtService.decode.mockReturnValue(payload);
		jwtService.verifyAsync.mockResolvedValue(payload);
		return payload;
	};

	it('skips throttling for a request bearing a valid display JWT', async () => {
		stubDisplayPayload();

		const skipped = await callShouldSkip(buildContext({ authorization: 'Bearer display.signed.token' }));

		expect(skipped).toBe(true);
		expect(jwtService.verifyAsync).toHaveBeenCalledWith('display.signed.token');
	});

	it('does NOT skip for valid USER (long-live) tokens', async () => {
		// Cheap-decode pre-filter sees `type: USER` and short-circuits
		// without ever paying for signature verification.
		jwtService.decode.mockReturnValue({ sub: uuid(), type: TokenOwnerType.USER });

		expect(await callShouldSkip(buildContext({ authorization: 'Bearer user.long.live.token' }))).toBe(false);
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('does NOT skip for user access tokens (no `type` claim)', async () => {
		// User access tokens carry no `type` field, so the cheap decode
		// pre-filter rejects them before any crypto runs.
		jwtService.decode.mockReturnValue({ sub: uuid() });

		expect(await callShouldSkip(buildContext({ authorization: 'Bearer user.access.token' }))).toBe(false);
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('does NOT skip when the JWT signature is invalid', async () => {
		// Forged token claims display, but signature check fails.
		jwtService.decode.mockReturnValue({ sub: uuid(), type: TokenOwnerType.DISPLAY });
		jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

		expect(await callShouldSkip(buildContext({ authorization: 'Bearer forged.bad.signature' }))).toBe(false);
	});

	it('does NOT skip when the Authorization header is missing', async () => {
		expect(await callShouldSkip(buildContext({}))).toBe(false);
		expect(jwtService.decode).not.toHaveBeenCalled();
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('does NOT skip for non-Bearer auth schemes', async () => {
		expect(await callShouldSkip(buildContext({ authorization: 'Basic dXNlcjpwYXNz' }))).toBe(false);
		expect(jwtService.decode).not.toHaveBeenCalled();
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('does NOT skip when the display payload lacks `sub`', async () => {
		// Pre-filter rejects display tokens missing `sub` without touching
		// signature verification — saves a verify on the malformed path.
		jwtService.decode.mockReturnValue({ type: TokenOwnerType.DISPLAY });

		expect(await callShouldSkip(buildContext({ authorization: 'Bearer malformed.display' }))).toBe(false);
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
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
		stubDisplayPayload();
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
		stubDisplayPayload();
		reflector.getAllAndOverride.mockImplementation((key: string) =>
			key === THROTTLER_SKIP + 'default' ? true : undefined,
		);

		const skipped = await callShouldSkip(buildContext({ authorization: 'Bearer display.signed.token' }));

		expect(skipped).toBe(false);
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	// Codex P1 (round 2): `verifyAsync` is signature crypto and we MUST NOT
	// pay it on every Bearer request, or a flood of forged tokens becomes a
	// DoS amplification vector. The cheap base64 `decode` pre-filter handles
	// the common-and-most-attacker-friendly case (token with `type !== display`)
	// without any crypto cost.
	it('avoids verifyAsync when decoded payload is not a display token', async () => {
		jwtService.decode.mockReturnValue({ sub: uuid(), type: TokenOwnerType.USER });

		await callShouldSkip(buildContext({ authorization: 'Bearer forged.user.shaped.token' }));

		expect(jwtService.decode).toHaveBeenCalledWith('forged.user.shaped.token');
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('avoids verifyAsync when decode returns null (totally malformed token)', async () => {
		// A garbage Bearer string — `JwtService.decode` returns `null` rather
		// than throwing for many malformed inputs. We must still skip the
		// crypto path.
		jwtService.decode.mockReturnValue(null);

		await callShouldSkip(buildContext({ authorization: 'Bearer not-even-a-jwt' }));

		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('caches a positive verdict so a display burst only verifies once per token', async () => {
		// The whole reason this guard exists: a registered display fires
		// dozens of cache-warm requests on cold-boot. Verifying the JWT
		// signature on each would defeat the throttle bypass's purpose
		// (still a bottleneck) AND amplify any forged-token DoS.
		stubDisplayPayload();
		const ctx = () => buildContext({ authorization: 'Bearer display.signed.token' });

		expect(await callShouldSkip(ctx())).toBe(true);
		expect(await callShouldSkip(ctx())).toBe(true);
		expect(await callShouldSkip(ctx())).toBe(true);

		expect(jwtService.verifyAsync).toHaveBeenCalledTimes(1);
	});

	it('caches a negative verdict so a forged-token flood verifies only once', async () => {
		// Same forged token re-sent: signature check runs once, the failure
		// is cached, and subsequent requests defer to the throttler counters
		// without re-paying for crypto.
		jwtService.decode.mockReturnValue({ sub: uuid(), type: TokenOwnerType.DISPLAY });
		jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
		const ctx = () => buildContext({ authorization: 'Bearer forged.display.token' });

		expect(await callShouldSkip(ctx())).toBe(false);
		expect(await callShouldSkip(ctx())).toBe(false);
		expect(await callShouldSkip(ctx())).toBe(false);

		expect(jwtService.verifyAsync).toHaveBeenCalledTimes(1);
	});

	// Codex P1 (round 3): per-token cache is defeated by an attacker who
	// rotates the Bearer string per request — every new token is a cache
	// miss, the cheap-decode pre-filter passes (attacker controls the
	// unsigned `type` claim), so `verifyAsync` would fire on every
	// request without an additional bound. The token-bucket gate caps
	// worst-case crypto throughput at `MAX_VERIFY_PER_SEC` regardless of
	// attacker token rotation.
	it('falls through to the throttler when the global verify token bucket is drained', async () => {
		// Force the bucket empty by setting the internal state directly.
		// Going through `tryConsumeVerifyToken` 200× in a loop is racy on
		// CI workers — each iteration reads `Date.now()` and refills at
		// `MAX_VERIFY_PER_SEC`/sec, so a slow-enough loop keeps the bucket
		// net-flat. Setting state directly is the deterministic way to
		// assert what `shouldSkip` does when the bucket is already drained.
		const bucketState = guard as unknown as { verifyTokens: number; verifyTokensRefilledAt: number };
		bucketState.verifyTokens = 0;
		bucketState.verifyTokensRefilledAt = Date.now();

		jwtService.decode.mockReturnValue({ sub: uuid(), type: TokenOwnerType.DISPLAY });

		const skipped = await callShouldSkip(buildContext({ authorization: 'Bearer rotating.forged.token' }));

		expect(skipped).toBe(false);
		// CRITICAL: the bucket short-circuit means `verifyAsync` did NOT
		// run, so an attacker can't burn CPU by rotating tokens past the
		// cache.
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});
});
