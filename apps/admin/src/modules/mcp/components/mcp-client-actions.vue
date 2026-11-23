<template>
	<div
		class="inline-flex items-center gap-1"
		@click.stop
	>
		<!-- Spec section 4: icon-only for edit and more; rotate in the menu, the destructive actions last after a
		     divider. The row opens the client on a click, so a click here stays here -->
		<el-tooltip
			:content="t('mcpModule.actions.edit')"
			placement="top"
		>
			<el-button
				:aria-label="t('mcpModule.aria.edit', { name: props.client.name })"
				text
				circle
				data-test-id="edit-mcp-client"
				@click="emit('edit', props.client)"
			>
				<template #icon>
					<icon icon="mdi:pencil" />
				</template>
			</el-button>
		</el-tooltip>

		<el-tooltip
			:content="t('mcpModule.actions.more')"
			placement="top"
		>
			<el-dropdown
				trigger="click"
				placement="bottom-end"
				@command="onCommand"
			>
				<el-button
					:aria-label="t('mcpModule.aria.more', { name: props.client.name })"
					text
					circle
					data-test-id="more-mcp-client"
				>
					<template #icon>
						<icon icon="mdi:dots-horizontal" />
					</template>
				</el-button>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							command="rotate"
							data-test-id="rotate-mcp-client"
						>
							{{ t('mcpModule.actions.rotate') }}
						</el-dropdown-item>
						<el-dropdown-item
							:disabled="props.client.credentialRevoked"
							command="revoke"
							divided
							class="text-danger!"
							data-test-id="revoke-mcp-client"
						>
							{{ t('mcpModule.actions.revoke') }}
						</el-dropdown-item>
						<el-dropdown-item
							command="delete"
							class="text-danger!"
							data-test-id="delete-mcp-client"
						>
							{{ t('mcpModule.actions.delete') }}
						</el-dropdown-item>
					</el-dropdown-menu>
				</template>
			</el-dropdown>
		</el-tooltip>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IMcpClient } from '../schemas/client.types';

defineOptions({ name: 'McpClientActions' });

const props = defineProps<{ client: IMcpClient }>();

const emit = defineEmits<{
	(e: 'edit', client: IMcpClient): void;
	(e: 'rotate', client: IMcpClient): void;
	(e: 'revoke', client: IMcpClient): void;
	(e: 'delete', client: IMcpClient): void;
}>();

const { t } = useI18n();

type ClientCommand = 'rotate' | 'revoke' | 'delete';

const onCommand = (command: ClientCommand): void => {
	switch (command) {
		case 'rotate':
			emit('rotate', props.client);
			break;
		case 'revoke':
			emit('revoke', props.client);
			break;
		default:
			emit('delete', props.client);
	}
};
</script>
