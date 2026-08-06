import { FastifyRequest } from 'fastify';

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';

import { TokenOwnerType } from '../../auth/auth.constants';
import { MCP_AUTHENTICATED_RATE_LIMIT, MCP_RATE_LIMIT_TTL_MS, MCP_UNAUTHENTICATED_RATE_LIMIT } from '../mcp.constants';
import { McpInstallationService } from '../services/mcp-installation.service';

import { McpThrottleGuard } from './mcp-throttle.guard';

describe('McpThrottleGuard', () => {
	let isMcpEndpoint: boolean;
	let jwtService: jest.Mocked<Pick<JwtService, 'decode' | 'verifyAsync'>>;
	let storage: jest.Mocked<ThrottlerStorage>;
	let increment: jest.MockedFunction<ThrottlerStorage['increment']>;
	let guard: McpThrottleGuard;

	beforeEach(() => {
		isMcpEndpoint = true;
		jwtService = {
			decode: jest.fn(),
			verifyAsync: jest.fn(),
		};
		increment = jest.fn().mockResolvedValue({
			totalHits: 1,
			timeToExpire: MCP_RATE_LIMIT_TTL_MS,
			isBlocked: false,
			timeToBlockExpire: 0,
		});
		storage = {
			increment,
		};
		guard = new McpThrottleGuard(
			{ getAllAndOverride: jest.fn(() => isMcpEndpoint) } as unknown as Reflector,
			jwtService as unknown as JwtService,
			{ getAudience: jest.fn().mockResolvedValue('audience') } as unknown as McpInstallationService,
			storage,
		);
	});

	it('does not count non-MCP routes', async () => {
		isMcpEndpoint = false;

		await expect(guard.canActivate(context(request()))).resolves.toBe(true);
		expect(increment).not.toHaveBeenCalled();
	});

	it('uses a verified client identity for the authenticated budget', async () => {
		jwtService.decode.mockReturnValue({ sub: 'client-id', type: TokenOwnerType.MCP });
		jwtService.verifyAsync.mockResolvedValue({ sub: 'client-id', type: TokenOwnerType.MCP });

		await expect(guard.canActivate(context(request('valid-token')))).resolves.toBe(true);
		expect(increment).toHaveBeenCalledWith(
			'mcp-client:client-id',
			MCP_RATE_LIMIT_TTL_MS,
			MCP_AUTHENTICATED_RATE_LIMIT,
			MCP_RATE_LIMIT_TTL_MS,
			'mcp',
		);
	});

	it.each([
		['missing token', undefined],
		['non-MCP token', 'ordinary-token'],
		['malformed token', 'malformed-token'],
		['invalid MCP token', 'invalid-token'],
	])('uses the stricter IP budget for a %s', async (_label, token) => {
		if (token === 'ordinary-token') {
			jwtService.decode.mockReturnValue({ sub: 'user-id', type: TokenOwnerType.USER });
		}
		if (token === 'invalid-token') {
			jwtService.decode.mockReturnValue({ sub: 'client-id', type: TokenOwnerType.MCP });
			jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));
		}
		if (token === 'malformed-token') {
			jwtService.decode.mockImplementation(() => {
				throw new Error('malformed');
			});
		}

		await expect(guard.canActivate(context(request(token)))).resolves.toBe(true);
		expect(increment).toHaveBeenCalledWith(
			'mcp-ip:192.0.2.10',
			MCP_RATE_LIMIT_TTL_MS,
			MCP_UNAUTHENTICATED_RATE_LIMIT,
			MCP_RATE_LIMIT_TTL_MS,
			'mcp',
		);
	});

	it('rejects a blocked identity', async () => {
		increment.mockResolvedValue({
			totalHits: MCP_UNAUTHENTICATED_RATE_LIMIT + 1,
			timeToExpire: MCP_RATE_LIMIT_TTL_MS,
			isBlocked: true,
			timeToBlockExpire: MCP_RATE_LIMIT_TTL_MS,
		});

		await expect(guard.canActivate(context(request()))).rejects.toThrow(ThrottlerException);
	});

	function request(token?: string): FastifyRequest {
		return {
			headers: token ? { authorization: `Bearer ${token}` } : {},
			ip: '192.0.2.10',
		} as FastifyRequest;
	}

	function context(req: FastifyRequest): ExecutionContext {
		return {
			getType: () => 'http',
			getHandler: () => function handler() {},
			getClass: () => class Controller {},
			switchToHttp: () => ({ getRequest: () => req }),
		} as unknown as ExecutionContext;
	}
});
