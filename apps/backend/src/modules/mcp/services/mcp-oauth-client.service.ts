import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ConfigService } from '../../config/services/config.service';
import { CreateMcpOAuthClientDto, UpdateMcpOAuthClientDto } from '../dto/mcp-oauth-client.dto';
import { McpOAuthClientEntity } from '../entities/mcp-oauth.entity';
import { MCP_MODULE_NAME, McpOAuthScope } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';
import { McpOAuthClientModel } from '../models/mcp-oauth-client.model';
import { toMcpCapability } from '../oauth/mcp-oauth-scope.utils';
import { matchesMcpOAuthRedirectUri } from '../validators/is-mcp-oauth-redirect-uri.validator';

@Injectable()
export class McpOAuthClientService {
	constructor(
		@InjectRepository(McpOAuthClientEntity)
		private readonly repository: Repository<McpOAuthClientEntity>,
		private readonly configService: ConfigService,
	) {}

	async findAll(): Promise<McpOAuthClientModel[]> {
		const clients = await this.repository.find({ order: { createdAt: 'DESC' } });

		return clients.map((client) => McpOAuthClientModel.fromEntity(client));
	}

	async findOneById(id: string): Promise<McpOAuthClientEntity | null> {
		return this.repository.findOneBy({ id });
	}

	async findActiveByIdentifier(clientIdentifier: string): Promise<McpOAuthClientEntity | null> {
		return this.repository.findOneBy({ clientIdentifier, enabled: true });
	}

	async getOneOrThrow(id: string): Promise<McpOAuthClientEntity> {
		const client = await this.findOneById(id);

		if (!client) {
			throw new NotFoundException('Requested MCP OAuth client does not exist');
		}

		return client;
	}

	async create(dto: CreateMcpOAuthClientDto, createdById: string): Promise<McpOAuthClientModel> {
		this.assertScopesAllowed(dto.maximumScopes);

		const client = await this.repository.save(
			this.repository.create({
				clientIdentifier: randomUUID(),
				name: dto.name,
				redirectUris: [...dto.redirectUris],
				maximumScopes: [...dto.maximumScopes],
				enabled: true,
				generation: 0,
				createdById,
			}),
		);

		return McpOAuthClientModel.fromEntity(client);
	}

	async update(id: string, dto: UpdateMcpOAuthClientDto): Promise<McpOAuthClientModel> {
		const client = await this.getOneOrThrow(id);

		if (dto.maximumScopes !== undefined) {
			this.assertScopesAllowed(dto.maximumScopes);
		}

		const authorizationChanged =
			(dto.redirectUris !== undefined && !this.sameValues(client.redirectUris, dto.redirectUris)) ||
			(dto.maximumScopes !== undefined && !this.sameValues(client.maximumScopes, dto.maximumScopes)) ||
			(dto.enabled !== undefined && client.enabled !== dto.enabled);

		if (dto.name !== undefined) client.name = dto.name;
		if (dto.redirectUris !== undefined) client.redirectUris = [...dto.redirectUris];
		if (dto.maximumScopes !== undefined) client.maximumScopes = [...dto.maximumScopes];
		if (dto.enabled !== undefined) client.enabled = dto.enabled;
		if (authorizationChanged) client.generation += 1;

		return McpOAuthClientModel.fromEntity(await this.repository.save(client));
	}

	isRedirectUriAllowed(client: McpOAuthClientEntity, requested: string): boolean {
		return client.redirectUris.some((registered) => matchesMcpOAuthRedirectUri(registered, requested));
	}

	assertScopesAllowed(scopes: McpOAuthScope[]): void {
		const ceiling = this.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME).capabilities;
		const disallowed = scopes.filter((scope) => {
			if (scope === McpOAuthScope.OFFLINE_ACCESS) return false;

			const capability = toMcpCapability(scope);

			return capability === undefined || !ceiling.includes(capability);
		});

		if (disallowed.length > 0) {
			throw new BadRequestException(`OAuth scopes exceed the module ceiling: ${disallowed.join(', ')}`);
		}
	}

	private sameValues(left: McpOAuthScope[] | string[], right: McpOAuthScope[] | string[]): boolean {
		return left.length === right.length && left.every((value) => right.includes(value as never));
	}
}
