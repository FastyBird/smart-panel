import { type Ref, ref } from 'vue';

import { snakeToCamel, useBackend } from '../../../common';
import { MCP_MODULE_PREFIX } from '../mcp.constants';
import { McpApiException } from '../mcp.exceptions';
import {
	McpClientCredentialSchema,
	McpClientSchema,
	McpCreateClientSchema,
	McpRotateClientSchema,
	McpUpdateClientSchema,
} from '../schemas/client.schemas';
import type { IMcpClient, IMcpClientCredential, IMcpCreateClient, IMcpRotateClient, IMcpUpdateClient } from '../schemas/client.types';

interface IUseMcpClients {
	clients: Ref<IMcpClient[]>;
	loading: Ref<boolean>;
	error: Ref<Error | null>;
	fetchClients: () => Promise<IMcpClient[]>;
	createClient: (payload: IMcpCreateClient) => Promise<IMcpClientCredential>;
	updateClient: (id: string, payload: IMcpUpdateClient) => Promise<IMcpClient>;
	rotateClient: (id: string, payload: IMcpRotateClient) => Promise<IMcpClientCredential>;
	revokeClient: (id: string) => Promise<IMcpClient>;
	deleteClient: (id: string) => Promise<void>;
}

const clientsPath = `/modules/${MCP_MODULE_PREFIX}/clients` as const;
const clientPath = `/modules/${MCP_MODULE_PREFIX}/clients/{id}` as const;
const rotatePath = `/modules/${MCP_MODULE_PREFIX}/clients/{id}/rotate` as const;
const revokePath = `/modules/${MCP_MODULE_PREFIX}/clients/{id}/revoke` as const;

export const useMcpClients = (): IUseMcpClients => {
	const backend = useBackend();
	const clients = ref<IMcpClient[]>([]);
	const loading = ref(false);
	const error = ref<Error | null>(null);

	const setClient = (client: IMcpClient): IMcpClient => {
		const index = clients.value.findIndex((item) => item.id === client.id);

		if (index >= 0) clients.value[index] = client;
		else clients.value.unshift(client);

		return client;
	};

	const fetchClients = async (): Promise<IMcpClient[]> => {
		loading.value = true;
		error.value = null;

		try {
			const { data, response } = await backend.client.GET(clientsPath, {});

			if (!data) throw new McpApiException('Failed to load MCP clients.', response.status);

			clients.value = data.data.map((client) => McpClientSchema.parse(snakeToCamel(client)));

			return clients.value;
		} catch (caught) {
			error.value = caught instanceof Error ? caught : new Error('Failed to load MCP clients.');
			throw error.value;
		} finally {
			loading.value = false;
		}
	};

	const createClient = async (payload: IMcpCreateClient): Promise<IMcpClientCredential> => {
		const parsed = McpCreateClientSchema.parse(payload);
		const { data, response } = await backend.client.POST(clientsPath, {
			body: {
				data: {
					name: parsed.name,
					description: parsed.description,
					capabilities: parsed.capabilities,
					expires_in_days: parsed.expiresInDays,
				},
			},
		});

		if (!data) throw new McpApiException('Failed to create MCP client.', response.status);

		const credential = McpClientCredentialSchema.parse(snakeToCamel(data.data));
		setClient(credential.client);

		return credential;
	};

	const updateClient = async (id: string, payload: IMcpUpdateClient): Promise<IMcpClient> => {
		const parsed = McpUpdateClientSchema.parse(payload);
		const { data, response } = await backend.client.PATCH(clientPath, {
			params: { path: { id } },
			body: { data: parsed },
		});

		if (!data) throw new McpApiException('Failed to update MCP client.', response.status);

		return setClient(McpClientSchema.parse(snakeToCamel(data.data)));
	};

	const rotateClient = async (id: string, payload: IMcpRotateClient): Promise<IMcpClientCredential> => {
		const parsed = McpRotateClientSchema.parse(payload);
		const { data, response } = await backend.client.POST(rotatePath, {
			params: { path: { id } },
			body: { data: { expires_in_days: parsed.expiresInDays } },
		});

		if (!data) throw new McpApiException('Failed to rotate MCP client credential.', response.status);

		const credential = McpClientCredentialSchema.parse(snakeToCamel(data.data));
		setClient(credential.client);

		return credential;
	};

	const revokeClient = async (id: string): Promise<IMcpClient> => {
		const { data, response } = await backend.client.POST(revokePath, { params: { path: { id } } });

		if (!data) throw new McpApiException('Failed to revoke MCP client.', response.status);

		return setClient(McpClientSchema.parse(snakeToCamel(data.data)));
	};

	const deleteClient = async (id: string): Promise<void> => {
		const { response } = await backend.client.DELETE(clientPath, { params: { path: { id } } });

		if (!response.ok) throw new McpApiException('Failed to delete MCP client.', response.status);

		clients.value = clients.value.filter((client) => client.id !== id);
	};

	return {
		clients,
		loading,
		error,
		fetchClients,
		createClient,
		updateClient,
		rotateClient,
		revokeClient,
		deleteClient,
	};
};
