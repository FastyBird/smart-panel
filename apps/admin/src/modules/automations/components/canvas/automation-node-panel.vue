<template>
	<aside
		class="automation-node-panel"
		:aria-label="title"
		data-test-id="automation-node-panel"
	>
		<!--
			A panel beside the canvas, not `el-drawer`: the drawer traps keyboard focus and covers the cards on
			the right (ADR 0003, decision 1).
		-->
		<header class="automation-node-panel__header">
			<el-icon
				:size="22"
				class="flex-none"
			>
				<icon :icon="nodeIcon(props.node.type, props.nodeType)" />
			</el-icon>
			<div class="min-w-0 grow-1">
				<el-text
					size="small"
					type="info"
					tag="div"
					class="uppercase leading-4!"
				>
					{{ kindLabel(props.nodeType?.kind ?? null) }}
				</el-text>
				<el-text
					tag="div"
					class="font-600!"
					truncated
				>
					{{ title }}
				</el-text>
			</div>
			<el-button
				link
				:aria-label="t('automations.buttons.close.title')"
				data-test-id="close-node-panel"
				@click="emit('close')"
			>
				<template #icon>
					<icon icon="mdi:close" />
				</template>
			</el-button>
		</header>

		<el-scrollbar class="grow-1 min-h-0">
			<div class="p-3">
				<el-text
					v-if="description"
					tag="p"
					size="small"
					type="info"
					class="mt-0! mb-3! leading-4!"
				>
					{{ description }}
				</el-text>

				<el-alert
					v-for="(issue, index) in generalIssues"
					:key="index"
					:title="issueText(issue)"
					:type="issue.severity === 'error' ? 'error' : 'warning'"
					:closable="false"
					show-icon
					class="mb-3!"
				/>

				<el-alert
					v-if="props.nodeType === null"
					:title="t('automations.editor.texts.unknownNodeTypeHint', { type: props.node.type })"
					type="error"
					:closable="false"
					show-icon
				/>

				<!--
					Seam for AU-11: a card with an admin element brings its own form (`automationNodeForm`, resolved
					by `useAutomationNodePlugins`); it takes the same props and emits the same event as the generic form.
				-->
				<automation-node-generic-form
					v-else
					:key="props.node.id"
					:node-type="props.nodeType"
					:config="props.node.config"
					:field-errors="fieldErrors"
					:disabled="props.disabled"
					@update:config="(config: Record<string, unknown>, field: string): void => emit('update:config', config, field)"
					@update:invalid="(invalid: boolean): void => emit('update:invalid', invalid)"
				/>
			</div>
		</el-scrollbar>

		<footer
			v-if="!props.disabled"
			class="automation-node-panel__footer"
		>
			<el-button
				type="danger"
				plain
				size="small"
				data-test-id="remove-node"
				@click="emit('remove')"
			>
				<template #icon>
					<icon icon="mdi:trash-can-outline" />
				</template>
				{{ t('automations.editor.buttons.removeNode.title') }}
			</el-button>
		</footer>
	</aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElIcon, ElScrollbar, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { describeConfigSchema, issueFieldKey } from '../../automations.config-schema';
import { useAutomationNodePresentation } from '../../composables/useAutomationNodePresentation';
import type { IAutomationGraphIssue } from '../../store/automations.store.types';

import AutomationNodeGenericForm from './automation-node-generic-form.vue';
import type { IAutomationNodePanelProps } from './automation-node-panel.types';

defineOptions({
	name: 'AutomationNodePanel',
});

const props = withDefaults(defineProps<IAutomationNodePanelProps>(), {
	issues: () => [],
	disabled: false,
});

const emit = defineEmits<{
	(e: 'update:config', config: Record<string, unknown>, field: string): void;
	// Text typed into the form does not parse, so the configuration does not hold it yet
	(e: 'update:invalid', invalid: boolean): void;
	(e: 'remove'): void;
	(e: 'close'): void;
}>();

const { t } = useI18n();

const { kindLabel, nodeTitle, nodeDescription, nodeIcon, issueText } = useAutomationNodePresentation();

const title = computed<string>((): string => nodeTitle(props.node.type, props.nodeType));

const description = computed<string>((): string => nodeDescription(props.node.type, props.nodeType));

const formFieldKeys = computed<Set<string>>(
	(): Set<string> => new Set(props.nodeType ? describeConfigSchema(props.nodeType.configSchema).fields.map((field) => field.key) : [])
);

// An issue about a field the form shows goes under that field, everything else above the form
const fieldOf = (issue: IAutomationGraphIssue): string | null => {
	const key = issueFieldKey(issue.field);

	return key !== null && formFieldKeys.value.has(key) ? key : null;
};

const generalIssues = computed<IAutomationGraphIssue[]>((): IAutomationGraphIssue[] => props.issues.filter((issue) => fieldOf(issue) === null));

const fieldErrors = computed<Record<string, string[]>>((): Record<string, string[]> => {
	const errors: Record<string, string[]> = {};

	for (const issue of props.issues) {
		const key = fieldOf(issue);

		if (key !== null) {
			errors[key] = [...(errors[key] ?? []), issueText(issue)];
		}
	}

	return errors;
});
</script>

<style scoped lang="scss">
.automation-node-panel {
	display: flex;
	flex: 0 0 340px;
	flex-direction: column;
	width: 340px;
	min-height: 0;
	border-left: 1px solid var(--el-border-color);
	background-color: var(--el-bg-color);

	&__header {
		display: flex;
		flex: none;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--el-border-color-lighter);
	}

	&__footer {
		display: flex;
		flex: none;
		justify-content: flex-end;
		padding: 8px 12px;
		border-top: 1px solid var(--el-border-color-lighter);
	}
}
</style>
