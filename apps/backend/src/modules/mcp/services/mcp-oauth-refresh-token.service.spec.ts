import { DataSource } from 'typeorm';

import { UnauthorizedException } from '@nestjs/common';

import { hashToken } from '../../auth/utils/token.utils';
import { UserEntity } from '../../users/entities/users.entity';
import {
	McpOAuthAccessTokenEntity,
	McpOAuthClientEntity,
	McpOAuthGrantEntity,
	McpOAuthRefreshTokenEntity,
	McpOAuthRefreshTokenFamilyEntity,
} from '../entities/mcp-oauth.entity';
import { McpOAuthScope } from '../mcp.constants';

import { McpOAuthRefreshTokenService } from './mcp-oauth-refresh-token.service';

describe('McpOAuthRefreshTokenService', () => {
	let dataSource: DataSource;
	let service: McpOAuthRefreshTokenService;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [
				UserEntity,
				McpOAuthAccessTokenEntity,
				McpOAuthClientEntity,
				McpOAuthGrantEntity,
				McpOAuthRefreshTokenEntity,
				McpOAuthRefreshTokenFamilyEntity,
			],
			synchronize: true,
		});
		await dataSource.initialize();
		service = new McpOAuthRefreshTokenService(dataSource);
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	it('compare-and-consumes sequential refresh use and revokes the complete family on replay', async () => {
		const seeded = await seedFamily('sequential-refresh');
		const successor = await service.rotate(seeded.rawToken);

		expect(successor.artifact.predecessorId).toBe(seeded.token.id);
		await expect(service.rotate(seeded.rawToken)).rejects.toBeInstanceOf(UnauthorizedException);
		await expect(service.rotate(successor.rawValue)).rejects.toBeInstanceOf(UnauthorizedException);

		const family = await dataSource.getRepository(McpOAuthRefreshTokenFamilyEntity).findOneByOrFail({
			id: seeded.family.id,
		});
		const tokens = await dataSource.getRepository(McpOAuthRefreshTokenEntity).findBy({
			familyId: seeded.family.id,
		});
		const access = await dataSource.getRepository(McpOAuthAccessTokenEntity).findOneByOrFail({
			id: seeded.access.id,
		});

		expect(family).toMatchObject({ revocationReason: 'refresh_token_reuse', generation: 1 });
		expect(family.revokedAt).toBeInstanceOf(Date);
		expect(tokens).toHaveLength(2);
		expect(tokens.every(({ revokedAt }) => revokedAt instanceof Date)).toBe(true);
		expect(access.revokedAt).toBeInstanceOf(Date);
	});

	it('allows at most one barrier-synchronized successor and leaves no usable fork', async () => {
		const seeded = await seedFamily('concurrent-refresh');
		let release: () => void;
		const barrier = new Promise<void>((resolve) => {
			release = resolve;
		});
		const rotations = [
			barrier.then(() => service.rotate(seeded.rawToken)),
			barrier.then(() => service.rotate(seeded.rawToken)),
		];

		release();
		const results = await Promise.allSettled(rotations);
		const fulfilled = results.filter((result) => result.status === 'fulfilled');

		expect(fulfilled).toHaveLength(1);
		expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

		const family = await dataSource.getRepository(McpOAuthRefreshTokenFamilyEntity).findOneByOrFail({
			id: seeded.family.id,
		});
		const successors = await dataSource.getRepository(McpOAuthRefreshTokenEntity).findBy({
			predecessorId: seeded.token.id,
		});
		const tokens = await dataSource.getRepository(McpOAuthRefreshTokenEntity).findBy({
			familyId: seeded.family.id,
		});

		expect(family.revocationReason).toBe('refresh_token_reuse');
		expect(successors).toHaveLength(1);
		expect(tokens.every(({ revokedAt }) => revokedAt instanceof Date)).toBe(true);
	});

	async function seedFamily(rawToken: string) {
		const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
		const clientRepository = dataSource.getRepository(McpOAuthClientEntity);
		const client = await clientRepository.save(
			clientRepository.create({
				clientIdentifier: `client-${rawToken}`,
				name: 'Codex',
				redirectUris: ['http://127.0.0.1:49152/callback'],
				maximumScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
				enabled: true,
				generation: 0,
				createdById: null,
			}),
		);
		const grantRepository = dataSource.getRepository(McpOAuthGrantEntity);
		const grant = await grantRepository.save(
			grantRepository.create({
				clientId: client.id,
				approvedById: null,
				installationId: 'installation-1',
				issuer: 'https://panel.example.com/api/v1/modules/mcp/oauth',
				resource: 'https://panel.example.com/api/v1/modules/mcp',
				approvedScopes: [McpOAuthScope.READ, McpOAuthScope.OFFLINE_ACCESS],
				expiresAt,
				revokedAt: null,
				generation: 0,
				approverAuthorityGeneration: 0,
			}),
		);
		const familyRepository = dataSource.getRepository(McpOAuthRefreshTokenFamilyEntity);
		const family = await familyRepository.save(
			familyRepository.create({
				clientId: client.id,
				grantId: grant.id,
				installationId: grant.installationId,
				expiresAt,
				revokedAt: null,
				revocationReason: null,
				generation: 0,
			}),
		);
		const tokenRepository = dataSource.getRepository(McpOAuthRefreshTokenEntity);
		const token = await tokenRepository.save(
			tokenRepository.create({
				tokenHash: hashToken(rawToken),
				familyId: family.id,
				predecessorId: null,
				expiresAt,
				consumedAt: null,
				revokedAt: null,
			}),
		);
		const accessRepository = dataSource.getRepository(McpOAuthAccessTokenEntity);
		const access = await accessRepository.save(
			accessRepository.create({
				tokenHash: hashToken(`access-${rawToken}`),
				clientId: client.id,
				grantId: grant.id,
				refreshFamilyId: family.id,
				installationId: grant.installationId,
				issuer: grant.issuer,
				resource: grant.resource,
				scopes: [McpOAuthScope.READ],
				expiresAt,
				revokedAt: null,
			}),
		);

		return { rawToken, client, grant, family, token, access };
	}
});
