import { DataSource, In, IsNull, MoreThan, Not, Repository } from 'typeorm';

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { ConfigService } from '../../config/services/config.service';
import { UpdateMcpOAuthClientDto } from '../dto/mcp-oauth-client.dto';
import { UpdateMcpOAuthGrantDto } from '../dto/mcp-oauth-grant.dto';
import {
	McpOAuthClientEntity,
	McpOAuthGrantEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthProviderRevokedRefreshFamilyEntity,
} from '../entities/mcp-oauth.entity';
import { MCP_MODULE_NAME, McpOAuthScope } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';
import { McpOAuthClientModel } from '../models/mcp-oauth-client.model';
import {
	McpOAuthAccessTokenModel,
	McpOAuthGrantModel,
	McpOAuthRefreshFamilyModel,
} from '../models/mcp-oauth-management.model';

import { McpAuditService } from './mcp-audit.service';
import { McpOAuthClientService } from './mcp-oauth-client.service';
import { McpOAuthGlobalInvalidationService } from './mcp-oauth-global-invalidation.service';
import { McpSubscriptionRegistryService } from './mcp-subscription-registry.service';

interface ProviderArtifactPayload {
	scope?: unknown;
}

@Injectable()
export class McpOAuthManagementService {
	constructor(
		@InjectRepository(McpOAuthGrantEntity)
		private readonly grants: Repository<McpOAuthGrantEntity>,
		@InjectRepository(McpOAuthProviderArtifactEntity)
		private readonly artifacts: Repository<McpOAuthProviderArtifactEntity>,
		private readonly dataSource: DataSource,
		private readonly configService: ConfigService,
		private readonly clientsService: McpOAuthClientService,
		private readonly subscriptions: McpSubscriptionRegistryService,
		private readonly globalInvalidation: McpOAuthGlobalInvalidationService,
		private readonly auditService: McpAuditService,
	) {}

	async findGrants(): Promise<McpOAuthGrantModel[]> {
		const grants = await this.grants.find({
			relations: { approvedBy: true, client: true },
			order: { createdAt: 'DESC' },
		});
		const providerRevocations = await this.getProviderRevocations(grants);
		const moduleEnabled = this.isModuleEnabled();

		return grants.map((grant) =>
			McpOAuthGrantModel.fromEntity(
				grant,
				grant.providerGrantIdHash ? (providerRevocations.get(grant.providerGrantIdHash) ?? null) : null,
				moduleEnabled,
			),
		);
	}

	async getGrant(id: string): Promise<McpOAuthGrantModel> {
		const grant = await this.getGrantEntity(id);

		return this.mapGrant(grant);
	}

	async findAccessTokens(): Promise<McpOAuthAccessTokenModel[]> {
		const artifacts = await this.artifacts.find({
			where: { model: 'AccessToken', expiresAt: MoreThan(Date.now()) },
			order: { expiresAt: 'ASC' },
		});

		return this.mapAccessTokens(artifacts);
	}

	async getAccessToken(id: string): Promise<McpOAuthAccessTokenModel> {
		const artifact = await this.artifacts.findOneBy({
			model: 'AccessToken',
			managementId: id,
			expiresAt: MoreThan(Date.now()),
		});

		if (!artifact) throw new NotFoundException('Requested MCP OAuth access token does not exist');
		const [model] = await this.mapAccessTokens([artifact]);

		if (!model) throw new NotFoundException('Requested MCP OAuth access token is not linked to an active grant');

		return model;
	}

	async findRefreshFamilies(): Promise<McpOAuthRefreshFamilyModel[]> {
		const artifacts = await this.artifacts.find({
			where: {
				model: 'RefreshToken',
				refreshFamilyId: Not(IsNull()),
				expiresAt: MoreThan(Date.now()),
			},
			order: { expiresAt: 'ASC' },
		});

		return this.mapRefreshFamilies(artifacts);
	}

	async getRefreshFamily(id: string): Promise<McpOAuthRefreshFamilyModel> {
		const artifacts = await this.artifacts.find({
			where: {
				model: 'RefreshToken',
				refreshFamilyId: id,
				expiresAt: MoreThan(Date.now()),
			},
		});
		const [model] = await this.mapRefreshFamilies(artifacts);

		if (!model) throw new NotFoundException('Requested MCP OAuth refresh family does not exist');

		return model;
	}

	async updateClient(id: string, dto: UpdateMcpOAuthClientDto, actorId: string): Promise<McpOAuthClientModel> {
		if (dto.enabled === false) return this.disableClient(id, actorId, dto);

		const updatesAuthorization =
			dto.redirectUris !== undefined || dto.maximumScopes !== undefined || dto.enabled !== undefined;

		if (!updatesAuthorization) return this.clientsService.update(id, dto);

		let updated: McpOAuthClientModel | undefined;

		await this.subscriptions.closeOAuthClient(id, async () => {
			updated = await this.clientsService.update(id, dto);
		});

		if (!updated) throw new ConflictException('The MCP OAuth client changed during authorization update');

		return updated;
	}

	async disableClient(id: string, actorId: string, dto: UpdateMcpOAuthClientDto = {}): Promise<McpOAuthClientModel> {
		const client = await this.clientsService.getOneOrThrow(id);

		if (dto.maximumScopes !== undefined) {
			this.clientsService.assertScopesAllowed(dto.maximumScopes);
		}

		await this.subscriptions.closeOAuthClient(id, async () => {
			await this.dataSource.transaction(async (manager) => {
				const clientResult = await manager.getRepository(McpOAuthClientEntity).update(
					{ id: client.id, generation: client.generation },
					{
						...(dto.name !== undefined ? { name: dto.name } : {}),
						...(dto.redirectUris !== undefined ? { redirectUris: [...dto.redirectUris] } : {}),
						...(dto.maximumScopes !== undefined ? { maximumScopes: [...dto.maximumScopes] } : {}),
						enabled: false,
						generation: () => 'generation + 1',
					},
				);

				if (!clientResult.affected) {
					throw new ConflictException('The MCP OAuth client changed during disable');
				}

				const grantRepository = manager.getRepository(McpOAuthGrantEntity);
				const clientGrants = await grantRepository.findBy({ clientId: client.id });
				const activeGrants = clientGrants.filter((grant) => grant.revokedAt === null);
				const grantHashes = activeGrants
					.map((grant) => grant.providerGrantIdHash)
					.filter((hash): hash is string => hash !== null);
				const revokedAt = new Date();

				if (activeGrants.length > 0) {
					await grantRepository.update(
						{ id: In(activeGrants.map((grant) => grant.id)), revokedAt: IsNull() },
						{ revokedAt, generation: () => 'generation + 1' },
					);
				}
				if (grantHashes.length > 0) {
					await manager.getRepository(McpOAuthProviderRevokedGrantEntity).upsert(
						grantHashes.map((grantIdHash) => ({ grantIdHash, revokedAt: revokedAt.getTime() })),
						['grantIdHash'],
					);
					await manager.getRepository(McpOAuthProviderArtifactEntity).delete({ grantIdHash: In(grantHashes) });
				}
			});
		});

		this.auditService.recordOAuthManagementAction(actorId, 'client', id, 'disabled');

		return McpOAuthClientModel.fromEntity(await this.clientsService.getOneOrThrow(id));
	}

	async updateGrant(id: string, dto: UpdateMcpOAuthGrantDto, actorId: string): Promise<McpOAuthGrantModel> {
		let current: McpOAuthGrantModel | null = null;
		let changed = false;

		await this.subscriptions.closeOAuthGrantScopeContractions(id, dto.approvedScopes, async () => {
			const grant = await this.getGrantEntity(id);
			const liveGrant = await this.mapGrant(grant);
			current = liveGrant;

			if (!liveGrant.active) throw new ConflictException('Only an active MCP OAuth grant can be updated');

			const addedScopes = dto.approvedScopes.filter((scope) => !liveGrant.approvedScopes.includes(scope));

			if (addedScopes.length > 0) {
				throw new BadRequestException(`Approved grant scopes can only be reduced: ${addedScopes.join(', ')}`);
			}

			if (
				liveGrant.approvedScopes.includes(McpOAuthScope.OFFLINE_ACCESS) !==
				dto.approvedScopes.includes(McpOAuthScope.OFFLINE_ACCESS)
			) {
				throw new BadRequestException('offline_access can only be removed by revoking the MCP OAuth grant');
			}

			if (this.sameScopes(liveGrant.approvedScopes, dto.approvedScopes)) return;

			const result = await this.grants.update(
				{ id, generation: grant.generation, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
				{ approvedScopes: [...dto.approvedScopes], generation: () => 'generation + 1' },
			);

			if (!result.affected) throw new ConflictException('The MCP OAuth grant changed during scope update');
			changed = true;
		});

		if (!current) throw new ConflictException('The MCP OAuth grant could not be updated');
		if (!changed) return current;

		this.auditService.recordOAuthManagementAction(actorId, 'grant', id, 'scopes_updated');

		return this.getGrant(id);
	}

	async revokeGrant(id: string, actorId: string): Promise<McpOAuthGrantModel> {
		const grant = await this.getGrantEntity(id);

		await this.subscriptions.closeOAuthGrant(id, async () => {
			if (grant.revokedAt !== null) return;

			const revokedAt = new Date();
			await this.dataSource.transaction(async (manager) => {
				const result = await manager
					.getRepository(McpOAuthGrantEntity)
					.update(
						{ id, generation: grant.generation, revokedAt: IsNull() },
						{ revokedAt, generation: () => 'generation + 1' },
					);

				if (!result.affected) throw new ConflictException('The MCP OAuth grant changed during revocation');

				if (grant.providerGrantIdHash) {
					await manager
						.getRepository(McpOAuthProviderRevokedGrantEntity)
						.upsert({ grantIdHash: grant.providerGrantIdHash, revokedAt: revokedAt.getTime() }, ['grantIdHash']);
					await manager
						.getRepository(McpOAuthProviderArtifactEntity)
						.delete({ grantIdHash: grant.providerGrantIdHash });
				}
			});
		});

		this.auditService.recordOAuthManagementAction(actorId, 'grant', id, 'revoked');

		return this.getGrant(id);
	}

	async revokeAccessToken(id: string, actorId: string): Promise<void> {
		await this.getAccessToken(id);
		await this.subscriptions.closeOAuthAccessToken(id, async () => {
			const result = await this.artifacts.delete({ model: 'AccessToken', managementId: id });

			if (!result.affected) throw new ConflictException('The MCP OAuth access token changed during revocation');
		});
		this.auditService.recordOAuthManagementAction(actorId, 'access_token', id, 'revoked');
	}

	async revokeRefreshFamily(id: string, actorId: string): Promise<void> {
		await this.getRefreshFamily(id);
		await this.subscriptions.closeOAuthRefreshFamily(id, async () => {
			await this.dataSource.transaction(async (manager) => {
				await manager
					.getRepository(McpOAuthProviderRevokedRefreshFamilyEntity)
					.upsert({ refreshFamilyId: id, revokedAt: Date.now() }, ['refreshFamilyId']);
				const result = await manager.getRepository(McpOAuthProviderArtifactEntity).delete({ refreshFamilyId: id });

				if (!result.affected) throw new ConflictException('The MCP OAuth refresh family changed during revocation');
			});
		});
		this.auditService.recordOAuthManagementAction(actorId, 'refresh_family', id, 'revoked');
	}

	async revokeAll(actorId: string): Promise<void> {
		await this.globalInvalidation.invalidate(['serverSecretVersion'], () => Promise.resolve());
		this.auditService.recordOAuthGlobalRevocation(actorId);
	}

	private async getGrantEntity(id: string): Promise<McpOAuthGrantEntity> {
		const grant = await this.grants.findOne({
			where: { id },
			relations: { approvedBy: true, client: true },
		});

		if (!grant) throw new NotFoundException('Requested MCP OAuth grant does not exist');

		return grant;
	}

	private async mapGrant(grant: McpOAuthGrantEntity): Promise<McpOAuthGrantModel> {
		const providerRevocations = await this.getProviderRevocations([grant]);

		return McpOAuthGrantModel.fromEntity(
			grant,
			grant.providerGrantIdHash ? (providerRevocations.get(grant.providerGrantIdHash) ?? null) : null,
			this.isModuleEnabled(),
		);
	}

	private sameScopes(first: McpOAuthScope[], second: McpOAuthScope[]): boolean {
		return first.length === second.length && first.every((scope) => second.includes(scope));
	}

	private async mapAccessTokens(artifacts: McpOAuthProviderArtifactEntity[]): Promise<McpOAuthAccessTokenModel[]> {
		const [grants, revokedRefreshFamilies] = await Promise.all([
			this.getGrantsByProviderHash(artifacts),
			this.getRevokedRefreshFamilies(artifacts),
		]);

		return artifacts.flatMap((artifact) => {
			const grant = artifact.grantIdHash ? grants.get(artifact.grantIdHash) : undefined;

			if (
				!grant ||
				artifact.expiresAt === null ||
				(artifact.refreshFamilyId !== null && revokedRefreshFamilies.has(artifact.refreshFamilyId))
			) {
				return [];
			}

			return [
				Object.assign(new McpOAuthAccessTokenModel(), {
					id: artifact.managementId,
					clientId: grant.clientId,
					clientName: grant.client?.name ?? 'Unknown client',
					grantId: grant.id,
					refreshFamilyId: artifact.refreshFamilyId,
					scopes: this.parseScopes(artifact.payload),
					expiresAt: new Date(artifact.expiresAt).toISOString(),
				}),
			];
		});
	}

	private async mapRefreshFamilies(artifacts: McpOAuthProviderArtifactEntity[]): Promise<McpOAuthRefreshFamilyModel[]> {
		const [grants, revokedRefreshFamilies] = await Promise.all([
			this.getGrantsByProviderHash(artifacts),
			this.getRevokedRefreshFamilies(artifacts),
		]);
		const families = new Map<string, McpOAuthProviderArtifactEntity[]>();

		for (const artifact of artifacts) {
			if (!artifact.refreshFamilyId) continue;
			families.set(artifact.refreshFamilyId, [...(families.get(artifact.refreshFamilyId) ?? []), artifact]);
		}

		return [...families].flatMap(([id, familyArtifacts]) => {
			if (revokedRefreshFamilies.has(id)) return [];

			const linked = familyArtifacts.find((artifact) => artifact.grantIdHash && grants.has(artifact.grantIdHash));
			const grant = linked?.grantIdHash ? grants.get(linked.grantIdHash) : undefined;
			const expiresAt = Math.max(...familyArtifacts.map((artifact) => artifact.expiresAt ?? 0));

			if (!grant || expiresAt <= Date.now()) return [];

			return [
				Object.assign(new McpOAuthRefreshFamilyModel(), {
					id,
					clientId: grant.clientId,
					clientName: grant.client?.name ?? 'Unknown client',
					grantId: grant.id,
					expiresAt: new Date(expiresAt).toISOString(),
					activeTokenCount: familyArtifacts.filter(
						(artifact) => artifact.consumedAt === null && (artifact.expiresAt ?? 0) > Date.now(),
					).length,
				}),
			];
		});
	}

	private async getGrantsByProviderHash(
		artifacts: McpOAuthProviderArtifactEntity[],
	): Promise<Map<string, McpOAuthGrantEntity>> {
		const hashes = [
			...new Set(artifacts.map((artifact) => artifact.grantIdHash).filter((hash): hash is string => hash !== null)),
		];

		if (hashes.length === 0) return new Map();
		if (!this.isModuleEnabled()) return new Map();

		const grants = await this.grants.find({
			where: {
				providerGrantIdHash: In(hashes),
				revokedAt: IsNull(),
				expiresAt: MoreThan(new Date()),
			},
			relations: { approvedBy: true, client: true },
		});
		const providerRevocations = await this.getProviderRevocations(grants);

		return new Map(
			grants.flatMap((grant) =>
				grant.providerGrantIdHash &&
				!providerRevocations.has(grant.providerGrantIdHash) &&
				McpOAuthGrantModel.isActive(grant)
					? [[grant.providerGrantIdHash, grant] as const]
					: [],
			),
		);
	}

	private async getProviderRevocations(grants: McpOAuthGrantEntity[]): Promise<Map<string, number>> {
		const hashes = [
			...new Set(grants.map((grant) => grant.providerGrantIdHash).filter((hash): hash is string => hash !== null)),
		];

		if (hashes.length === 0) return new Map();

		const revocations = await this.dataSource
			.getRepository(McpOAuthProviderRevokedGrantEntity)
			.findBy({ grantIdHash: In(hashes) });

		return new Map(revocations.map((revocation) => [revocation.grantIdHash, revocation.revokedAt]));
	}

	private async getRevokedRefreshFamilies(artifacts: McpOAuthProviderArtifactEntity[]): Promise<Set<string>> {
		const ids = [
			...new Set(
				artifacts
					.map((artifact) => artifact.refreshFamilyId)
					.filter((refreshFamilyId): refreshFamilyId is string => refreshFamilyId !== null),
			),
		];

		if (ids.length === 0) return new Set();

		const revocations = await this.dataSource
			.getRepository(McpOAuthProviderRevokedRefreshFamilyEntity)
			.findBy({ refreshFamilyId: In(ids) });

		return new Set(revocations.map((revocation) => revocation.refreshFamilyId));
	}

	private isModuleEnabled(): boolean {
		return this.configService.getModuleConfig<McpConfigModel>(MCP_MODULE_NAME).enabled;
	}

	private parseScopes(payload: string): McpOAuthScope[] {
		try {
			const value = JSON.parse(payload) as ProviderArtifactPayload;

			if (typeof value.scope !== 'string') return [];

			return value.scope
				.split(' ')
				.filter((scope): scope is McpOAuthScope => Object.values(McpOAuthScope).includes(scope as McpOAuthScope));
		} catch {
			return [];
		}
	}
}
