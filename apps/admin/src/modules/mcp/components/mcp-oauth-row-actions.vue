<template>
	<div
		class="inline-flex items-center gap-1"
		@click.stop
	>
		<!-- Spec section 4: icon-only for edit and more; Revoke is destructive, so it lives in the menu -->
		<el-tooltip
			v-if="props.editable"
			:content="t('mcpModule.actions.edit')"
			placement="top"
		>
			<el-button
				:aria-label="t('mcpModule.aria.edit', { name: props.name })"
				:disabled="props.editDisabled"
				text
				circle
				data-test-id="mcp-oauth-row-edit"
				@click="emit('edit')"
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
				@command="emit('revoke')"
			>
				<el-button
					:aria-label="t('mcpModule.aria.more', { name: props.name })"
					text
					circle
					data-test-id="mcp-oauth-row-more"
				>
					<template #icon>
						<icon icon="mdi:dots-horizontal" />
					</template>
				</el-button>

				<template #dropdown>
					<el-dropdown-menu>
						<el-dropdown-item
							:disabled="props.revokeDisabled"
							command="revoke"
							class="text-danger!"
							data-test-id="mcp-oauth-row-revoke"
						>
							{{ t('mcpModule.actions.revoke') }}
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

defineOptions({ name: 'McpOAuthRowActions' });

const props = withDefaults(
	defineProps<{
		/** The row's client name, for the accessible labels */
		name: string;
		editable?: boolean;
		editDisabled?: boolean;
		revokeDisabled?: boolean;
	}>(),
	{
		editable: false,
		editDisabled: false,
		revokeDisabled: false,
	}
);

const emit = defineEmits<{
	(e: 'edit'): void;
	(e: 'revoke'): void;
}>();

const { t } = useI18n();
</script>
