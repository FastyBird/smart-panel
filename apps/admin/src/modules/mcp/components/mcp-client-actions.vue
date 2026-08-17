<template>
	<el-button
		size="small"
		plain
		data-test-id="edit-mcp-client"
		@click.stop="emit('edit', client)"
	>
		<template #icon>
			<icon icon="mdi:pencil" />
		</template>

		{{ t('mcpModule.actions.edit') }}
	</el-button>
	<el-button
		size="small"
		plain
		class="ml-1!"
		:title="t('mcpModule.actions.rotate')"
		data-test-id="rotate-mcp-client"
		@click.stop="emit('rotate', client)"
	>
		<template #icon>
			<icon icon="mdi:autorenew" />
		</template>
	</el-button>
	<el-button
		size="small"
		type="warning"
		plain
		class="ml-1!"
		:disabled="client.credentialRevoked"
		:title="t('mcpModule.actions.revoke')"
		data-test-id="revoke-mcp-client"
		@click.stop="emit('revoke', client)"
	>
		<template #icon>
			<icon icon="mdi:key-remove" />
		</template>
	</el-button>
	<el-button
		size="small"
		type="warning"
		plain
		class="ml-1!"
		:title="t('mcpModule.actions.delete')"
		data-test-id="delete-mcp-client"
		@click.stop="emit('delete', client)"
	>
		<template #icon>
			<icon icon="mdi:trash" />
		</template>
	</el-button>
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
