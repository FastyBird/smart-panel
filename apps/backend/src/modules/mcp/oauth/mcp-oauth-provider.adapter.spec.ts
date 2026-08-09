import { DataSource } from 'typeorm';

import { hashToken } from '../../auth/utils/token.utils';
import {
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthProviderRevokedRefreshFamilyEntity,
} from '../entities/mcp-oauth.entity';
import { McpOAuthClientService } from '../services/mcp-oauth-client.service';

import { createMcpOAuthProviderAdapter } from './mcp-oauth-provider.adapter';

describe('MCP OAuth provider adapter management identity', () => {
	let dataSource: DataSource;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [
				McpOAuthProviderArtifactEntity,
				McpOAuthProviderRevokedGrantEntity,
				McpOAuthProviderRevokedRefreshFamilyEntity,
			],
			synchronize: true,
		});
		await dataSource.initialize();
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
		const payload = { grantId, clientId: 'public-client', scope: 'mcp:read' };

		await accessAdapter.upsert('access-token', payload, 60);
		const initialAccess = await find('AccessToken', 'access-token');
		await accessAdapter.upsert('access-token', { ...payload, scope: 'mcp:read mcp:write' }, 60);
		const updatedAccess = await find('AccessToken', 'access-token');
		await refreshAdapter.upsert('refresh-token-one', payload, 120);
		const firstRefresh = await find('RefreshToken', 'refresh-token-one');
		const linkedAccess = await find('AccessToken', 'access-token');
		await refreshAdapter.upsert('refresh-token-two', payload, 120);
		const secondRefresh = await find('RefreshToken', 'refresh-token-two');

		expect(initialAccess.managementId).toMatch(/^[0-9a-f-]{36}$/);
		expect(updatedAccess.managementId).toBe(initialAccess.managementId);
		expect(firstRefresh.managementId).not.toBe(secondRefresh.managementId);
		expect(firstRefresh.refreshFamilyId).toMatch(/^[0-9a-f-]{36}$/);
		expect(secondRefresh.refreshFamilyId).toBe(firstRefresh.refreshFamilyId);
		expect(linkedAccess.refreshFamilyId).toBe(firstRefresh.refreshFamilyId);
		expect(JSON.stringify([linkedAccess, firstRefresh, secondRefresh])).not.toContain('access-token');
		expect(JSON.stringify([linkedAccess, firstRefresh, secondRefresh])).not.toContain('refresh-token-one');
	});

	async function find(model: string, rawValue: string): Promise<McpOAuthProviderArtifactEntity> {
		return dataSource.getRepository(McpOAuthProviderArtifactEntity).findOneByOrFail({
			model,
			idHash: hashToken(rawValue),
		});
	}
});
