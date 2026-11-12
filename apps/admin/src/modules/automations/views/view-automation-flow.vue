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
								@click="onUndo"
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
								@click="onRedo"
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

				<automation-test-button
					:triggers="testTriggers"
					:disabled-reason="testDisabledReason"
					:loading="testing"
					@test="onTest"
				/>

				<el-tooltip
					:content="t('automations.runs.buttons.history.title')"
					placement="bottom"
				>
					<el-button
						:type="showHistory ? 'primary' : 'default'"
						:plain="showHistory"
						:aria-label="t('automations.runs.buttons.history.title')"
						:aria-pressed="showHistory"
						data-test-id="toggle-run-history"
						@click="onToggleHistory"
					>
						<template #icon>
							<icon icon="mdi:history" />
						</template>
					</el-button>
				</el-tooltip>

				<el-button
					v-if="!readonly"
					type="primary"
					:loading="saving"
					:disabled="saving || !isDirty || draftInvalid"
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

			<automation-status-explanation
				v-if="automation.status !== AutomationStatus.ok"
				:status="automation.status"
				:runtime="runtime"
				:graph="graph"
				:node-types="nodeTypes"
				@focus="onFocusNode"
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
					<!-- A run laid over the canvas is only looked at: it never reaches the graph or its undo history -->
					<automation-run-summary
						v-if="shown"
						:shown="shown"
						:graph="graph"
						:node-types="nodeTypes"
						:revision="automation.revision"
						:unsaved="hasUnsaved"
						@focus="onFocusNode"
						@close="closeRun"
					/>

					<div class="grow-1 min-h-0">
						<automation-canvas
							:key="`${automation.id}-${readonly ? 'view' : 'edit'}`"
							ref="canvas"
							:graph="graph"
							:node-types="nodeTypes"
							:issues="shownIssues"
							:summary-component="getCardComponent"
							:readonly="readonly"
							:initial-view="readonly ? 'first-trigger' : 'fit'"
							:run="canvasRun"
							@update:graph="onGraphUpdate"
							@select="onSelect"
							@reject="onReject"
						/>
					</div>

					<automation-issues-list
						v-if="shownIssues.length > 0"
						:issues="shownIssues"
						:graph="graph"
						:node-types="nodeTypes"
						@focus="onFocusNode"
					/>

					<automation-run-history
						v-if="showHistory"
						:runs="runs"
						:selected-run-id="shown?.runId ?? null"
						:loading="runsLoading"
						:failed="runsLoadFailed"
						:graph="graph"
						:node-types="nodeTypes"
						@select="onReplay"
						@reload="fetchRuns"
					/>
				</div>

				<!--
					Rebuilt when text that did not parse is given up. Below the `md` breakpoint it is only hidden, so
					what is typed in it is still there once there is room to edit again.
				-->
				<automation-node-panel
					v-if="panelNode"
					v-show="!readonly"
					:key="`${panelNode.id}:${draftResets}`"
					:node="panelNode"
					:node-type="getNodeType(panelNode.type)"
					:issues="panelIssues"
					:form="getFormComponent(panelNode.type)"
					:disabled="reloading || readonly"
					@update:config="onConfigUpdate"
					@update:invalid="setDraftInvalid"
					@remove="onRemoveNode"
					@close="onClosePanel"
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
	AutomationNodeKind,
	AutomationStatus,
	RouteNames,
} from '../automations.constants';
import { AutomationsApiException, AutomationsTriggerRefusedException } from '../automations.exceptions';
import { issueNodeIds } from '../automations.graph';
import {
	AutomationCanvas,
	AutomationIssuesList,
	AutomationNodePanel,
	AutomationPalette,
	AutomationRunHistory,
	AutomationRunSummary,
	AutomationStatusExplanation,
	AutomationTestButton,
	type IAutomationCanvasRun,
	type IAutomationTestTrigger,
} from '../components/components';
import {
	useAutomationEditor,
	useAutomationNodePlugins,
	useAutomationNodeTypes,
	useAutomationRunPresentation,
	useAutomationRunTrace,
} from '../composables/composables';
import { findSelfTriggeringWrites } from '../nodes/nodes.rules';
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

const { getFormComponent, getCardComponent } = useAutomationNodePlugins();

const {
	automation,
	graph,
	issues,
	saving,
	reloading,
	conflict,
	isDirty,
	draftInvalid,
	draftResets,
	hasUnsaved,
	hasSeparateFlows,
	canUndo,
	canRedo,
	load,
	updateGraph,
	updateNodeConfig,
	setDraftInvalid,
	discardDraft,
	undo,
	redo,
	save,
	setEnabled,
	reloadLatest,
	overwrite,
} = useAutomationEditor({ id: props.id });

const {
	runs,
	runsLoading,
	runsLoadFailed,
	runtime,
	testing,
	shown,
	fetchRuns,
	fetchRuntime,
	test,
	replay,
	close: closeRun,
} = useAutomationRunTrace({
	id: props.id,
	graph,
});

const { nodeLabel, outcomeText, refusalText } = useAutomationRunPresentation();

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

// The node whose form is open. It follows the selection, but text typed into the form that does not parse
// is not left behind without asking: until the user agrees, the form stays open with it.
const panelFor = ref<string | null>(null);

// Kept while the view is read-only, hidden: text typed into the form must not be lost to a narrowed window
const panelNode = computed<IAutomationGraphNode | null>((): IAutomationGraphNode | null =>
	panelFor.value !== null ? (graph.value.nodes.find((node) => node.id === panelFor.value) ?? null) : null
);

// What the backend reported on the last save or check, and what the editor sees in the flow as it is drawn
const shownIssues = computed<IAutomationGraphIssue[]>((): IAutomationGraphIssue[] => [...issues.value, ...findSelfTriggeringWrites(graph.value)]);

const panelIssues = computed<IAutomationGraphIssue[]>((): IAutomationGraphIssue[] => {
	const id = panelNode.value?.id;

	return typeof id === 'string' ? shownIssues.value.filter((issue) => issueNodeIds(issue).includes(id)) : [];
});

// The panel takes its room from the canvas; a card that ends up behind it is brought back into view
watch(
	(): string | null => panelNode.value?.id ?? null,
	(id: string | null): void => {
		if (id !== null && !readonly.value) {
			void nextTick((): void => {
				canvas.value?.revealNode(id);
			});
		}
	}
);

// The text that did not parse goes with the form that held it: once the form is gone (the user agreed, the
// node was removed), nothing is waiting to be saved any more
watch(
	(): string | null => panelNode.value?.id ?? null,
	(): void => {
		setDraftInvalid(false);
	}
);

const confirmDiscardDraft = async (): Promise<boolean> => {
	if (!draftInvalid.value) {
		return true;
	}

	try {
		await ElMessageBox.confirm(t('automations.editor.texts.confirmDiscardDraft'), t('automations.headings.discard'), {
			confirmButtonText: t('automations.buttons.yes.title'),
			cancelButtonText: t('automations.buttons.no.title'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

const showPanel = async (nodeId: string | null): Promise<void> => {
	const keeping = panelFor.value;

	if (nodeId === keeping) {
		return;
	}

	// The form cannot be seen while the view is read-only: it is not asked about, and stays as it is
	if (readonly.value && draftInvalid.value) {
		return;
	}

	if (!(await confirmDiscardDraft())) {
		// The form stays with what is typed in it, and the canvas goes back to its card
		if (keeping !== null && (selectedNodeIds.value.length !== 1 || selectedNodeIds.value[0] !== keeping)) {
			canvas.value?.focusNode(keeping);
		}

		return;
	}

	panelFor.value = nodeId;
};

const onSelect = (nodeIds: string[], edgeIds: string[]): void => {
	selectedNodeIds.value = nodeIds;
	selectedEdgeIds.value = edgeIds;

	void showPanel(nodeIds.length === 1 ? (nodeIds[0] as string) : null);
};

const onClosePanel = (): void => {
	void showPanel(null);
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

const onFocusNode = async (nodeId: string): Promise<void> => {
	await showPanel(nodeId);

	if (readonly.value || panelFor.value === nodeId) {
		canvas.value?.focusNode(nodeId);
	}
};

const onReject = (reason: AutomationConnectionRejection): void => {
	flashMessage.warning(t(`automations.editor.rejections.${reason}`));
};

// A step back or forth replaces the configuration the form shows: text in it that does not parse would
// be lost without asking, so it is given up only once the user agrees
const stepHistory = async (step: () => void): Promise<void> => {
	if (draftInvalid.value) {
		if (!(await confirmDiscardDraft())) {
			return;
		}

		discardDraft();
	}

	step();
};

const onUndo = (): void => {
	void stepHistory(undo);
};

const onRedo = (): void => {
	void stepHistory(redo);
};

/*
 * Saving
 */

// Saving now would save the graph without what is typed in the form, and report it saved
const refuseInvalidDraft = (): boolean => {
	if (draftInvalid.value) {
		flashMessage.error(t('automations.editor.messages.invalidDraft'));
	}

	return draftInvalid.value;
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
 * Test and trace. The backend runs the flow it has saved, so a test is offered only for what is saved; the
 * run it starts is followed on the canvas, and a past run can be laid over it from the history.
 */

const showHistory = ref<boolean>(false);

// Only looked at by the canvas: it is worked out from the trace and never written into the graph
const canvasRun = computed<IAutomationCanvasRun | null>((): IAutomationCanvasRun | null =>
	shown.value ? { overlay: shown.value.overlay, ended: shown.value.ended } : null
);

// The triggers of the flow, in the order they were placed; the backend starts at the first one by default
const testTriggers = computed<IAutomationTestTrigger[]>((): IAutomationTestTrigger[] =>
	graph.value.nodes
		.filter((node) => getNodeType(node.type)?.kind === AutomationNodeKind.trigger)
		.map((node) => ({ id: node.id, label: nodeLabel(node.id, graph.value, nodeTypes.value) ?? node.id }))
);

const testDisabledReason = computed<string | null>((): string | null => {
	if (!automation.value) {
		return null;
	}

	if (hasUnsaved.value) {
		return t('automations.runs.test.disabled.unsaved');
	}

	if (!automation.value.enabled) {
		return t('automations.runs.test.disabled.disabled');
	}

	if (automation.value.status !== AutomationStatus.ok) {
		return t(`automations.runs.test.disabled.${automation.value.status}`);
	}

	if (testTriggers.value.length === 0) {
		return t('automations.runs.test.disabled.noTrigger');
	}

	return null;
});

const onTest = async (nodeId?: string): Promise<void> => {
	if (testDisabledReason.value !== null) {
		return;
	}

	try {
		const result = await test(nodeId);

		if (!result.started) {
			flashMessage.warning(outcomeText(result.outcome));
		}
	} catch (error) {
		if (error instanceof AutomationsTriggerRefusedException) {
			flashMessage.error(refusalText(error.reason));
		} else {
			flashMessage.error(t('automations.runs.messages.testFailed'));
		}
	}
};

const onToggleHistory = (): void => {
	showHistory.value = !showHistory.value;

	if (showHistory.value && runsLoadFailed.value) {
		void fetchRuns();
	}
};

const onReplay = (runId: string): void => {
	// Picked again: laid off the canvas
	if (shown.value?.runId === runId && shown.value.source === 'replay') {
		closeRun();

		return;
	}

	replay(runId);
};

// Why the automation does not run is read from the engine, with the cards it is about
watch(
	(): AutomationStatus | null => automation.value?.status ?? null,
	(status: AutomationStatus | null): void => {
		if (status === AutomationStatus.invalid || status === AutomationStatus.suspended) {
			void fetchRuntime();
		}
	},
	{ immediate: true }
);

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

		onUndo();
	} else if (key === 'y' || (key === 'z' && event.shiftKey)) {
		event.preventDefault();

		onRedo();
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

	// Only the automation can be missing: a catalogue that cannot be read is a read to try again
	const [catalogue, automationRead] = await Promise.allSettled([fetchNodeTypes(), load()]);

	if (automationRead.status === 'rejected') {
		notFound.value = automationRead.reason instanceof AutomationsApiException && automationRead.reason.code === 404;
		loadFailed.value = !notFound.value;
	} else {
		loadFailed.value = catalogue.status === 'rejected';

		// The history is read along: the events of new runs are merged into it, and a suspension is about the
		// trigger of the last run
		void fetchRuns();
	}

	ready.value = true;
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
