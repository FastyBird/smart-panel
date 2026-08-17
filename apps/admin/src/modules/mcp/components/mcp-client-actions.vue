<template>
	<div class="flex flex-wrap gap-1">
		<el-button
			size="small"
			plain
			data-test-id="edit-mcp-client"
			@click="emit('edit', client)"
		>
			<template #icon>
				<icon icon="mdi:pencil" />
			</template>

			{{ t('mcpModule.actions.edit') }}
		</el-button>
		<el-button
			size="small"
			type="warning"
			plain
			data-test-id="rotate-mcp-client"
			@click="emit('rotate', client)"
		>
			<template #icon>
				<icon icon="mdi:autorenew" />
			</template>

			{{ t('mcpModule.actions.rotate') }}
		</el-button>
		<el-button
			size="small"
			type="danger"
			plain
			:disabled="client.credentialRevoked"
			data-test-id="revoke-mcp-client"
			@click="emit('revoke', client)"
		>
			<template #icon>
				<icon icon="mdi:key-remove" />
			</template>

			{{ t('mcpModule.actions.revoke') }}
		</el-button>
		<el-button
			size="small"
			type="danger"
			plain
			data-test-id="delete-mcp-client"
			@click="emit('delete', client)"
		>
			<template #icon>
				<icon icon="mdi:trash" />
			</template>

			{{ t('mcpModule.actions.delete') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IMcpClient } from '../schemas/client.types';

defineOptions({ name: 'McpClientActions' });

defineProps<{ client: IMcpClient }>();

const emit = defineEmits<{
	(e: 'edit', client: IMcpClient): void;
	(e: 'rotate', client: IMcpClient): void;
	(e: 'revoke', client: IMcpClient): void;
	(e: 'delete', client: IMcpClient): void;
}>();

const { t } = useI18n();
</script>
