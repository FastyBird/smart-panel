import { JwtService } from '@nestjs/jwt';

import { UsersService } from '../../users/services/users.service';
import { UserRole } from '../../users/users.constants';
import { TokenOwnerType } from '../auth.constants';
import { LongLiveTokenEntity } from '../entities/auth.entity';
import { TokensTypeMapperService } from '../services/tokens-type-mapper.service';
import { TokensService } from '../services/tokens.service';

import { TokensController } from './tokens.controller';

describe('TokensController MCP isolation', () => {
	const userToken = Object.assign(new LongLiveTokenEntity(), {
		id: 'user-token',
		ownerType: TokenOwnerType.USER,
	});
	const mcpToken = Object.assign(new LongLiveTokenEntity(), {
		id: 'mcp-token',
		ownerType: TokenOwnerType.MCP,
	});
	const tokensService = {
		findAll: jest.fn(),
		findOne: jest.fn(),
	};
	const controller = new TokensController(
		tokensService as unknown as TokensService,
		{} as TokensTypeMapperService,
		{} as JwtService,
		{} as UsersService,
	);

	beforeEach(() => jest.clearAllMocks());

	it('omits MCP credentials from the administrator token list', async () => {
		tokensService.findAll.mockResolvedValue([userToken, mcpToken]);

		const response = await controller.findAll({
			auth: { type: 'user', id: 'admin', role: UserRole.ADMIN },
		} as never);

		expect(response.data).toEqual([userToken]);
	});

	it('does not expose an MCP credential through the generic token detail endpoint', async () => {
		tokensService.findOne.mockResolvedValue(mcpToken);

		await expect(controller.findOne(mcpToken.id)).rejects.toThrow('Requested token does not exist');
	});
});
