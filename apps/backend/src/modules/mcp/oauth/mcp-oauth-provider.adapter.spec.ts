import { DataSource } from 'typeorm';

import { hashToken } from '../../auth/utils/token.utils';
import { UserEntity } from '../../users/entities/users.entity';
import { UserLanguage, UserRole } from '../../users/users.constants';
import {
	McpOAuthApproverAuthorityEntity,
	McpOAuthClientEntity,
	McpOAuthGrantEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRefreshFamilyLineageEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthProviderRevokedRefreshFamilyEntity,
	McpOAuthServerStateEntity,
} from '../entities/mcp-oauth.entity';
import { MCP_OAUTH_SERVER_STATE_KEY, McpOAuthScope } from '../mcp.constants';
import { McpOAuthClientService } from '../services/mcp-oauth-client.service';

import { createMcpOAuthProviderAdapter } from './mcp-oauth-provider.adapter';

describe('MCP OAuth provider adapter management identity', () => {
	let dataSource: DataSource;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [
				UserEntity,
				McpOAuthApproverAuthorityEntity,
				McpOAuthClientEntity,
				McpOAuthGrantEntity,
				McpOAuthProviderArtifactEntity,
				McpOAuthProviderRefreshFamilyLineageEntity,
				McpOAuthProviderRevokedGrantEntity,
				McpOAuthProviderRevokedRefreshFamilyEntity,
				McpOAuthServerStateEntity,
			],
			synchronize: true,
		});
		await dataSource.initialize();
		const user = await dataSource.getRepository(UserEntity).save({
			username: 'owner',
			password: null,
			email: null,
			firstName: null,
			lastName: null,
			role: UserRole.OWNER,
			language: UserLanguage.EN,
			isHidden: false,
		});
		const client = await dataSource.getRepository(McpOAuthClientEntity).save({
			clientIdentifier: 'public-client',
			name: 'Codex',
			redirectUris: ['http://127.0.0.1/callback'],
			maximumScopes: [McpOAuthScope.READ],
			enabled: true,
			generation: 2,
			createdById: user.id,
		});
		await dataSource.getRepository(McpOAuthServerStateEntity).save({
			key: MCP_OAUTH_SERVER_STATE_KEY,
			serverSecretVersion: 3,
			keyVersion: 1,
			publicIdentityGeneration: 4,
			oauthEnabledGeneration: 5,
			modulePolicyGeneration: 6,
			createdAt: new Date(),
			updatedAt: null,
		});
		await dataSource.getRepository(McpOAuthApproverAuthorityEntity).save({ approverId: user.id, generation: 7 });
		await dataSource.getRepository(McpOAuthGrantEntity).save({
			providerGrantIdHash: hashToken('provider-grant-id'),
			clientId: client.id,
			approvedById: user.id,
			installationId: 'installation-id',
			issuer: 'https://panel.example.com/oauth',
			resource: 'https://panel.example.com/mcp',
			approvedScopes: [McpOAuthScope.READ],
			expiresAt: new Date(Date.now() + 60_000),
			revokedAt: null,
			generation: 8,
			approverAuthorityGeneration: 7,
			oauthEnabledGeneration: 5,
			serverSecretVersion: 3,
			publicIdentityGeneration: 4,
			clientGeneration: 2,
			modulePolicyGeneration: 6,
		});
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	it('preserves non-secret management and refresh-family IDs across provider upserts and rotation', async () => {
		const Adapter = createMcpOAuthProviderAdapter(dataSource, {} as McpOAuthClientService, {
			allowTestInMemory: true,
		});
		const accessAdapter = new Adapter('AccessToken');
		const refreshAdapter = new Adapter('RefreshToken');
		const grantId = 'provider-grant-id';
		const payload = { grantId, clientId: 'public-client', scope: 'mcp:read', gty: 'authorization_code' };

		await accessAdapter.upsert('access-token', payload, 60);
		const initialAccess = await find('AccessToken', 'access-token');
		await accessAdapter.upsert('access-token', { ...payload, scope: 'mcp:read mcp:write' }, 60);
		const updatedAccess = await find('AccessToken', 'access-token');
		await refreshAdapter.upsert('refresh-token-one', { ...payload, rotations: 0 }, 120);
		const firstRefresh = await find('RefreshToken', 'refresh-token-one');
		const linkedAccess = await find('AccessToken', 'access-token');
		await refreshAdapter.upsert(
			'refresh-token-two',
			{ ...payload, gty: 'authorization_code refresh_token', rotations: 1 },
			120,
		);
		const secondRefresh = await find('RefreshToken', 'refresh-token-two');

		expect(initialAccess.managementId).toMatch(/^[0-9a-f-]{36}$/);
		expect(updatedAccess.managementId).toBe(initialAccess.managementId);
		expect(firstRefresh.managementId).not.toBe(secondRefresh.managementId);
		expect(firstRefresh.refreshFamilyId).toMatch(/^[0-9a-f-]{36}$/);
		expect(secondRefresh.refreshFamilyId).toBe(firstRefresh.refreshFamilyId);
		expect(linkedAccess.refreshFamilyId).toBe(firstRefresh.refreshFamilyId);
		expect(linkedAccess).toMatchObject({
			oauthEnabledGeneration: 5,
			serverSecretVersion: 3,
			publicIdentityGeneration: 4,
			clientGeneration: 2,
			grantGeneration: 8,
			modulePolicyGeneration: 6,
			approverAuthorityGeneration: 7,
		});
		expect(
			await dataSource.getRepository(McpOAuthProviderRefreshFamilyLineageEntity).findOneByOrFail({
				grantIdHash: hashToken(grantId),
			}),
		).toMatchObject({ refreshFamilyId: firstRefresh.refreshFamilyId });
		expect(JSON.stringify([linkedAccess, firstRefresh, secondRefresh])).not.toContain('access-token');
		expect(JSON.stringify([linkedAccess, firstRefresh, secondRefresh])).not.toContain('refresh-token-one');
	});

	it('refuses stale bearer artifacts after an authorization generation advances', async () => {
		const Adapter = createMcpOAuthProviderAdapter(dataSource, {} as McpOAuthClientService, {
			allowTestInMemory: true,
		});
		const accessAdapter = new Adapter('AccessToken');
		const payload = {
			grantId: 'provider-grant-id',
			clientId: 'public-client',
			scope: 'mcp:read',
			gty: 'authorization_code',
		};

		await accessAdapter.upsert('stale-access-token', payload, 60);
		await dataSource
			.getRepository(McpOAuthServerStateEntity)
			.increment({ key: MCP_OAUTH_SERVER_STATE_KEY }, 'publicIdentityGeneration', 1);

		await expect(accessAdapter.find('stale-access-token')).resolves.toBeUndefined();
		await expect(accessAdapter.upsert('late-access-token', payload, 60)).rejects.toThrow('already consumed');
		expect(await dataSource.getRepository(McpOAuthProviderArtifactEntity).countBy({ model: 'AccessToken' })).toBe(1);
	});

	async function find(model: string, rawValue: string): Promise<McpOAuthProviderArtifactEntity> {
		return dataSource.getRepository(McpOAuthProviderArtifactEntity).findOneByOrFail({
			model,
			idHash: hashToken(rawValue),
		});
	}
});
