import { v4 as uuid } from 'uuid';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ConfigService } from '../../config/services/config.service';
import { McpOAuthClientEntity } from '../entities/mcp-oauth.entity';
import { McpCapability, McpOAuthScope } from '../mcp.constants';

import { McpOAuthClientService } from './mcp-oauth-client.service';

describe('McpOAuthClientService', () => {
	const createdById = uuid();
	const entity = Object.assign(new McpOAuthClientEntity(), {
		id: uuid(),
		clientIdentifier: uuid(),
		name: 'Codex',
		redirectUris: ['http://127.0.0.1:1455/callback'],
		maximumScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
		enabled: true,
		generation: 0,
		createdById,
		createdAt: new Date(),
		updatedAt: null,
	});
	const repository = {
		create: jest.fn(
			(value: Partial<McpOAuthClientEntity>): McpOAuthClientEntity => Object.assign(new McpOAuthClientEntity(), value),
		),
		save: jest.fn(
			(value: McpOAuthClientEntity): Promise<McpOAuthClientEntity> =>
				Promise.resolve(Object.assign(value, { id: value.id ?? uuid(), createdAt: value.createdAt ?? new Date() })),
		),
		find: jest.fn(),
		findOneBy: jest.fn(),
	};
	const configService = {
		getModuleConfig: jest.fn(() => ({ capabilities: [McpCapability.READ, McpCapability.WRITE] })),
	};
	let service: McpOAuthClientService;

	beforeEach(async () => {
		jest.clearAllMocks();
		const moduleRef = await Test.createTestingModule({
			providers: [
				McpOAuthClientService,
				{ provide: getRepositoryToken(McpOAuthClientEntity), useValue: repository },
				{ provide: ConfigService, useValue: configService },
			],
		}).compile();

		service = moduleRef.get(McpOAuthClientService);
	});

	it('creates a public client identifier without any client secret', async () => {
		const client = await service.create(
			{
				name: 'Codex',
				redirectUris: ['http://127.0.0.1:1455/callback'],
				maximumScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
			},
			createdById,
		);

		expect(client.clientIdentifier).toEqual(expect.any(String));
		expect(repository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				createdById,
				enabled: true,
				generation: 0,
			}),
		);
		expect(repository.create.mock.calls[0][0]).not.toHaveProperty('clientSecret');
	});

	it('rejects capability scopes above the current module ceiling', async () => {
		await expect(
			service.create(
				{
					name: 'Claude',
					redirectUris: ['https://client.example/callback'],
					maximumScopes: [McpOAuthScope.TRIGGER],
				},
				createdById,
			),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('uses RFC 8252 matching for a registered loopback IP URI', () => {
		expect(service.isRedirectUriAllowed(entity, 'http://127.0.0.1:49152/callback')).toBe(true);
		expect(service.isRedirectUriAllowed(entity, 'http://127.0.0.1:49152/other')).toBe(false);
	});

	it('advances the client generation when authorization inputs change', async () => {
		repository.findOneBy.mockResolvedValue({ ...entity });

		const updated = await service.update(entity.id, { enabled: false });

		expect(updated.enabled).toBe(false);
		expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ generation: 1 }));
	});

	it('rejects unknown client records', async () => {
		repository.findOneBy.mockResolvedValue(null);

		await expect(service.update(uuid(), { enabled: false })).rejects.toBeInstanceOf(NotFoundException);
	});
});
