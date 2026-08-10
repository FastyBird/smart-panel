import { Repository } from 'typeorm';

import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';

import { hashToken } from '../../auth/utils/token.utils';
import { ConfigService } from '../../config/services/config.service';
import { UserRole } from '../../users/users.constants';
import {
	McpOAuthApproverAuthorityEntity,
	McpOAuthGrantEntity,
	McpOAuthProviderArtifactEntity,
	McpOAuthProviderRevokedGrantEntity,
	McpOAuthServerStateEntity,
} from '../entities/mcp-oauth.entity';
import { McpCapability, McpOAuthScope } from '../mcp.constants';
import { McpConfigModel } from '../models/config.model';
import { McpOAuthPublicUrls } from '../oauth/mcp-oauth.types';

import { McpInstallationService } from './mcp-installation.service';
import { McpOAuthPublicUrlService } from './mcp-oauth-public-url.service';
import { McpOAuthResourceServerService } from './mcp-oauth-resource-server.service';

const RAW_TOKEN = 'opaque-access-token';
const PROVIDER_GRANT_ID = 'provider-grant-id';
const TOKEN_ID = hashToken(RAW_TOKEN);
const PROVIDER_GRANT_ID_HASH = hashToken(PROVIDER_GRANT_ID);
const INSTALLATION_ID = 'installation-id';
const CLIENT_IDENTIFIER = 'public-client-id';
const APPROVER_ID = 'approver-id';

const urls: McpOAuthPublicUrls = {
	publicBaseUrl: 'https://panel.example.com/smart-panel',
	resource: 'https://panel.example.com/smart-panel/api/v1/modules/mcp',
	protectedResourceMetadata:
		'https://panel.example.com/.well-known/oauth-protected-resource/smart-panel/api/v1/modules/mcp',
	issuer: 'https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth',
	authorizationServerMetadata:
		'https://panel.example.com/.well-known/oauth-authorization-server/smart-panel/api/v1/modules/mcp/oauth',
	authorizationEndpoint: 'https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth/authorize',
	tokenEndpoint: 'https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth/token',
	revocationEndpoint: 'https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth/token/revocation',
};

describe('McpOAuthResourceServerService', () => {
	let artifact: McpOAuthProviderArtifactEntity;
	let grant: McpOAuthGrantEntity;
	let config: McpConfigModel;
	let payload: Record<string, unknown>;
	let artifactRepository: { findOneBy: jest.Mock };
	let revokedGrantRepository: { findOneBy: jest.Mock };
	let grantRepository: { findOne: jest.Mock };
	let approverAuthorityRepository: { findOneBy: jest.Mock };
	let serverStateRepository: { findOneBy: jest.Mock };
	let service: McpOAuthResourceServerService;

	beforeEach(() => {
		config = Object.assign(new McpConfigModel(), {
			enabled: true,
			capabilities: [McpCapability.READ, McpCapability.WRITE, McpCapability.TRIGGER],
		});
		payload = {
			grantId: PROVIDER_GRANT_ID,
			accountId: APPROVER_ID,
			clientId: CLIENT_IDENTIFIER,
			aud: urls.resource,
			scope: 'mcp:read mcp:write mcp:trigger',
		};
		artifact = Object.assign(new McpOAuthProviderArtifactEntity(), {
			model: 'AccessToken',
			idHash: TOKEN_ID,
			managementId: 'access-token-management-id',
			payload: JSON.stringify(payload),
			grantIdHash: PROVIDER_GRANT_ID_HASH,
			refreshFamilyId: 'refresh-family-id',
			expiresAt: Date.now() + 60_000,
		});
		grant = Object.assign(new McpOAuthGrantEntity(), {
			id: 'grant-id',
			providerGrantIdHash: PROVIDER_GRANT_ID_HASH,
			clientId: 'client-id',
			client: {
				id: 'client-id',
				clientIdentifier: CLIENT_IDENTIFIER,
				enabled: true,
				generation: 2,
				maximumScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE, McpOAuthScope.TRIGGER],
			},
			approvedById: APPROVER_ID,
			approvedBy: { id: APPROVER_ID, role: UserRole.OWNER },
			installationId: INSTALLATION_ID,
			issuer: urls.issuer,
			resource: urls.resource,
			approvedScopes: [McpOAuthScope.READ, McpOAuthScope.WRITE, McpOAuthScope.TRIGGER],
			expiresAt: new Date(Date.now() + 60_000),
			generation: 3,
			approverAuthorityGeneration: 4,
			revokedAt: null,
		});
		artifactRepository = { findOneBy: jest.fn().mockImplementation(() => Promise.resolve(artifact)) };
		revokedGrantRepository = { findOneBy: jest.fn().mockResolvedValue(null) };
		grantRepository = { findOne: jest.fn().mockImplementation(() => Promise.resolve(grant)) };
		approverAuthorityRepository = { findOneBy: jest.fn().mockResolvedValue({ generation: 4 }) };
		serverStateRepository = {
			findOneBy: jest.fn().mockResolvedValue({ key: 'primary', modulePolicyGeneration: 1 }),
		};
		service = new McpOAuthResourceServerService(
			artifactRepository as unknown as Repository<McpOAuthProviderArtifactEntity>,
			revokedGrantRepository as unknown as Repository<McpOAuthProviderRevokedGrantEntity>,
			grantRepository as unknown as Repository<McpOAuthGrantEntity>,
			approverAuthorityRepository as unknown as Repository<McpOAuthApproverAuthorityEntity>,
			serverStateRepository as unknown as Repository<McpOAuthServerStateEntity>,
			{ getModuleConfig: jest.fn(() => config) } as unknown as ConfigService,
			{ getInstallationId: jest.fn().mockResolvedValue(INSTALLATION_ID) } as unknown as McpInstallationService,
			{ getUrls: jest.fn(() => urls) } as unknown as McpOAuthPublicUrlService,
		);
	});

	it('builds path-aware protected-resource and bounded authorization-server metadata', () => {
		expect({
			protectedResource: service.getProtectedResourceMetadata(),
			authorizationServer: service.getAuthorizationServerMetadata(),
		}).toMatchInlineSnapshot(`
{
  "authorizationServer": {
    "authorization_endpoint": "https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth/authorize",
    "authorization_response_iss_parameter_supported": true,
    "code_challenge_methods_supported": [
      "S256",
    ],
    "grant_types_supported": [
      "authorization_code",
      "refresh_token",
    ],
    "issuer": "https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth",
    "response_types_supported": [
      "code",
    ],
    "revocation_endpoint": "https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth/token/revocation",
    "scopes_supported": [
      "mcp:read",
      "mcp:write",
      "mcp:trigger",
      "offline_access",
    ],
    "token_endpoint": "https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth/token",
    "token_endpoint_auth_methods_supported": [
      "none",
    ],
  },
  "protectedResource": {
    "authorization_servers": [
      "https://panel.example.com/smart-panel/api/v1/modules/mcp/oauth",
    ],
    "resource": "https://panel.example.com/smart-panel/api/v1/modules/mcp",
    "resource_documentation": undefined,
    "resource_name": "FastyBird Smart Panel MCP",
    "scopes_supported": [
      "mcp:read",
      "mcp:write",
      "mcp:trigger",
    ],
  },
}
`);
	});

	it('maps the four-way live scope intersection to MCP capabilities', async () => {
		config.capabilities = [McpCapability.READ, McpCapability.WRITE, McpCapability.TRIGGER];
		grant.client.maximumScopes = [McpOAuthScope.READ, McpOAuthScope.WRITE, McpOAuthScope.TRIGGER];
		grant.approvedScopes = [McpOAuthScope.READ, McpOAuthScope.WRITE];
		payload.scope = 'mcp:read mcp:trigger';
		artifact.payload = JSON.stringify(payload);

		const authInfo = await service.verifyAccessToken(RAW_TOKEN);

		expect(authInfo).toEqual(
			expect.objectContaining({
				clientId: CLIENT_IDENTIFIER,
				scopes: [McpOAuthScope.READ],
				resource: new URL(urls.resource),
			}),
		);
		expect(authInfo.extra?.principal).toEqual(
			expect.objectContaining({
				accessTokenId: 'access-token-management-id',
				approverAuthorityGeneration: 4,
				approverId: APPROVER_ID,
				clientGeneration: 2,
				effectiveCapabilities: [McpCapability.READ],
				effectiveScopes: [McpOAuthScope.READ],
				grantGeneration: 3,
				installationId: INSTALLATION_ID,
				modulePolicyGeneration: 1,
				refreshFamilyId: 'refresh-family-id',
			}),
		);
	});

	it('returns internal capabilities only after the SDK bearer verifier enforces OAuth scopes', async () => {
		const authInfo = await service.verifyMcpBearerToken(`Bearer ${RAW_TOKEN}`, [McpCapability.READ]);

		expect(authInfo.scopes).toEqual([McpCapability.READ, McpCapability.WRITE, McpCapability.TRIGGER]);
	});

	it('rejects a grant from an earlier approver authority generation', async () => {
		approverAuthorityRepository.findOneBy.mockResolvedValue({ generation: 5 });

		await expect(service.verifyAccessToken(RAW_TOKEN)).rejects.toMatchObject({ code: OAuthErrorCode.InvalidToken });
	});

	it('caps the resource-server authorization deadline at the grant expiry', async () => {
		grant.expiresAt = new Date(Date.now() + 30_000);
		artifact.expiresAt = Date.now() + 60_000;

		const authInfo = await service.verifyAccessToken(RAW_TOKEN);

		expect(authInfo.expiresAt).toBe(Math.floor(grant.expiresAt.getTime() / 1_000));
		expect(authInfo.extra?.principal).toEqual(
			expect.objectContaining({ authorizationDeadline: grant.expiresAt.getTime() }),
		);
	});

	it('fails closed when the persistent authorization generation state is unavailable', async () => {
		serverStateRepository.findOneBy.mockResolvedValue(null);

		await expect(service.verifyAccessToken(RAW_TOKEN)).rejects.toMatchObject({ code: OAuthErrorCode.InvalidToken });
	});

	it('builds RFC 6750 invalid-token and insufficient-scope challenges with discovery', async () => {
		let invalidError: unknown;

		try {
			await service.verifyMcpBearerToken(undefined, [McpCapability.READ]);
		} catch (error) {
			invalidError = error;
		}

		payload.scope = 'mcp:read';
		artifact.payload = JSON.stringify(payload);
		let scopeError: unknown;

		try {
			await service.verifyMcpBearerToken(`Bearer ${RAW_TOKEN}`, [McpCapability.WRITE]);
		} catch (error) {
			scopeError = error;
		}

		const invalidResponse = service.getBearerChallenge(invalidError, [McpCapability.READ]);
		const scopeResponse = service.getBearerChallenge(scopeError, [McpCapability.WRITE]);

		expect({
			invalid: {
				status: invalidResponse.status,
				challenge: invalidResponse.headers.get('www-authenticate'),
			},
			insufficient: {
				status: scopeResponse.status,
				challenge: scopeResponse.headers.get('www-authenticate'),
			},
		}).toMatchInlineSnapshot(`
{
  "insufficient": {
    "challenge": "Bearer error="insufficient_scope", error_description="Insufficient scope", scope="mcp:write", resource_metadata="https://panel.example.com/.well-known/oauth-protected-resource/smart-panel/api/v1/modules/mcp"",
    "status": 403,
  },
  "invalid": {
    "challenge": "Bearer error="invalid_token", error_description="Missing Authorization header", scope="mcp:read", resource_metadata="https://panel.example.com/.well-known/oauth-protected-resource/smart-panel/api/v1/modules/mcp"",
    "status": 401,
  },
}
`);
	});

	it.each([
		['wrong provider grant', () => (payload.grantId = 'other-provider-grant')],
		['wrong issuer', () => (grant.issuer = 'https://other.example.com/oauth')],
		['wrong canonical resource', () => (grant.resource = 'https://other.example.com/mcp')],
		['wrong audience', () => (payload.aud = 'https://other.example.com/mcp')],
		['cross-client token', () => (payload.clientId = 'other-client')],
		['wrong installation', () => (grant.installationId = 'other-installation')],
		['expired token', () => (artifact.expiresAt = Date.now() - 1)],
		['expired grant', () => (grant.expiresAt = new Date(Date.now() - 1))],
		['revoked grant', () => (grant.revokedAt = new Date())],
		['disabled client', () => (grant.client.enabled = false)],
		['deleted approver', () => (grant.approvedBy = null)],
		['demoted approver', () => (grant.approvedBy.role = UserRole.USER)],
		['unknown scope', () => (payload.scope = 'mcp:read mcp:unknown')],
		['disabled module', () => (config.enabled = false)],
	])('rejects a token with %s', async (_label, mutate) => {
		mutate();
		artifact.payload = JSON.stringify(payload);

		await expect(service.verifyAccessToken(RAW_TOKEN)).rejects.toMatchObject({ code: OAuthErrorCode.InvalidToken });
	});

	it('rejects a provider-revoked grant tombstone', async () => {
		revokedGrantRepository.findOneBy.mockResolvedValue({ grantIdHash: PROVIDER_GRANT_ID_HASH });

		await expect(service.verifyAccessToken(RAW_TOKEN)).rejects.toBeInstanceOf(OAuthError);
	});

	it('rejects a token whose stored provider artifact has the wrong token type', async () => {
		const refreshArtifact = Object.assign(new McpOAuthProviderArtifactEntity(), artifact, { model: 'RefreshToken' });
		artifactRepository.findOneBy.mockImplementation(({ model, idHash }) =>
			Promise.resolve(model === refreshArtifact.model && idHash === refreshArtifact.idHash ? refreshArtifact : null),
		);

		await expect(service.verifyAccessToken(RAW_TOKEN)).rejects.toMatchObject({ code: OAuthErrorCode.InvalidToken });
		expect(artifactRepository.findOneBy).toHaveBeenCalledWith({ model: 'AccessToken', idHash: TOKEN_ID });
	});
});
