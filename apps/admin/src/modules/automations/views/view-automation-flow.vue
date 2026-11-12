<template>
	<div
		class="flex flex-col overflow-hidden h-full"
		data-test-id="automation-flow-view"
	>
		<app-breadcrumbs :items="breadcrumbs" />

		<app-bar-heading
			v-if="!isMDDevice"
			teleport
		>
			<template #icon>
				<icon
					:icon="AUTOMATION_FLOW_ICON"
					class="w[20px] h[20px]"
				/>
			</template>

			<template #title>
				{{ automation?.name ?? t('automations.headings.flow') }}
			</template>

			<template #subtitle>
				{{ t('automations.subHeadings.flow') }}
			</template>
		</app-bar-heading>

		<app-bar-button
			v-if="!isMDDevice"
			:align="AppBarButtonAlign.LEFT"
			:disabled="saving"
			teleport
			small
			@click="onClose"
		>
			<template #icon>
				<el-icon :size="24">
					<icon icon="mdi:chevron-left" />
				</el-icon>
			</template>
		</app-bar-button>

		<view-header
			:heading="automation?.name ?? t('automations.headings.flow')"
			:sub-heading="t('automations.subHeadings.flow')"
			:icon="AUTOMATION_FLOW_ICON"
		>
			<template #extra>
				<el-button
					link
					class="mr-2"
					:disabled="saving"
					@click="onClose"
				>
					{{ t('automations.buttons.backToList.title') }}
				</el-button>
			</template>
		</view-header>

		<div
			v-if="!ready"
			class="flex items-center justify-center grow-1"
		>
			<el-icon
				class="is-loading"
				:size="32"
			>
				<icon icon="mdi:loading" />
			</el-icon>
		</div>

		<!-- A read that failed is not an automation that is gone: it can be tried again -->
		<div
			v-else-if="loadFailed"
			class="flex flex-col items-center justify-center grow-1 gap-4 p-4"
			data-test-id="load-failed"
		>
			<el-icon
				:size="48"
				class="text-gray-300"
			>
				<icon icon="mdi:alert-circle-outline" />
			</el-icon>
			<div class="text-gray-500">{{ t('automations.messages.loadFailed') }}</div>
			<div class="flex gap-2">
				<el-button @click="onClose">
					{{ t('automations.buttons.backToList.title') }}
				</el-button>
				<el-button
					type="primary"
					data-test-id="retry-load"
					@click="loadEditor"
				>
					{{ t('automations.buttons.retry.title') }}
				</el-button>
			</div>
		</div>

		<entity-not-found
			v-else-if="notFound || !automation"
			icon="mdi:robot-off-outline"
			:message="t('automations.messages.notFound')"
			:button-label="t('automations.buttons.backToList.title')"
			@back="onClose"
		/>

		<div
			v-else
			class="automation-flow flex flex-col grow-1 min-h-0 overflow-hidden lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 mt-2"
		>
			<div class="automation-flow__bar flex flex-row flex-wrap items-center gap-2 px-3 py-2">
				<template v-if="!readonly">
					<el-button-group>
						<el-tooltip
							:content="t('automations.editor.buttons.undo.title')"
							placement="bottom"
						>
							<el-button
								:disabled="!canUndo"
								:aria-label="t('automations.editor.buttons.undo.title')"
								data-test-id="undo"
								@click="undo"
							>
								<template #icon>
									<icon icon="mdi:undo" />
								</template>
							</el-button>
						</el-tooltip>
						<el-tooltip
							:content="t('automations.editor.buttons.redo.title')"
							placement="bottom"
						>
							<el-button
								:disabled="!canRedo"
								:aria-label="t('automations.editor.buttons.redo.title')"
								data-test-id="redo"
								@click="redo"
							>
								<template #icon>
									<icon icon="mdi:redo" />
								</template>
							</el-button>
						</el-tooltip>
					</el-button-group>

					<el-button
						type="danger"
						plain
						:disabled="selectedNodeIds.length + selectedEdgeIds.length === 0"
						data-test-id="remove-selected"
						@click="canvas?.removeSelected()"
					>
						<template #icon>
							<icon icon="mdi:trash-can-outline" />
						</template>
						{{ t('automations.editor.buttons.removeSelected.title') }}
					</el-button>
				</template>

				<el-tag
					v-else
					type="info"
					disable-transitions
					data-test-id="readonly-tag"
				>
					{{ t('automations.editor.texts.readonly') }}
				</el-tag>

				<el-tag
					v-if="hasUnsaved"
					type="warning"
					disable-transitions
					data-test-id="unsaved-tag"
				>
					{{ t('automations.editor.texts.unsaved') }}
				</el-tag>

				<div class="grow-1" />

				<el-tooltip
					:content="t(`automations.modes.${automation.mode}.description`)"
					placement="bottom"
				>
					<el-tag
						type="info"
						disable-transitions
					>
						{{ t(`automations.modes.${automation.mode}.title`) }}
					</el-tag>
				</el-tooltip>

				<el-tooltip
					v-if="automation.status !== AutomationStatus.ok"
					:content="t(`automations.statuses.${automation.status}.description`)"
					placement="bottom"
				>
					<el-tag
						:type="AUTOMATION_STATUS_COLORS[automation.status]"
						disable-transitions
					>
						{{ t(`automations.statuses.${automation.status}.title`) }}
					</el-tag>
				</el-tooltip>

				<!-- The switch follows the store: it moves once the backend has accepted the change -->
				<el-switch
					:model-value="automation.enabled"
					:loading="saving"
					:active-text="t('automations.fields.enabled')"
					:aria-label="t('automations.fields.enabled')"
					data-test-id="toggle-automation"
					@change="(value: string | number | boolean): void => onToggleEnabled(value === true)"
				/>

				<el-button
					v-if="!readonly"
					type="primary"
					:loading="saving"
					:disabled="saving || !isDirty || hasInvalidDraft"
					data-test-id="save-flow"
					@click="onSave"
				>
					{{ t('automations.buttons.save.title') }}
				</el-button>
			</div>

			<el-alert
				v-if="conflict"
				:title="t('automations.editor.conflict.title')"
				type="warning"
				:closable="false"
				show-icon
				class="automation-flow__alert"
				data-test-id="conflict-alert"
			>
				<p class="mt-0 mb-2">{{ t('automations.editor.conflict.description') }}</p>
				<el-button
					size="small"
					:disabled="saving"
					data-test-id="conflict-reload"
					@click="onReloadLatest"
				>
					{{ t('automations.editor.conflict.reload') }}
				</el-button>
				<el-button
					size="small"
					type="warning"
					:loading="saving"
					data-test-id="conflict-overwrite"
					@click="onOverwrite"
				>
					{{ t('automations.editor.conflict.overwrite') }}
				</el-button>
			</el-alert>

			<el-alert
				v-if="hasSeparateFlows"
				:title="t('automations.editor.texts.separateFlows')"
				type="warning"
				show-icon
				class="automation-flow__alert"
				data-test-id="separate-flows-alert"
			/>

			<div class="flex flex-row grow-1 min-h-0">
				<el-scrollbar
					v-if="!readonly"
					class="automation-flow__palette"
				>
					<automation-palette
						:node-types="nodeTypes"
						@add="onPaletteAdd"
					/>
				</el-scrollbar>

				<div class="flex flex-col grow-1 min-w-0 min-h-0">
					<div class="grow-1 min-h-0">
						<automation-canvas
							:key="`${automation.id}-${readonly ? 'view' : 'edit'}`"
							ref="canvas"
							:graph="graph"
							:node-types="nodeTypes"
							:issues="issues"
							:readonly="readonly"
							:initial-view="readonly ? 'first-trigger' : 'fit'"
							@update:graph="onGraphUpdate"
							@select="onSelect"
							@reject="onReject"
						/>
					</div>

					<automation-issues-list
						v-if="issues.length > 0"
						:issues="issues"
						:graph="graph"
						:node-types="nodeTypes"
						@focus="onFocusNode"
					/>
				</div>

				<automation-node-panel
					v-if="panelNode"
					:node="panelNode"
					:node-type="getNodeType(panelNode.type)"
					:issues="panelIssues"
					@update:config="onConfigUpdate"
					@update:invalid="onDraftInvalid"
					@remove="onRemoveNode"
					@close="panelDismissedFor = panelNode.id"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationNormalized, type RouteLocationResolvedGeneric, onBeforeRouteLeave, onBeforeRouteUpdate, useRouter } from 'vue-router';

import { ElAlert, ElButton, ElButtonGroup, ElIcon, ElMessageBox, ElScrollbar, ElSwitch, ElTag, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useEventListener } from '@vueuse/core';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	EntityNotFound,
	ViewHeader,
	useBreakpoints,
	useFlashMessage,
} from '../../../common';
import {
	AUTOMATION_FLOW_ICON,
	AUTOMATION_STATUS_COLORS,
	type AutomationConnectionRejection,
	AutomationStatus,
	RouteNames,
} from '../automations.constants';
import { AutomationsApiException } from '../automations.exceptions';
import { issueNodeIds } from '../automations.graph';
import { AutomationCanvas, AutomationIssuesList, AutomationNodePanel, AutomationPalette } from '../components/components';
import { useAutomationEditor, useAutomationNodeTypes } from '../composables/composables';
import type { IAutomationGraph, IAutomationGraphIssue, IAutomationGraphNode } from '../store/automations.store.types';

import type { IViewAutomationFlowProps } from './view-automation-flow.types';

defineOptions({
	name: 'ViewAutomationFlow',
});

const props = defineProps<IViewAutomationFlowProps>();

const router = useRouter();
const { t } = useI18n();

const flashMessage = useFlashMessage();

const { isMDDevice } = useBreakpoints();

const { nodeTypes, fetchNodeTypes, getNodeType } = useAutomationNodeTypes();

const {
	automation,
	graph,
	issues,
	saving,
	conflict,
	isDirty,
	hasSeparateFlows,
	canUndo,
	canRedo,
	load,
	updateGraph,
	updateNodeConfig,
	undo,
	redo,
	save,
	setEnabled,
	reloadLatest,
	overwrite,
} = useAutomationEditor({ id: props.id });

useMeta({
	title: t('automations.headings.flow'),
});

const canvas = ref<InstanceType<typeof AutomationCanvas> | null>(null);

const ready = ref<boolean>(false);
const loadFailed = ref<boolean>(false);
const notFound = ref<boolean>(false);

// Editing needs room for the palette, the canvas and the form: below the `md` breakpoint the flow can be
// looked at, and the automation enabled or disabled, but not changed
const readonly = computed<boolean>((): boolean => !isMDDevice.value);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('automations.breadcrumbs.automations'),
			route: router.resolve({ name: RouteNames.AUTOMATIONS }),
		},
		{
			label: automation.value?.name ?? t('automations.breadcrumbs.flow'),
			route: router.resolve({ name: RouteNames.AUTOMATIONS_FLOW, params: { id: props.id } }),
		},
	]
);

/*
 * Selection and the panel of the selected card
 */

const selectedNodeIds = ref<string[]>([]);
const selectedEdgeIds = ref<string[]>([]);
const panelDismissedFor = ref<string | null>(null);

const selectedNode = computed<IAutomationGraphNode | null>((): IAutomationGraphNode | null =>
	selectedNodeIds.value.length === 1 ? (graph.value.nodes.find((node) => node.id === selectedNodeIds.value[0]) ?? null) : null
);

const panelNode = computed<IAutomationGraphNode | null>((): IAutomationGraphNode | null =>
	!readonly.value && selectedNode.value !== null && panelDismissedFor.value !== selectedNode.value.id ? selectedNode.value : null
);

const panelIssues = computed<IAutomationGraphIssue[]>((): IAutomationGraphIssue[] => {
	const id = panelNode.value?.id;

	return typeof id === 'string' ? issues.value.filter((issue) => issueNodeIds(issue).includes(id)) : [];
});

// The panel takes its room from the canvas; a card that ends up behind it is brought back into view
watch(
	(): string | null => panelNode.value?.id ?? null,
	(id: string | null): void => {
		if (id !== null) {
			void nextTick((): void => {
				canvas.value?.revealNode(id);
			});
		}
	}
);

// The form of the panel holds text that does not parse: it has not reached the graph, so the graph is not
// saved without it, and leaving would lose it. The text goes with the form, so only the open panel counts.
const invalidDraftFor = ref<string | null>(null);

const hasInvalidDraft = computed<boolean>((): boolean => panelNode.value !== null && invalidDraftFor.value === panelNode.value.id);

const hasUnsaved = computed<boolean>((): boolean => isDirty.value || hasInvalidDraft.value);

const onDraftInvalid = (invalid: boolean): void => {
	invalidDraftFor.value = invalid && panelNode.value !== null ? panelNode.value.id : null;
};

const onSelect = (nodeIds: string[], edgeIds: string[]): void => {
	selectedNodeIds.value = nodeIds;
	selectedEdgeIds.value = edgeIds;
	panelDismissedFor.value = null;
};

/*
 * Edits
 */

const onGraphUpdate = (next: IAutomationGraph): void => {
	updateGraph(next);
};

const onConfigUpdate = (config: Record<string, unknown>, field: string): void => {
	if (panelNode.value) {
		updateNodeConfig(panelNode.value.id, config, field);
	}
};

const onPaletteAdd = (type: string): void => {
	canvas.value?.addNode(type);
};

const onRemoveNode = (): void => {
	if (panelNode.value) {
		canvas.value?.removeNode(panelNode.value.id);
	}
};

const onFocusNode = (nodeId: string): void => {
	panelDismissedFor.value = null;

	canvas.value?.focusNode(nodeId);
};

const onReject = (reason: AutomationConnectionRejection): void => {
	flashMessage.warning(t(`automations.editor.rejections.${reason}`));
};

/*
 * Saving
 */

// Saving now would save the graph without what is typed in the form, and report it saved
const refuseInvalidDraft = (): boolean => {
	if (hasInvalidDraft.value) {
		flashMessage.error(t('automations.editor.messages.invalidDraft'));
	}

	return hasInvalidDraft.value;
};

const onSave = (): void => {
	if (readonly.value || saving.value || refuseInvalidDraft() || !isDirty.value) {
		return;
	}

	void save();
};

const onToggleEnabled = (enabled: boolean): void => {
	void setEnabled(enabled);
};

const onReloadLatest = async (): Promise<void> => {
	if (hasUnsaved.value) {
		try {
			await ElMessageBox.confirm(t('automations.editor.conflict.confirmReload'), t('automations.headings.discard'), {
				confirmButtonText: t('automations.buttons.yes.title'),
				cancelButtonText: t('automations.buttons.no.title'),
				type: 'warning',
			});
		} catch {
			return;
		}
	}

	try {
		await reloadLatest();
	} catch {
		flashMessage.error(t('automations.messages.requestError'));
	}
};

const onOverwrite = (): void => {
	if (refuseInvalidDraft()) {
		return;
	}

	void overwrite();
};

/*
 * Keyboard. Inside a text field the browser's own undo is what the user expects, so the shortcuts of the
 * canvas stand back there; saving works from anywhere.
 */

const isTextTarget = (target: EventTarget | null): boolean => {
	return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
};

useEventListener(window, 'keydown', (event: KeyboardEvent): void => {
	if (readonly.value || !(event.ctrlKey || event.metaKey) || event.altKey) {
		return;
	}

	const key = event.key.toLowerCase();

	if (key === 's') {
		event.preventDefault();

		onSave();

		return;
	}

	if (isTextTarget(event.target)) {
		return;
	}

	if (key === 'z' && !event.shiftKey) {
		event.preventDefault();

		undo();
	} else if (key === 'y' || (key === 'z' && event.shiftKey)) {
		event.preventDefault();

		redo();
	}
});

/*
 * Leaving with unsaved changes
 */

useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent): void => {
	if (hasUnsaved.value) {
		event.preventDefault();
		// Still what some browsers need to show their prompt
		event.returnValue = '';
	}
});

const confirmLeave = async (): Promise<boolean> => {
	// A save on its way cannot be taken back: leaving now would look like discarding what is then saved anyway
	if (saving.value) {
		return false;
	}

	if (!hasUnsaved.value) {
		return true;
	}

	try {
		await ElMessageBox.confirm(t('automations.texts.confirmDiscard'), t('automations.headings.discard'), {
			confirmButtonText: t('automations.buttons.yes.title'),
			cancelButtonText: t('automations.buttons.no.title'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

onBeforeRouteLeave(confirmLeave);

// Going from one flow straight to another reuses the route: the view is keyed by the automation where the
// route renders it (`view-automation-flow-route.vue`), so the other automation gets an editor of its own,
// and this one is left only as any other way out of it is
onBeforeRouteUpdate(
	(to: RouteLocationNormalized, from: RouteLocationNormalized): Promise<boolean> | boolean => to.params.id === from.params.id || confirmLeave()
);

const onClose = (): void => {
	// The guard above asks before anything unsaved is left behind
	router.push({ name: RouteNames.AUTOMATIONS });
};

// Not found or not reachable: the view says which instead of the canvas
const loadEditor = async (): Promise<void> => {
	ready.value = false;
	loadFailed.value = false;
	notFound.value = false;

	try {
		await Promise.all([fetchNodeTypes(), load()]);
	} catch (error: unknown) {
		notFound.value = error instanceof AutomationsApiException && error.code === 404;
		loadFailed.value = !notFound.value;
	} finally {
		ready.value = true;
	}
};

onBeforeMount(loadEditor);
</script>

<style scoped lang="scss">
.automation-flow {
	border: 1px solid var(--el-border-color);
	border-radius: var(--el-border-radius-base);
	background-color: var(--el-bg-color);

	&__bar {
		flex: none;
		border-bottom: 1px solid var(--el-border-color);
	}

	&__alert {
		flex: none;
		border-radius: 0;
	}

	&__palette {
		flex: 0 0 230px;
		border-right: 1px solid var(--el-border-color);
	}
}
</style>
