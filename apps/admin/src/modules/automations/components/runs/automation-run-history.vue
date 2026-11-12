<template>
	<section
		class="automation-run-history"
		:aria-label="t('automations.runs.headings.history')"
		data-test-id="automation-run-history"
	>
		<div class="automation-run-history__header">
			<span class="font-600">{{ t('automations.runs.headings.history') }}</span>
			<el-tag
				v-if="props.runs.length > 0"
				size="small"
				type="info"
				disable-transitions
			>
				{{ props.runs.length }}
			</el-tag>
			<el-icon
				v-if="props.loading"
				class="is-loading"
				:size="14"
			>
				<icon icon="mdi:loading" />
			</el-icon>
			<div class="grow-1" />
			<el-button
				link
				size="small"
				:disabled="props.loading"
				:aria-label="t('automations.runs.buttons.reload.title')"
				data-test-id="reload-runs"
				@click="emit('reload')"
			>
				<template #icon>
					<icon icon="mdi:refresh" />
				</template>
			</el-button>
		</div>

		<!-- The runs read before stay listed when a later read fails: they may be out of date -->
		<div
			v-if="props.failed"
			class="automation-run-history__empty"
			role="alert"
			data-test-id="runs-load-failed"
		>
			{{ props.runs.length === 0 ? t('automations.runs.texts.loadFailed') : t('automations.runs.texts.reloadFailed') }}
		</div>

		<div
			v-else-if="props.runs.length === 0"
			class="automation-run-history__empty"
			data-test-id="runs-empty"
		>
			{{ props.loading ? t('automations.runs.texts.loading') : t('automations.runs.texts.empty') }}
		</div>

		<el-scrollbar
			v-if="props.runs.length > 0"
			max-height="200px"
		>
			<ul class="automation-run-history__items">
				<li
					v-for="item in items"
					:key="item.run.id"
				>
					<button
						type="button"
						class="automation-run-history__item"
						:class="{ 'automation-run-history__item--selected': item.run.id === props.selectedRunId }"
						:aria-pressed="item.run.id === props.selectedRunId"
						:data-test-run="item.run.id"
						data-test-id="run-item"
						@click="emit('select', item.run.id)"
					>
						<el-tag
							:type="AUTOMATION_RUN_RECORD_STATUS_COLORS[item.run.status]"
							size="small"
							disable-transitions
							class="flex-none"
							data-test-id="run-status"
						>
							{{ runStatusLabel(item.run.status) }}
						</el-tag>
						<span
							class="automation-run-history__trigger"
							data-test-id="run-trigger"
						>
							<el-icon
								v-if="item.run.manual"
								:size="14"
								class="flex-none"
							>
								<icon icon="mdi:gesture-tap" />
							</el-icon>
							{{ item.trigger }}
						</span>
						<span
							class="automation-run-history__time"
							data-test-id="run-time"
						>
							{{ item.time }}
						</span>
					</button>
				</li>
			</ul>
		</el-scrollbar>
	</section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElScrollbar, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AUTOMATION_RUN_RECORD_STATUS_COLORS } from '../../automations.constants';
import { useAutomationRunPresentation } from '../../composables/useAutomationRunPresentation';
import type { IAutomationRun } from '../../store/runs.store.types';

import type { IAutomationRunHistoryProps } from './automation-run-history.types';

defineOptions({
	name: 'AutomationRunHistory',
});

interface IRunItem {
	run: IAutomationRun;
	trigger: string;
	time: string;
}

const props = withDefaults(defineProps<IAutomationRunHistoryProps>(), {
	selectedRunId: null,
	loading: false,
	failed: false,
});

const emit = defineEmits<{
	(e: 'select', runId: string): void;
	(e: 'reload'): void;
}>();

const { t } = useI18n();

const { runStatusLabel, dateText, durationText, nodeLabel } = useAutomationRunPresentation();

const items = computed<IRunItem[]>((): IRunItem[] =>
	props.runs.map((run): IRunItem => {
		const trigger = nodeLabel(run.triggerNodeId, props.graph, props.nodeTypes) ?? t('automations.runs.texts.unknownTrigger');

		return {
			run,
			trigger: run.manual ? t('automations.runs.texts.manual', { trigger }) : trigger,
			time:
				run.durationMs !== null
					? t('automations.runs.texts.startedFor', { time: dateText(run.startedAt), duration: durationText(run.durationMs) })
					: dateText(run.startedAt),
		};
	})
);
</script>

<style scoped lang="scss">
.automation-run-history {
	flex: none;
	border-top: 1px solid var(--el-border-color);
	background-color: var(--el-bg-color);
	font-size: var(--el-font-size-small);

	&__header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		color: var(--el-text-color-primary);
	}

	&__empty {
		padding: 0 12px 10px;
		color: var(--el-text-color-secondary);
	}

	&__items {
		margin: 0;
		padding: 0 8px 8px;
		list-style: none;
	}

	&__item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 4px;
		border: none;
		border-radius: var(--el-border-radius-base);
		background: none;
		color: var(--el-text-color-regular);
		font: inherit;
		text-align: left;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			background-color: var(--el-fill-color-light);
		}

		&--selected {
			background-color: var(--el-color-primary-light-9);
		}
	}

	&__trigger {
		display: inline-flex;
		flex: 1 1 auto;
		align-items: center;
		gap: 4px;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__time {
		flex: none;
		color: var(--el-text-color-secondary);
		font-size: var(--el-font-size-extra-small);
	}
}
</style>
