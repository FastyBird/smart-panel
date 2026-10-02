import { Socket } from 'socket.io';

import { JwtService } from '@nestjs/jwt';

import { TokenOwnerType } from '../../auth/auth.constants';
import { AuthenticationAccessToken } from '../../auth/services/token-metadata.service';
import { TokensService } from '../../auth/services/tokens.service';
import { hashToken } from '../../auth/utils/token.utils';
import { MCP_OAUTH_PRINCIPAL_TYPE } from '../../mcp/mcp.constants';
import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { WebsocketNotAllowedException } from '../websocket.exceptions';

import { WsAuthService } from './ws-auth.service';

describe('WsAuthService', () => {
	it('rejects MCP credentials before generic long-lived-token validation', async () => {
		const jwtService = {
			verifyAsync: jest.fn().mockResolvedValue({ sub: 'mcp-client', type: TokenOwnerType.MCP }),
		};
		const tokensService = {
			findAll: jest.fn(),
		};
		const service = new WsAuthService(
			jwtService as unknown as JwtService,
			tokensService as unknown as TokensService,
			{} as UsersService,
		);
		const client = {
			handshake: { auth: { token: 'mcp-token' } },
			data: {},
		} as unknown as Socket;

		await expect(service.validateClient(client)).rejects.toBeInstanceOf(WebsocketNotAllowedException);
		expect(tokensService.findAll).not.toHaveBeenCalled();
	});

	it('rejects OAuth MCP credentials before generic long-lived-token validation', async () => {
		const jwtService = {
			verifyAsync: jest.fn().mockResolvedValue({ sub: 'oauth-access-token', type: MCP_OAUTH_PRINCIPAL_TYPE }),
		};
		const tokensService = {
			findAll: jest.fn(),
		};
		const service = new WsAuthService(
			jwtService as unknown as JwtService,
			tokensService as unknown as TokensService,
			{} as UsersService,
		);
		const client = {
			handshake: { auth: { token: 'oauth-token' } },
			data: {},
		} as unknown as Socket;

		await expect(service.validateClient(client)).rejects.toBeInstanceOf(WebsocketNotAllowedException);
		expect(tokensService.findAll).not.toHaveBeenCalled();
	});
});

describe('WebSocket user access credentials', () => {
	const userId = 'test-user';
	const token = 'presented-credential';
	let tokens: { findAuthenticationAccessToken: jest.Mock; findAllByOwner: jest.Mock };
	let users: { getOneOrThrow: jest.Mock };
	let jwt: { verifyAsync: jest.Mock };
	let service: WsAuthService;
	let client: Socket;
	let access: AuthenticationAccessToken;

	beforeEach(() => {
		access = {
			id: 'access',
			revoked: false,
			expiresAt: null,
			refreshRevoked: false,
			owner: { id: userId, role: UserRole.USER },
		};
		tokens = { findAuthenticationAccessToken: jest.fn().mockResolvedValue(access), findAllByOwner: jest.fn() };
		users = { getOneOrThrow: jest.fn().mockResolvedValue({ id: userId, role: UserRole.USER }) };
		jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: userId }) };
		service = new WsAuthService(
			jwt as unknown as JwtService,
			tokens as unknown as TokensService,
			users as unknown as UsersService,
		);
		client = { handshake: { auth: { token } }, data: {} } as unknown as Socket;
	});

	it('authenticates the presented owner/hash without listing owner credentials', async () => {
		await expect(service.validateClient(client)).resolves.toBe(true);
		expect(tokens.findAuthenticationAccessToken).toHaveBeenCalledWith(userId, hashToken(token));
		expect(tokens.findAllByOwner).not.toHaveBeenCalled();
		expect(client.data).toEqual({ user: { id: userId, role: UserRole.USER, type: 'user' } });
	});

	it.each(['missing', 'access revoked', 'refresh revoked', 'missing user'])('rejects %s', async (condition) => {
		if (condition === 'missing') tokens.findAuthenticationAccessToken.mockResolvedValue(null);
		if (condition === 'access revoked') access.revoked = true;
		if (condition === 'refresh revoked') access.refreshRevoked = true;
		if (condition === 'missing user') access.owner = null;
		await expect(service.validateClient(client)).rejects.toBeInstanceOf(WebsocketNotAllowedException);
		expect(client.data).toEqual({});
	});

	it('rejects an expired or invalid JWT before accessing stored credentials', async () => {
		jwt.verifyAsync.mockRejectedValue(new Error('JWT expired'));
		await expect(service.validateClient(client)).rejects.toBeInstanceOf(WebsocketNotAllowedException);
		expect(tokens.findAuthenticationAccessToken).not.toHaveBeenCalled();
	});
});
