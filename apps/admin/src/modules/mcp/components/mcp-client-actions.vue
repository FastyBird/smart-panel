<template>
	<div class="flex flex-wrap gap-1">
		<el-button
			size="small"
			@click="emit('edit', client)"
		>
			{{ t('mcpModule.actions.edit') }}
		</el-button>
		<el-button
			size="small"
			type="warning"
			plain
			@click="emit('rotate', client)"
		>
			{{ t('mcpModule.actions.rotate') }}
		</el-button>
		<el-button
			size="small"
			type="danger"
			plain
			:disabled="client.credentialRevoked"
			@click="emit('revoke', client)"
		>
			{{ t('mcpModule.actions.revoke') }}
		</el-button>
		<el-button
			size="small"
			type="danger"
			text
			@click="emit('delete', client)"
		>
			{{ t('mcpModule.actions.delete') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

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
