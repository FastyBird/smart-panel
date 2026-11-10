<template>
	<div
		class="automation-spike flex flex-col h-full w-full overflow-hidden"
		data-test="automation-spike"
	>
		<div class="automation-spike__bar flex flex-row flex-wrap items-center gap-2 px-3 py-2">
			<el-text
				tag="strong"
				class="mr-2"
			>
				Motion light (spike)
			</el-text>
			<el-tag
				v-if="readonly"
				type="info"
				data-test="readonly-tag"
			>
				Read-only
			</el-tag>
			<el-button-group v-if="!readonly">
				<el-button
					size="small"
					:disabled="!canUndo"
					data-test="undo"
					@click="undo"
				>
					<template #icon>
						<icon icon="mdi:undo" />
					</template>
					Undo
				</el-button>
				<el-button
					size="small"
					:disabled="!canRedo"
					data-test="redo"
					@click="redo"
				>
					<template #icon>
						<icon icon="mdi:redo" />
					</template>
					Redo
				</el-button>
			</el-button-group>
			<el-button
				v-if="!readonly"
				size="small"
				type="danger"
				plain
				:disabled="selectedNodeIds.length + selectedEdgeIds.length === 0"
				data-test="delete-selected"
				@click="canvas?.removeSelected()"
			>
				<template #icon>
					<icon icon="mdi:trash-can-outline" />
				</template>
				Delete
			</el-button>
			<el-button
				size="small"
				data-test="toggle-json"
				@click="showJson = !showJson"
			>
				<template #icon>
					<icon icon="mdi:code-json" />
				</template>
				JSON
			</el-button>
			<el-button
				size="small"
				data-test="round-trip"
				@click="roundTrip"
			>
				Round-trip
			</el-button>
			<el-tag
				v-if="roundTripResult !== null"
				:type="roundTripResult ? 'success' : 'danger'"
				data-test="round-trip-result"
			>
				{{ roundTripResult ? 'round-trip ok' : 'round-trip MISMATCH' }}
			</el-tag>
			<div class="flex-1" />
			<el-text
				size="small"
				type="info"
				data-test="status"
			>
				{{ graph.nodes.length }} nodes · {{ graph.edges.length }} edges
				<template v-if="lastRejection">· rejected: {{ lastRejection }} (#{{ rejectionCount }})</template>
			</el-text>
			<el-switch
				:model-value="isDark"
				inline-prompt
				active-text="Dark"
				inactive-text="Light"
				data-test="toggle-dark"
				@update:model-value="toggleDark()"
			/>
		</div>

		<div class="flex flex-row flex-1 min-h-0">
			<el-scrollbar
				v-if="!readonly"
				class="automation-spike__palette"
			>
				<automation-palette @add="onPaletteAdd" />
			</el-scrollbar>

			<div class="flex-1 min-w-0 min-h-0">
				<automation-canvas
					:key="canvasKey"
					ref="canvas"
					:graph="graph"
					:readonly="readonly"
					:connect-on-click="connectOnClick"
					:loose-connections="looseConnections"
					@update:graph="onGraphUpdate"
					@select="onSelect"
					@reject="onReject"
				/>
			</div>
		</div>

		<pre
			v-if="showJson"
			class="automation-spike__json"
			data-test="graph-json"
			>{{ exportedJson }}</pre
		>

		<el-drawer
			:model-value="drawerOpen"
			:modal="false"
			modal-penetrable
			:lock-scroll="false"
			:size="320"
			:title="selectedDefinition?.label ?? ''"
			append-to-body
			@close="drawerDismissedFor = selectedNode?.id ?? null"
		>
			<automation-node-form
				v-if="selectedNode"
				:node="selectedNode"
				@update:config="onConfigUpdate"
			/>
		</el-drawer>
	</div>
</template>

<script setup lang="ts">
// THROWAWAY SPIKE (AU-0): editor shell around the canvas wrapper, static data, no backend.
import { computed, onMounted, ref } from 'vue';

import { ElButton, ElButtonGroup, ElDrawer, ElMessage, ElScrollbar, ElSwitch, ElTag, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useBreakpoints } from '../../../common/composables/useBreakpoints';
import { useDarkMode } from '../../../common/composables/useDarkMode';
import { getNodeType } from '../automations-spike.catalogue';
import { REFERENCE_SCENARIO, canonicalGraph, cloneGraph } from '../automations-spike.graph';
import type {
	AutomationConnectionRejection,
	IAutomationGraph,
	IAutomationGraphNode,
	IAutomationNodeTypeDefinition,
} from '../automations-spike.types';
import AutomationCanvas from '../components/automation-canvas.vue';
import AutomationNodeForm from '../components/automation-node-form.vue';
import AutomationPalette from '../components/automation-palette.vue';

defineOptions({
	name: 'ViewAutomationSpike',
});

const query = new URLSearchParams(window.location.search);

const { isMDDevice } = useBreakpoints();
const { isDark, toggleDark } = useDarkMode();

// Design: below the `md` breakpoint the canvas is read-only.
const readonly = computed<boolean>((): boolean => query.get('readonly') === '1' || !isMDDevice.value);
const connectOnClick = query.get('connectOnClick') !== '0';
const looseConnections = query.get('loose') === '1';

const canvas = ref<InstanceType<typeof AutomationCanvas> | null>(null);
const canvasKey = ref<number>(0);

const graph = ref<IAutomationGraph>(cloneGraph(REFERENCE_SCENARIO));

/*
 * Undo / redo: the wrapper is controlled by plain JSON, so history is a list of snapshots.
 */
const history = ref<string[]>([JSON.stringify(graph.value)]);
const historyIndex = ref<number>(0);

const canUndo = computed<boolean>((): boolean => historyIndex.value > 0);
const canRedo = computed<boolean>((): boolean => historyIndex.value < history.value.length - 1);

const commit = (next: IAutomationGraph): void => {
	const serialised = JSON.stringify(next);

	if (serialised === history.value[historyIndex.value]) {
		return;
	}

	history.value = [...history.value.slice(0, historyIndex.value + 1), serialised];
	historyIndex.value = history.value.length - 1;
	graph.value = next;
};

const undo = (): void => {
	if (canUndo.value) {
		historyIndex.value -= 1;
		graph.value = JSON.parse(history.value[historyIndex.value] as string) as IAutomationGraph;
	}
};

const redo = (): void => {
	if (canRedo.value) {
		historyIndex.value += 1;
		graph.value = JSON.parse(history.value[historyIndex.value] as string) as IAutomationGraph;
	}
};

/*
 * Selection + drawer
 */
const selectedNodeIds = ref<string[]>([]);
const selectedEdgeIds = ref<string[]>([]);
const drawerDismissedFor = ref<string | null>(null);

const selectedNode = computed<IAutomationGraphNode | null>((): IAutomationGraphNode | null =>
	selectedNodeIds.value.length === 1 ? (graph.value.nodes.find((node) => node.id === selectedNodeIds.value[0]) ?? null) : null
);

const selectedDefinition = computed<IAutomationNodeTypeDefinition | undefined>(() =>
	selectedNode.value ? getNodeType(selectedNode.value.type) : undefined
);

const drawerOpen = computed<boolean>(
	(): boolean => !readonly.value && selectedNode.value !== null && drawerDismissedFor.value !== selectedNode.value.id
);

const onSelect = (nodeIds: string[], edgeIds: string[]): void => {
	selectedNodeIds.value = nodeIds;
	selectedEdgeIds.value = edgeIds;
	drawerDismissedFor.value = null;
};

const onGraphUpdate = (next: IAutomationGraph): void => {
	commit(next);
};

const onConfigUpdate = (config: Record<string, unknown>): void => {
	const id = selectedNode.value?.id;

	commit({
		...graph.value,
		nodes: graph.value.nodes.map((node) => (node.id === id ? { ...node, config } : node)),
	});
};

const onPaletteAdd = (type: string): void => {
	canvas.value?.addNode(type);
};

const lastRejection = ref<AutomationConnectionRejection | null>(null);
const rejectionCount = ref<number>(0);

const onReject = (reason: AutomationConnectionRejection): void => {
	lastRejection.value = reason;
	rejectionCount.value += 1;

	ElMessage.warning({ message: `Connection not allowed: ${reason}`, grouping: true });
};

/*
 * Export + round-trip
 */
const showJson = ref<boolean>(false);
const roundTripResult = ref<boolean | null>(null);

const exportedJson = computed<string>((): string => JSON.stringify(graph.value, null, 2));

const roundTrip = (): void => {
	// 1. export what the canvas holds, 2. remount a fresh canvas from that JSON, 3. export again and compare.
	const before = canvas.value?.toGraph();

	if (!before) {
		return;
	}

	graph.value = JSON.parse(JSON.stringify(before)) as IAutomationGraph;
	canvasKey.value += 1;

	setTimeout((): void => {
		const after = canvas.value?.toGraph();

		roundTripResult.value = !!after && canonicalGraph(before) === canonicalGraph(after) && canonicalGraph(before) === canonicalGraph(graph.value);
	}, 300);
};

onMounted((): void => {
	// Spike only: test hooks for the Playwright script.
	(window as unknown as Record<string, unknown>).__automationSpike = {
		getGraph: (): IAutomationGraph => cloneGraph(graph.value),
		getCanvasGraph: (): IAutomationGraph | undefined => canvas.value?.toGraph(),
		getViewport: (): { x: number; y: number; zoom: number } | undefined => canvas.value?.getViewport(),
		checkConnection: (candidate: { source: string; source_port: string; target: string; target_port: string }): string | null | undefined =>
			canvas.value?.checkConnection(candidate),
		canonical: canonicalGraph,
	};
});
</script>

<style scoped lang="scss">
.automation-spike {
	&__bar {
		border-bottom: 1px solid var(--el-border-color);
		background-color: var(--el-bg-color);
	}

	&__palette {
		flex: 0 0 210px;
		border-right: 1px solid var(--el-border-color);
		background-color: var(--el-bg-color);
	}

	&__json {
		flex: 0 0 180px;
		overflow: auto;
		margin: 0;
		padding: 8px 12px;
		border-top: 1px solid var(--el-border-color);
		background-color: var(--el-fill-color-light);
		color: var(--el-text-color-regular);
		font-size: 11px;
	}
}
</style>
