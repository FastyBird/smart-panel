import { DataSource, EntityManager, Repository } from 'typeorm';
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
		update: jest.Mock;
	};
	let tokenRepository: { findOne: jest.Mock };
	let tokensService: { createLongLiveToken: jest.Mock; revoke: jest.Mock };
	let dataSource: { transaction: jest.Mock };
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
			update: jest.fn().mockImplementation((_criteria: unknown, update: Partial<McpClientEntity>) => {
				if (currentClient) Object.assign(currentClient, update);
				return Promise.resolve({ affected: 1 });
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
		tokenRepository = {
			findOne: jest.fn().mockImplementation(() => Promise.resolve(currentClient?.token ?? null)),
		};
		dataSource = {
			transaction: jest.fn().mockImplementation((operation: (manager: EntityManager) => Promise<unknown>) => {
				const manager = {
					getRepository: jest
						.fn()
						.mockImplementation((entity: unknown) => (entity === McpClientEntity ? repository : tokenRepository)),
				} as unknown as EntityManager;

				return operation(manager);
			}),
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
			dataSource as unknown as DataSource,
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
			expect.objectContaining({
				sub: result.client.id,
				type: TokenOwnerType.MCP,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				jti: expect.any(String),
			}),
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
			expect.anything(),
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

	it('updates only requested metadata without persisting a stale token pointer', async () => {
		const tokenId = uuid();
		currentClient = {
			id: uuid(),
			name: 'Agent',
			description: null,
			enabled: true,
			capabilities: [McpCapability.READ],
			tokenId,
		} as McpClientEntity;

		await service.update(currentClient.id, { name: 'Renamed agent', enabled: false });

		expect(repository.update).toHaveBeenCalledWith(
			{ id: currentClient.id, tokenId },
			{
				name: 'Renamed agent',
				enabled: false,
			},
		);
		expect(repository.save).not.toHaveBeenCalled();
		expect(currentClient.tokenId).toBe(tokenId);
	});

	it('rejects enabling a client whose current credential is revoked', async () => {
		const token = {
			id: uuid(),
			revoked: true,
			expiresAt: new Date(Date.now() + 60_000),
		} as LongLiveTokenEntity;
		currentClient = {
			id: uuid(),
			name: 'Agent',
			description: null,
			enabled: false,
			capabilities: [McpCapability.READ],
			tokenId: token.id,
			token,
		} as McpClientEntity;

		await expect(service.update(currentClient.id, { enabled: true })).rejects.toThrow(
			'Rotate the MCP client credential before enabling this client',
		);

		expect(repository.update).not.toHaveBeenCalled();
	});

	it('atomically creates a replacement before revoking the previous credential', async () => {
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
		expect(tokensService.revoke).toHaveBeenCalledWith(previousToken.id, expect.anything());
		expect(result.token).toBe('raw-mcp-token');
	});

	it('leaves the previous credential selected when revocation fails', async () => {
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
		tokensService.revoke.mockRejectedValue(new Error('Database unavailable'));

		await expect(service.rotate(currentClient.id, { expiresInDays: 60 })).rejects.toThrow('Database unavailable');

		expect(currentClient.tokenId).toBe(previousToken.id);
		expect(repository.update).not.toHaveBeenCalled();
	});

	it('rejects a stale concurrent rotation instead of returning an unselected credential', async () => {
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
		repository.update.mockResolvedValueOnce({ affected: 0 });

		await expect(service.rotate(currentClient.id, { expiresInDays: 60 })).rejects.toThrow(
			'The MCP client credential was changed by another request',
		);

		expect(currentClient.tokenId).toBe(previousToken.id);
		expect(repository.update).toHaveBeenCalledWith(
			expect.objectContaining({ id: currentClient.id, tokenId: previousToken.id, enabled: true }),
			expect.objectContaining({ enabled: true }),
		);
	});

	it('adds unique entropy to credentials issued within the same second', async () => {
		jwtService.signAsync.mockImplementation((payload: { jti: string }) => Promise.resolve(`token-${payload.jti}`));
		const first = await service.create(
			{
				name: 'Agent',
				capabilities: [McpCapability.READ],
				expiresInDays: 30,
			},
			uuid(),
		);
		const second = await service.rotate(first.client.id, { expiresInDays: 30 });
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const firstPayload = jwtService.signAsync.mock.calls[0][0] as { jti: string };
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const secondPayload = jwtService.signAsync.mock.calls[1][0] as { jti: string };

		expect(firstPayload.jti).not.toBe(secondPayload.jti);
		expect(first.token).not.toBe(second.token);
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
		expect(tokensService.revoke).toHaveBeenCalledWith(token.id, expect.anything());
		expect(repository.save).not.toHaveBeenCalled();
	});

	it('rejects a stale revocation when rotation already changed the token pointer', async () => {
		const previousToken = { id: uuid(), revoked: false } as LongLiveTokenEntity;
		currentClient = {
			id: uuid(),
			enabled: true,
			token: previousToken,
			tokenId: previousToken.id,
		} as McpClientEntity;
		repository.update.mockResolvedValueOnce({ affected: 0 });

		await expect(service.revoke(currentClient.id)).rejects.toThrow(
			'The MCP client credential was changed by another request',
		);

		expect(currentClient.tokenId).toBe(previousToken.id);
		expect(repository.update).toHaveBeenCalledWith(
			expect.objectContaining({ id: currentClient.id, tokenId: previousToken.id }),
			{ enabled: false },
		);
	});
});
