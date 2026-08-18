import { type Ref, ref } from 'vue';

import { useBackend } from '../../../common';
import { MCP_MODULE_PREFIX } from '../mcp.constants';
import { McpApiException } from '../mcp.exceptions';
import { McpOAuthCreateClientSchema, McpOAuthUpdateClientSchema, McpOAuthUpdateGrantSchema } from '../schemas/oauth-management.schemas';
import {
	transformOAuthAccessToken,
	transformOAuthClient,
	transformOAuthGrant,
	transformOAuthRefreshFamily,
} from '../schemas/oauth-management.transformers';
import type {
	IMcpOAuthAccessToken,
	IMcpOAuthClient,
	IMcpOAuthCreateClient,
	IMcpOAuthGrant,
	IMcpOAuthRefreshFamily,
	IMcpOAuthUpdateClient,
	IMcpOAuthUpdateGrant,
} from '../schemas/oauth-management.types';

interface IUseMcpOAuthManagement {
	clients: Ref<IMcpOAuthClient[]>;
	grants: Ref<IMcpOAuthGrant[]>;
	accessTokens: Ref<IMcpOAuthAccessToken[]>;
	refreshFamilies: Ref<IMcpOAuthRefreshFamily[]>;
	loading: Ref<boolean>;
	error: Ref<Error | null>;
	fetchAll: () => Promise<void>;
	createClient: (payload: IMcpOAuthCreateClient) => Promise<IMcpOAuthClient>;
	updateClient: (id: string, payload: IMcpOAuthUpdateClient) => Promise<IMcpOAuthClient>;
	revokeClient: (id: string) => Promise<IMcpOAuthClient>;
	revokeGrant: (id: string) => Promise<IMcpOAuthGrant>;
	updateGrant: (id: string, payload: IMcpOAuthUpdateGrant) => Promise<IMcpOAuthGrant>;
	revokeAccessToken: (id: string) => Promise<void>;
	revokeRefreshFamily: (id: string) => Promise<void>;
	revokeAll: () => Promise<void>;
}

const oauthPath = `/modules/${MCP_MODULE_PREFIX}/oauth` as const;
const clientsPath = `${oauthPath}/clients` as const;
const clientPath = `${oauthPath}/clients/{id}` as const;
const revokeClientPath = `${oauthPath}/clients/{id}/revoke` as const;
const grantsPath = `${oauthPath}/grants` as const;
const grantPath = `${oauthPath}/grants/{id}` as const;
const revokeGrantPath = `${oauthPath}/grants/{id}/revoke` as const;
const accessTokensPath = `${oauthPath}/access-tokens` as const;
const revokeAccessTokenPath = `${oauthPath}/access-tokens/{id}/revoke` as const;
const refreshFamiliesPath = `${oauthPath}/refresh-families` as const;
const revokeRefreshFamilyPath = `${oauthPath}/refresh-families/{id}/revoke` as const;
const revokeAllPath = `${oauthPath}/revoke-all` as const;

export const useMcpOAuthManagement = (): IUseMcpOAuthManagement => {
	const backend = useBackend();
	const clients = ref<IMcpOAuthClient[]>([]);
	const grants = ref<IMcpOAuthGrant[]>([]);
	const accessTokens = ref<IMcpOAuthAccessToken[]>([]);
	const refreshFamilies = ref<IMcpOAuthRefreshFamily[]>([]);
	const loading = ref(false);
	const error = ref<Error | null>(null);

	const fetchAll = async (): Promise<void> => {
		loading.value = true;
		error.value = null;

		try {
			const [clientsResult, grantsResult, accessResult, familiesResult] = await Promise.all([
				backend.client.GET(clientsPath, {}),
				backend.client.GET(grantsPath, {}),
				backend.client.GET(accessTokensPath, {}),
				backend.client.GET(refreshFamiliesPath, {}),
			]);

			if (!clientsResult.data || !grantsResult.data || !accessResult.data || !familiesResult.data) {
				const status = [clientsResult, grantsResult, accessResult, familiesResult].find((result) => !result.data)?.response.status;
				throw new McpApiException('Failed to load MCP OAuth authorization data.', status);
			}

			clients.value = clientsResult.data.data.map(transformOAuthClient);
			grants.value = grantsResult.data.data.map(transformOAuthGrant);
			accessTokens.value = accessResult.data.data.map(transformOAuthAccessToken);
			refreshFamilies.value = familiesResult.data.data.map(transformOAuthRefreshFamily);
		} catch (caught) {
			error.value = caught instanceof Error ? caught : new Error('Failed to load MCP OAuth authorization data.');
			throw error.value;
		} finally {
			loading.value = false;
		}
	};

	const setClient = (client: IMcpOAuthClient): IMcpOAuthClient => {
		const index = clients.value.findIndex((item) => item.id === client.id);
		if (index >= 0) clients.value[index] = client;
		else clients.value.unshift(client);

		return client;
	};

	const createClient = async (payload: IMcpOAuthCreateClient): Promise<IMcpOAuthClient> => {
		const parsed = McpOAuthCreateClientSchema.parse(payload);
		const { data, response } = await backend.client.POST(clientsPath, {
			body: {
				data: {
					name: parsed.name,
					redirect_uris: parsed.redirectUris,
					maximum_scopes: parsed.maximumScopes,
				},
			},
		});

		if (!data) throw new McpApiException('Failed to create MCP OAuth client.', response.status);

		return setClient(transformOAuthClient(data.data));
	};

	const updateClient = async (id: string, payload: IMcpOAuthUpdateClient): Promise<IMcpOAuthClient> => {
		const parsed = McpOAuthUpdateClientSchema.parse(payload);
		const { data, response } = await backend.client.PATCH(clientPath, {
			params: { path: { id } },
			body: {
				data: {
					...(parsed.name === undefined ? {} : { name: parsed.name }),
					...(parsed.redirectUris === undefined ? {} : { redirect_uris: parsed.redirectUris }),
					...(parsed.maximumScopes === undefined ? {} : { maximum_scopes: parsed.maximumScopes }),
				},
			},
		});

		if (!data) throw new McpApiException('Failed to update MCP OAuth client.', response.status);

		return setClient(transformOAuthClient(data.data));
	};

	const revokeClient = async (id: string): Promise<IMcpOAuthClient> => {
		const { data, response } = await backend.client.POST(revokeClientPath, { params: { path: { id } } });

		if (!data) throw new McpApiException('Failed to disable MCP OAuth client.', response.status);

		const client = setClient(transformOAuthClient(data.data));
		grants.value = grants.value.map((grant) =>
			grant.clientId === id ? { ...grant, active: false, revokedAt: grant.revokedAt ?? new Date().toISOString() } : grant
		);
		accessTokens.value = accessTokens.value.filter((token) => token.clientId !== id);
		refreshFamilies.value = refreshFamilies.value.filter((family) => family.clientId !== id);

		return client;
	};

	const revokeGrant = async (id: string): Promise<IMcpOAuthGrant> => {
		const { data, response } = await backend.client.POST(revokeGrantPath, { params: { path: { id } } });

		if (!data) throw new McpApiException('Failed to revoke MCP OAuth grant.', response.status);

		const grant = transformOAuthGrant(data.data);
		grants.value = grants.value.map((item) => (item.id === id ? grant : item));
		accessTokens.value = accessTokens.value.filter((token) => token.grantId !== id);
		refreshFamilies.value = refreshFamilies.value.filter((family) => family.grantId !== id);

		return grant;
	};

	const updateGrant = async (id: string, payload: IMcpOAuthUpdateGrant): Promise<IMcpOAuthGrant> => {
		const parsed = McpOAuthUpdateGrantSchema.parse(payload);
		const { data, response } = await backend.client.PATCH(grantPath, {
			params: { path: { id } },
			body: { data: { approved_scopes: parsed.approvedScopes } },
		});

		if (!data) throw new McpApiException('Failed to update MCP OAuth grant.', response.status);

		const grant = transformOAuthGrant(data.data);
		grants.value = grants.value.map((item) => (item.id === id ? grant : item));

		return grant;
	};

	const revokeAccessToken = async (id: string): Promise<void> => {
		const { response } = await backend.client.POST(revokeAccessTokenPath, { params: { path: { id } } });

		if (!response.ok) throw new McpApiException('Failed to revoke MCP OAuth access token.', response.status);

		accessTokens.value = accessTokens.value.filter((token) => token.id !== id);
	};

	const revokeRefreshFamily = async (id: string): Promise<void> => {
		const { response } = await backend.client.POST(revokeRefreshFamilyPath, { params: { path: { id } } });

		if (!response.ok) throw new McpApiException('Failed to revoke MCP OAuth refresh family.', response.status);

		refreshFamilies.value = refreshFamilies.value.filter((family) => family.id !== id);
		accessTokens.value = accessTokens.value.filter((token) => token.refreshFamilyId !== id);
	};

	const revokeAll = async (): Promise<void> => {
		const { data, response } = await backend.client.POST(revokeAllPath, {});

		if (!data?.data.revoked) {
			throw new McpApiException('Failed to revoke all MCP OAuth authorization.', response.status);
		}

		const revokedAt = new Date().toISOString();
		grants.value = grants.value.map((grant) => ({
			...grant,
			active: false,
			revokedAt: grant.revokedAt ?? revokedAt,
		}));
		accessTokens.value = [];
		refreshFamilies.value = [];
	};

	return {
		clients,
		grants,
		accessTokens,
		refreshFamilies,
		loading,
		error,
		fetchAll,
		createClient,
		updateClient,
		revokeClient,
		revokeGrant,
		updateGrant,
		revokeAccessToken,
		revokeRefreshFamily,
		revokeAll,
	};
};
