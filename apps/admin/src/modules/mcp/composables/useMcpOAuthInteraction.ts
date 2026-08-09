import { type Ref, ref } from 'vue';

import { snakeToCamel, useBackend } from '../../../common';
import { MCP_MODULE_PREFIX, McpOAuthScope } from '../mcp.constants';
import { McpApiException } from '../mcp.exceptions';
import {
	McpOAuthInteractionCompletionSchema,
	McpOAuthInteractionSchema,
} from '../schemas/oauth-interaction.schemas';
import type {
	IMcpOAuthInteraction,
	IMcpOAuthInteractionCompletion,
} from '../schemas/oauth-interaction.schemas';

interface IUseMcpOAuthInteraction {
	interaction: Ref<IMcpOAuthInteraction | null>;
	loading: Ref<boolean>;
	working: Ref<boolean>;
	error: Ref<Error | null>;
	load: (uid: string) => Promise<IMcpOAuthInteraction>;
	approve: (uid: string, scopes: McpOAuthScope[], expiresInDays: number) => Promise<IMcpOAuthInteractionCompletion>;
	deny: (uid: string) => Promise<IMcpOAuthInteractionCompletion>;
}

const interactionPath = `/modules/${MCP_MODULE_PREFIX}/oauth/interactions/{uid}` as const;
const approvePath = `/modules/${MCP_MODULE_PREFIX}/oauth/interactions/{uid}/approve` as const;
const denyPath = `/modules/${MCP_MODULE_PREFIX}/oauth/interactions/{uid}/deny` as const;

export const useMcpOAuthInteraction = (): IUseMcpOAuthInteraction => {
	const backend = useBackend();
	const interaction = ref<IMcpOAuthInteraction | null>(null);
	const loading = ref(false);
	const working = ref(false);
	const error = ref<Error | null>(null);

	const load = async (uid: string): Promise<IMcpOAuthInteraction> => {
		loading.value = true;
		error.value = null;

		try {
			const { data, response } = await backend.client.GET(interactionPath, { params: { path: { uid } } });

			if (!data) throw new McpApiException('Failed to load the MCP OAuth interaction.', response.status);

			interaction.value = McpOAuthInteractionSchema.parse(snakeToCamel(data.data));
			return interaction.value;
		} catch (caught) {
			error.value = caught instanceof Error ? caught : new Error('Failed to load the MCP OAuth interaction.');
			throw error.value;
		} finally {
			loading.value = false;
		}
	};

	const approve = async (
		uid: string,
		scopes: McpOAuthScope[],
		expiresInDays: number,
	): Promise<IMcpOAuthInteractionCompletion> => {
		working.value = true;
		error.value = null;

		try {
			const { data, response } = await backend.client.POST(approvePath, {
				params: { path: { uid } },
				body: { data: { scopes, expires_in_days: expiresInDays } },
			});

			if (!data) throw new McpApiException('Failed to approve the MCP OAuth interaction.', response.status);

			return McpOAuthInteractionCompletionSchema.parse(snakeToCamel(data.data));
		} catch (caught) {
			error.value = caught instanceof Error ? caught : new Error('Failed to approve the MCP OAuth interaction.');
			throw error.value;
		} finally {
			working.value = false;
		}
	};

	const deny = async (uid: string): Promise<IMcpOAuthInteractionCompletion> => {
		working.value = true;
		error.value = null;

		try {
			const { data, response } = await backend.client.POST(denyPath, { params: { path: { uid } } });

			if (!data) throw new McpApiException('Failed to deny the MCP OAuth interaction.', response.status);

			return McpOAuthInteractionCompletionSchema.parse(snakeToCamel(data.data));
		} catch (caught) {
			error.value = caught instanceof Error ? caught : new Error('Failed to deny the MCP OAuth interaction.');
			throw error.value;
		} finally {
			working.value = false;
		}
	};

	return { interaction, loading, working, error, load, approve, deny };
};
