import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { TokenOwnerType } from '../../auth/auth.constants';
import { LongLiveTokenEntity } from '../../auth/entities/auth.entity';
import { TokensService } from '../../auth/services/tokens.service';
import { ConfigService } from '../../config/services/config.service';
import { McpClientEntity } from '../entities/mcp-client.entity';
import { McpCapability } from '../mcp.constants';

import { McpClientService } from './mcp-client.service';
import { McpInstallationService } from './mcp-installation.service';

describe('McpClientService', () => {
	let service: McpClientService;
	let repository: {
		create: jest.Mock;
		find: jest.Mock;
		findOne: jest.Mock;
		remove: jest.Mock;
		save: jest.Mock;
	};
	let tokensService: { createLongLiveToken: jest.Mock; revoke: jest.Mock };
	let jwtService: { signAsync: jest.Mock };
	let configService: { getModuleConfig: jest.Mock };
	let currentClient: McpClientEntity | null;

	beforeEach(() => {
		currentClient = null;
		repository = {
			create: jest.fn((value) => value as McpClientEntity),
			find: jest.fn().mockResolvedValue([]),
			findOne: jest.fn().mockImplementation(() => Promise.resolve(currentClient)),
			remove: jest.fn().mockResolvedValue(undefined),
			save: jest.fn().mockImplementation((client: McpClientEntity) => {
				if (!client.id) client.id = uuid();
				currentClient = client;
				return Promise.resolve(client);
			}),
		};
		tokensService = {
			createLongLiveToken: jest.fn().mockImplementation(() => {
				const token = { id: uuid(), revoked: false } as LongLiveTokenEntity;
				if (currentClient) currentClient.token = token;
				return Promise.resolve(token);
			}),
			revoke: jest.fn().mockResolvedValue(undefined),
		};
		jwtService = { signAsync: jest.fn().mockResolvedValue('raw-mcp-token') };
		configService = {
			getModuleConfig: jest.fn().mockReturnValue({
				capabilities: [McpCapability.READ, McpCapability.WRITE],
			}),
		};
		const installationService = { getAudience: jest.fn().mockResolvedValue('mcp-audience') };

		service = new McpClientService(
			repository as unknown as Repository<McpClientEntity>,
			tokensService as unknown as TokensService,
			jwtService as unknown as JwtService,
			configService as unknown as ConfigService,
			installationService as unknown as McpInstallationService,
		);
	});

	it('issues a finite, audience-bound credential and returns the raw value once', async () => {
		const result = await service.create(
			{
				name: 'Agent',
				description: null,
				capabilities: [McpCapability.READ],
				expiresInDays: 30,
			},
			uuid(),
		);

		expect(result.token).toBe('raw-mcp-token');
		expect(jwtService.signAsync).toHaveBeenCalledWith(
			expect.objectContaining({ sub: result.client.id, type: TokenOwnerType.MCP }),
			{ audience: 'mcp-audience', expiresIn: 30 * 24 * 60 * 60 },
		);
		expect(tokensService.createLongLiveToken).toHaveBeenCalledWith(
			expect.objectContaining({
				token: 'raw-mcp-token',
				ownerType: TokenOwnerType.MCP,
				ownerId: result.client.id,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				expiresAt: expect.any(Date),
			}),
		);
		expect(result.client).not.toHaveProperty('rawToken');
	});

	it('rejects capability grants above the installation ceiling', async () => {
		await expect(
			service.create(
				{
					name: 'Agent',
					capabilities: [McpCapability.TRIGGER],
					expiresInDays: 30,
				},
				uuid(),
			),
		).rejects.toBeInstanceOf(BadRequestException);
		expect(repository.save).not.toHaveBeenCalled();
	});

	it('intersects an existing grant with the current module ceiling', () => {
		const client = {
			capabilities: [McpCapability.READ, McpCapability.WRITE],
		} as McpClientEntity;
		configService.getModuleConfig.mockReturnValue({ capabilities: [McpCapability.READ] });

		expect(service.getEffectiveCapabilities(client)).toEqual([McpCapability.READ]);
	});

	it('creates a replacement before revoking the previous credential', async () => {
		const previousToken = { id: uuid(), revoked: false } as LongLiveTokenEntity;
		currentClient = {
			id: uuid(),
			name: 'Agent',
			description: null,
			enabled: true,
			capabilities: [McpCapability.READ],
			tokenId: previousToken.id,
			token: previousToken,
		} as McpClientEntity;
		const events: string[] = [];
		tokensService.createLongLiveToken.mockImplementation(() => {
			events.push('create');
			const token = { id: uuid(), revoked: false } as LongLiveTokenEntity;
			if (currentClient) currentClient.token = token;
			return Promise.resolve(token);
		});
		tokensService.revoke.mockImplementation(() => {
			events.push('revoke');
			return Promise.resolve();
		});

		const result = await service.rotate(currentClient.id, { expiresInDays: 60 });

		expect(events).toEqual(['create', 'revoke']);
		expect(tokensService.revoke).toHaveBeenCalledWith(previousToken.id);
		expect(result.token).toBe('raw-mcp-token');
	});

	it('disables a client and revokes its current credential', async () => {
		const token = { id: uuid(), revoked: false } as LongLiveTokenEntity;
		currentClient = {
			id: uuid(),
			enabled: true,
			token,
			tokenId: token.id,
		} as McpClientEntity;

		const result = await service.revoke(currentClient.id);

		expect(result.enabled).toBe(false);
		expect(tokensService.revoke).toHaveBeenCalledWith(token.id);
	});
});
