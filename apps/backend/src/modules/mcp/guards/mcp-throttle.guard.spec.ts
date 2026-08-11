import { FastifyRequest } from 'fastify';

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';

import { TokenOwnerType } from '../../auth/auth.constants';
import { MCP_AUTHENTICATED_RATE_LIMIT, MCP_RATE_LIMIT_TTL_MS, MCP_UNAUTHENTICATED_RATE_LIMIT } from '../mcp.constants';
import { McpInstallationService } from '../services/mcp-installation.service';
import { McpOAuthResourceServerService } from '../services/mcp-oauth-resource-server.service';
import { McpOAuthRouteGateService } from '../services/mcp-oauth-route-gate.service';

import { McpThrottleGuard } from './mcp-throttle.guard';

describe('McpThrottleGuard', () => {
	let isMcpEndpoint: boolean;
	let jwtService: jest.Mocked<Pick<JwtService, 'decode' | 'verifyAsync'>>;
	let storage: jest.Mocked<ThrottlerStorage>;
	let increment: jest.MockedFunction<ThrottlerStorage['increment']>;
	let oauthRouteGate: { isOpen: boolean };
	let oauthResourceServer: { verifyMcpBearerToken: jest.Mock };
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
		oauthRouteGate = { isOpen: false };
		oauthResourceServer = { verifyMcpBearerToken: jest.fn() };
		guard = new McpThrottleGuard(
			{ getAllAndOverride: jest.fn(() => isMcpEndpoint) } as unknown as Reflector,
			jwtService as unknown as JwtService,
			{ getAudience: jest.fn().mockResolvedValue('audience') } as unknown as McpInstallationService,
			storage,
			oauthRouteGate as McpOAuthRouteGateService,
			oauthResourceServer as unknown as McpOAuthResourceServerService,
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

	it('uses the isolated verified OAuth client identity for the authenticated budget only while the gate is open', async () => {
		oauthRouteGate.isOpen = true;
		jwtService.decode.mockReturnValue(null);
		oauthResourceServer.verifyMcpBearerToken.mockResolvedValue({ clientId: 'oauth-public-client' });

		await expect(guard.canActivate(context(request('opaque-token')))).resolves.toBe(true);
		expect(oauthResourceServer.verifyMcpBearerToken).toHaveBeenCalledWith('Bearer opaque-token', ['read']);
		expect(increment).toHaveBeenCalledWith(
			'mcp-client:oauth:oauth-public-client',
			MCP_RATE_LIMIT_TTL_MS,
			MCP_AUTHENTICATED_RATE_LIMIT,
			MCP_RATE_LIMIT_TTL_MS,
			'mcp',
		);
	});

	it('keeps static and OAuth verification caches isolated', async () => {
		oauthRouteGate.isOpen = true;
		jwtService.decode.mockReturnValue({ sub: 'static-client', type: TokenOwnerType.MCP });
		jwtService.verifyAsync.mockRejectedValue(new Error('not a valid static credential'));
		oauthResourceServer.verifyMcpBearerToken.mockResolvedValue({ clientId: 'oauth-public-client' });

		await expect(guard.canActivate(context(request('oauth-token-with-jwt-shape')))).resolves.toBe(true);

		expect(oauthResourceServer.verifyMcpBearerToken).toHaveBeenCalledTimes(1);
		expect(increment).toHaveBeenCalledWith(
			'mcp-client:oauth:oauth-public-client',
			MCP_RATE_LIMIT_TTL_MS,
			MCP_AUTHENTICATED_RATE_LIMIT,
			MCP_RATE_LIMIT_TTL_MS,
			'mcp',
		);
	});

	it('caches rejected OAuth tokens before charging the unauthenticated request budget', async () => {
		oauthRouteGate.isOpen = true;
		jwtService.decode.mockReturnValue(null);
		oauthResourceServer.verifyMcpBearerToken.mockRejectedValue(new Error('invalid'));

		await expect(guard.canActivate(context(request('rejected-oauth-token')))).resolves.toBe(true);
		await expect(guard.canActivate(context(request('rejected-oauth-token')))).resolves.toBe(true);

		expect(oauthResourceServer.verifyMcpBearerToken).toHaveBeenCalledTimes(1);
		expect(increment).toHaveBeenCalledTimes(2);
	});

	it('bounds verification work for rotating opaque OAuth tokens', async () => {
		oauthRouteGate.isOpen = true;
		jwtService.decode.mockReturnValue(null);
		oauthResourceServer.verifyMcpBearerToken.mockRejectedValue(new Error('invalid'));
		const now = Date.now();
		const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

		try {
			for (let index = 0; index <= 200; index += 1) {
				await expect(guard.canActivate(context(request(`rotating-oauth-token-${index}`)))).resolves.toBe(true);
			}
		} finally {
			nowSpy.mockRestore();
		}

		expect(oauthResourceServer.verifyMcpBearerToken).toHaveBeenCalledTimes(200);
		expect(increment).toHaveBeenCalledTimes(201);
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
