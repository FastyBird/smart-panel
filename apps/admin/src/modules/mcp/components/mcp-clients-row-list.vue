<template>
	<!-- Phone (template 1): a list of rows instead of the table; a row opens the client -->
	<mcp-clients-empty
		v-if="props.items.length === 0"
		:loading="props.loading"
		:load-failed="props.loadFailed"
		:filters-active="props.filtersActive"
		@reset-filters="emit('reset-filters')"
		@retry="emit('retry')"
	/>

	<ul
		v-else
		class="m-0 p-0 list-none"
		data-test-id="mcp-clients-row-list"
	>
		<li
			v-for="client in props.items"
			:key="client.id"
			class="flex items-center gap-2 min-h-14 px-3 py-2 border-b border-b-solid border-light last:border-b-0"
		>
			<button
				class="flex items-center gap-3 flex-1 min-w-0 p-0 border-0 bg-transparent text-left font-inherit cursor-pointer"
				type="button"
				data-test-id="mcp-clients-row"
				@click="emit('edit', client)"
			>
				<span
					class="flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-fill-light text-regular"
					aria-hidden="true"
				>
					<icon
						:icon="MCP_CLIENT_ICON"
						width="20"
						height="20"
					/>
				</span>
				<span class="flex flex-col flex-1 min-w-0">
					<span class="text-card-title truncate">{{ client.name }}</span>
					<span class="text-help truncate">{{ capabilitiesLabel(client) }}</span>
				</span>
				<status-tag
					:status="MCP_CLIENT_STATUS_TAGS[resolveMcpClientStatus(client)]"
					:label="t(`mcpModule.status.${resolveMcpClientStatus(client)}`)"
				/>
			</button>

			<mcp-client-actions
				:client="client"
				@edit="emit('edit', $event)"
				@rotate="emit('rotate', $event)"
				@revoke="emit('revoke', $event)"
				@delete="emit('delete', $event)"
			/>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import { StatusTag } from '../../../common';
import { MCP_CLIENT_ICON } from '../mcp.constants';
import { MCP_CLIENT_STATUS_TAGS, resolveMcpClientStatus } from '../mcp.utils';
import type { IMcpClient } from '../schemas/client.types';

import McpClientActions from './mcp-client-actions.vue';
import McpClientsEmpty from './mcp-clients-empty.vue';

defineOptions({
	name: 'McpClientsRowList',
});

const props = withDefaults(defineProps<{ items: IMcpClient[]; loading: boolean; loadFailed?: boolean; filtersActive: boolean }>(), {
	loadFailed: false,
});

const emit = defineEmits<{
	(e: 'edit', client: IMcpClient): void;
	(e: 'rotate', client: IMcpClient): void;
	(e: 'revoke', client: IMcpClient): void;
	(e: 'delete', client: IMcpClient): void;
	(e: 'reset-filters'): void;
	(e: 'retry'): void;
}>();

const { t } = useI18n();

const capabilitiesLabel = (client: IMcpClient): string =>
	client.capabilities.length === 0
		? t('mcpModule.clients.none')
		: client.capabilities.map((capability) => t(`mcpModule.capabilities.${capability}.title`)).join(', ');
</script>
