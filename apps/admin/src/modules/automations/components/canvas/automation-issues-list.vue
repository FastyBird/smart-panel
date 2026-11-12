<template>
	<section
		class="automation-issues-list"
		:aria-label="t('automations.editor.headings.issues')"
		data-test-id="automation-issues-list"
	>
		<button
			type="button"
			class="automation-issues-list__header"
			:aria-expanded="expanded"
			@click="expanded = !expanded"
		>
			<el-icon :size="16">
				<icon :icon="expanded ? 'mdi:chevron-down' : 'mdi:chevron-up'" />
			</el-icon>
			<span class="font-600">{{ t('automations.editor.headings.issues') }}</span>
			<el-tag
				v-if="errorCount > 0"
				type="danger"
				size="small"
				disable-transitions
				data-test-id="issues-errors"
			>
				{{ t('automations.editor.texts.errorCount', { count: errorCount }) }}
			</el-tag>
			<el-tag
				v-if="warningCount > 0"
				type="warning"
				size="small"
				disable-transitions
				data-test-id="issues-warnings"
			>
				{{ t('automations.editor.texts.warningCount', { count: warningCount }) }}
			</el-tag>
		</button>

		<el-scrollbar
			v-if="expanded"
			max-height="160px"
		>
			<ul class="automation-issues-list__items">
				<li
					v-for="(item, index) in items"
					:key="index"
					class="automation-issues-list__item"
					:class="`automation-issues-list__item--${item.issue.severity}`"
					:data-test-issue="item.issue.code"
				>
					<el-icon
						:size="16"
						class="flex-none mt-[1px]"
					>
						<icon :icon="item.issue.severity === 'error' ? 'mdi:alert-circle' : 'mdi:alert'" />
					</el-icon>
					<div class="min-w-0">
						<el-link
							v-if="item.nodeId !== null"
							underline="never"
							class="font-600! mr-1"
							data-test-id="issue-node"
							@click="emit('focus', item.nodeId)"
						>
							{{ item.nodeLabel }}
						</el-link>
						<span>{{ item.text }}</span>
					</div>
				</li>
			</ul>
		</el-scrollbar>
	</section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElIcon, ElLink, ElScrollbar, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { issueNodeIds } from '../../automations.graph';
import { useAutomationNodePresentation } from '../../composables/useAutomationNodePresentation';
import type { IAutomationGraphIssue } from '../../store/automations.store.types';

import type { IAutomationIssuesListProps } from './automation-issues-list.types';

defineOptions({
	name: 'AutomationIssuesList',
});

interface IIssueItem {
	issue: IAutomationGraphIssue;
	// The node the entry leads to; null for an issue about the graph as a whole
	nodeId: string | null;
	nodeLabel: string;
	text: string;
}

const props = defineProps<IAutomationIssuesListProps>();

const emit = defineEmits<{
	(e: 'focus', nodeId: string): void;
}>();

const { t } = useI18n();

const { issueText, nodeTitle } = useAutomationNodePresentation();

const expanded = ref<boolean>(true);

const errorCount = computed<number>((): number => props.issues.filter((issue) => issue.severity === 'error').length);

const warningCount = computed<number>((): number => props.issues.length - errorCount.value);

// What stops the save comes first
const items = computed<IIssueItem[]>((): IIssueItem[] =>
	[...props.issues]
		.sort((a, b) => Number(b.severity === 'error') - Number(a.severity === 'error'))
		.map((issue): IIssueItem => {
			const nodeId = issueNodeIds(issue).find((id) => props.graph.nodes.some((node) => node.id === id)) ?? null;
			const node = nodeId === null ? undefined : props.graph.nodes.find((item) => item.id === nodeId);

			return {
				issue,
				nodeId,
				nodeLabel: node ? `${nodeTitle(node.type, props.nodeTypes.find((nodeType) => nodeType.type === node.type) ?? null)}: ` : '',
				text: issueText(issue),
			};
		})
);
</script>

<style scoped lang="scss">
.automation-issues-list {
	flex: none;
	border-top: 1px solid var(--el-border-color);
	background-color: var(--el-bg-color);
	font-size: var(--el-font-size-small);

	&__header {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 12px;
		border: none;
		background: none;
		color: var(--el-text-color-primary);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	&__items {
		margin: 0;
		padding: 0 12px 8px;
		list-style: none;
	}

	&__item {
		display: flex;
		gap: 8px;
		padding: 3px 0;
		color: var(--el-text-color-regular);
		line-height: 1.4;

		&--error .el-icon {
			color: var(--el-color-danger);
		}

		&--warning .el-icon {
			color: var(--el-color-warning);
		}
	}
}
</style>
