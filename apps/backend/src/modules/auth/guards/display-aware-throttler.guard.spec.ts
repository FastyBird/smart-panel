/* eslint-disable @typescript-eslint/unbound-method */
import { Request } from 'express';
import { v4 as uuid } from 'uuid';

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';

import { TokenOwnerType } from '../auth.constants';

import { DisplayAwareThrottlerGuard } from './display-aware-throttler.guard';

describe('DisplayAwareThrottlerGuard.shouldSkip', () => {
	let guard: DisplayAwareThrottlerGuard;
	let jwtService: { verifyAsync: jest.Mock };

	const buildContext = (authorization?: string): ExecutionContext => {
		const request = {
			headers: authorization ? { authorization } : {},
		} as unknown as Request;
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
		jwtService = {
			verifyAsync: jest.fn(),
		};

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
				{
					provide: JwtService,
					useValue: jwtService,
				},
			],
		}).compile();

		guard = module.get<DisplayAwareThrottlerGuard>(DisplayAwareThrottlerGuard);
	});

	const callShouldSkip = (ctx: ExecutionContext) =>
		(guard as unknown as { shouldSkip(c: ExecutionContext): Promise<boolean> }).shouldSkip(ctx);

	it('skips throttling for a request bearing a valid display JWT', async () => {
		jwtService.verifyAsync.mockResolvedValue({
			sub: uuid(),
			type: TokenOwnerType.DISPLAY,
		});

		const skipped = await callShouldSkip(buildContext('Bearer display.signed.token'));

		expect(skipped).toBe(true);
		expect(jwtService.verifyAsync).toHaveBeenCalledWith('display.signed.token');
	});

	it('does NOT skip for valid USER (long-live) tokens', async () => {
		jwtService.verifyAsync.mockResolvedValue({
			sub: uuid(),
			type: TokenOwnerType.USER,
		});

		const skipped = await callShouldSkip(buildContext('Bearer user.long.live.token'));

		expect(skipped).toBe(false);
	});

	it('does NOT skip for user access tokens (no `type` claim)', async () => {
		jwtService.verifyAsync.mockResolvedValue({
			sub: uuid(),
			// No `type` field — user access tokens omit it. AuthGuard treats
			// `payload.sub && !payload.type` as the user-access-token branch.
		});

		const skipped = await callShouldSkip(buildContext('Bearer user.access.token'));

		expect(skipped).toBe(false);
	});

	it('does NOT skip when the JWT signature is invalid', async () => {
		// Simulates a forged token claiming `type: display` — without a valid
		// signature, the guard refuses to skip.
		jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

		const skipped = await callShouldSkip(buildContext('Bearer forged.bad.signature'));

		expect(skipped).toBe(false);
	});

	it('does NOT skip when the Authorization header is missing', async () => {
		// Anonymous flood to a protected route — the throttler MUST apply
		// here; this is the primary protection path the guard preserves.
		const skipped = await callShouldSkip(buildContext(undefined));

		expect(skipped).toBe(false);
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('does NOT skip for non-Bearer auth schemes', async () => {
		const skipped = await callShouldSkip(buildContext('Basic dXNlcjpwYXNz'));

		expect(skipped).toBe(false);
		expect(jwtService.verifyAsync).not.toHaveBeenCalled();
	});

	it('does NOT skip when the display payload lacks `sub`', async () => {
		// Defensive: a token that says `type: display` but omits `sub` is
		// malformed and shouldn't unlock the bypass.
		jwtService.verifyAsync.mockResolvedValue({
			type: TokenOwnerType.DISPLAY,
			// no sub
		});

		const skipped = await callShouldSkip(buildContext('Bearer malformed.display'));

		expect(skipped).toBe(false);
	});
});
