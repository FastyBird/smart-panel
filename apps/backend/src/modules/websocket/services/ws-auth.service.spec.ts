import { Socket } from 'socket.io';

import { JwtService } from '@nestjs/jwt';

import { TokenOwnerType } from '../../auth/auth.constants';
import { TokensService } from '../../auth/services/tokens.service';
import { MCP_OAUTH_PRINCIPAL_TYPE } from '../../mcp/mcp.constants';
import { UsersService } from '../../users/services/users.service';
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
