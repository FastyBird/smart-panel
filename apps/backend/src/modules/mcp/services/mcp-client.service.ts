import { randomUUID } from 'crypto';
import { DataSource, IsNull, Repository } from 'typeorm';

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';

import { TokenOwnerType } from '../../auth/auth.constants';
import { LongLiveTokenEntity } from '../../auth/entities/auth.entity';
import { TokensService } from '../../auth/services/tokens.service';
import { ConfigService } from '../../config/services/config.service';
import { CreateMcpClientDto, RotateMcpClientTokenDto, UpdateMcpClientDto } from '../dto/mcp-client.dto';
import { McpClientEntity } from '../entities/mcp-client.entity';
import { MCP_MODULE_NAME, McpCapability } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';
import { McpClientCredentialModel } from '../models/mcp-client.model';

import { McpInstallationService } from './mcp-installation.service';
import { McpServerService } from './mcp-server.service';

const SECONDS_PER_DAY = 24 * 60 * 60;

@Injectable()
export class McpClientService {
	constructor(
		@InjectRepository(McpClientEntity)
		private readonly repository: Repository<McpClientEntity>,
		private readonly dataSource: DataSource,
		private readonly tokensService: TokensService,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		private readonly installationService: McpInstallationService,
		private readonly serverService: McpServerService,
	) {}

	async findAll(): Promise<McpClientEntity[]> {
		return this.repository.find({ relations: { token: true }, order: { createdAt: 'DESC' } });
	}

	async findOne(id: string): Promise<McpClientEntity | null> {
		return this.repository.findOne({ where: { id }, relations: { token: true } });
	}

	async getOneOrThrow(id: string): Promise<McpClientEntity> {
		const client = await this.findOne(id);

		if (!client) {
			throw new NotFoundException('Requested MCP client does not exist');
		}

		return client;
	}

	async findActiveByToken(tokenId: string, clientId: string): Promise<McpClientEntity | null> {
		return this.repository.findOne({
			where: { id: clientId, tokenId, enabled: true },
			relations: { token: true },
		});
	}

	getEffectiveCapabilities(client: McpClientEntity): McpCapability[] {
		const ceiling = this.getCapabilityCeiling();

		return client.capabilities.filter((capability) => ceiling.includes(capability));
	}

	async create(dto: CreateMcpClientDto, createdById: string): Promise<McpClientCredentialModel> {
		this.assertCapabilitiesAllowed(dto.capabilities);

		const client = await this.repository.save(
			this.repository.create({
				name: dto.name,
				description: dto.description ?? null,
				enabled: true,
				capabilities: [...dto.capabilities],
				createdById,
				tokenId: null,
			}),
		);

		try {
			return await this.issueCredential(client, dto.expiresInDays);
		} catch (error) {
			await this.repository.delete({ id: client.id, tokenId: IsNull() });
			throw error;
		}
	}

	async update(id: string, dto: UpdateMcpClientDto): Promise<McpClientEntity> {
		const client = await this.getOneOrThrow(id);
		const updates: {
			name?: string;
			description?: string | null;
			enabled?: boolean;
			capabilities?: McpCapability[];
		} = {};

		if (dto.capabilities !== undefined) {
			this.assertCapabilitiesAllowed(dto.capabilities);
			updates.capabilities = [...dto.capabilities];
		}
		if (dto.name !== undefined) updates.name = dto.name;
		if (dto.description !== undefined) updates.description = dto.description;
		if (dto.enabled !== undefined) updates.enabled = dto.enabled;

		if (Object.keys(updates).length > 0) {
			await this.dataSource.transaction(async (manager) => {
				if (dto.enabled === true) {
					const token = client.tokenId
						? await manager.getRepository(LongLiveTokenEntity).findOne({ where: { id: client.tokenId } })
						: null;

					if (!token || token.revoked || (token.expiresAt && token.expiresAt < new Date())) {
						throw new ConflictException('Rotate the MCP client credential before enabling this client');
					}
				}

				const updateResult = await manager
					.getRepository(McpClientEntity)
					.update({ id, tokenId: client.tokenId ?? IsNull() }, updates);

				if (!updateResult.affected) {
					throw new ConflictException('The MCP client credential was changed by another request');
				}
			});
		}

		const updatedClient = await this.getOneOrThrow(id);

		if (dto.enabled === false) {
			await this.serverService.closeClient(id);
		} else if (dto.capabilities !== undefined) {
			this.serverService.invalidatePolicies();
			this.serverService.notifyToolsChanged(id);
			this.serverService.notifyResourcesChanged(id);
		}

		return updatedClient;
	}

	async rotate(id: string, dto: RotateMcpClientTokenDto): Promise<McpClientCredentialModel> {
		const client = await this.getOneOrThrow(id);

		const credential = await this.issueCredential(client, dto.expiresInDays, client.token ?? undefined);
		await this.serverService.closeClient(id);

		return credential;
	}

	async revoke(id: string): Promise<McpClientEntity> {
		const client = await this.getOneOrThrow(id);

		await this.dataSource.transaction(async (manager) => {
			if (client.token) {
				await this.tokensService.revoke(client.token.id, manager);
			}

			const updateResult = await manager.getRepository(McpClientEntity).update(
				{
					id: client.id,
					tokenId: client.token ? client.token.id : IsNull(),
				},
				{ enabled: false },
			);

			if (!updateResult.affected) {
				throw new ConflictException('The MCP client credential was changed by another request');
			}
		});

		await this.serverService.closeClient(id);

		return this.getOneOrThrow(id);
	}

	async remove(id: string): Promise<void> {
		const client = await this.getOneOrThrow(id);

		await this.dataSource.transaction(async (manager) => {
			if (client.token) {
				await this.tokensService.revoke(client.token.id, manager);
			}

			const deleteResult = await manager.getRepository(McpClientEntity).delete({
				id: client.id,
				tokenId: client.token ? client.token.id : IsNull(),
			});

			if (!deleteResult.affected) {
				throw new ConflictException('The MCP client credential was changed by another request');
			}
		});

		await this.serverService.closeClient(id);
	}

	private async issueCredential(
		client: McpClientEntity,
		expiresInDays: number,
		previousToken?: LongLiveTokenEntity,
	): Promise<McpClientCredentialModel> {
		const issuedAt = Math.floor(Date.now() / 1000);
		const expiresIn = expiresInDays * SECONDS_PER_DAY;
		const rawToken = await this.jwtService.signAsync(
			{
				sub: client.id,
				type: TokenOwnerType.MCP,
				iat: issuedAt,
				jti: randomUUID(),
			},
			{
				audience: await this.installationService.getAudience(),
				expiresIn,
			},
		);

		const issuedClient = await this.dataSource.transaction(async (manager) => {
			const token = await this.tokensService.createLongLiveToken(
				{
					token: rawToken,
					ownerType: TokenOwnerType.MCP,
					ownerId: client.id,
					name: client.name,
					description: client.description,
					expiresAt: new Date((issuedAt + expiresIn) * 1000),
				},
				manager,
			);

			if (previousToken) {
				await this.tokensService.revoke(previousToken.id, manager);
			}

			const clientRepository = manager.getRepository(McpClientEntity);
			const updateResult = await clientRepository.update(
				{
					id: client.id,
					tokenId: previousToken ? previousToken.id : IsNull(),
					enabled: client.enabled,
				},
				{ tokenId: token.id, enabled: true },
			);

			if (!updateResult.affected) {
				throw new ConflictException('The MCP client credential was changed by another request');
			}

			const updatedClient = await clientRepository.findOne({
				where: { id: client.id },
				relations: { token: true },
			});

			if (!updatedClient) {
				throw new NotFoundException('Requested MCP client does not exist');
			}

			return updatedClient;
		});

		const credential = new McpClientCredentialModel();
		credential.client = issuedClient;
		credential.token = rawToken;

		return credential;
	}

	private assertCapabilitiesAllowed(capabilities: McpCapability[]): void {
		const ceiling = this.getCapabilityCeiling();
		const disallowed = capabilities.filter((capability) => !ceiling.includes(capability));

		if (disallowed.length > 0) {
			throw new BadRequestException(`Capabilities exceed the module ceiling: ${disallowed.join(', ')}`);
		}
	}

	private getCapabilityCeiling(): McpCapability[] {
		return this.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME).capabilities;
	}
}
