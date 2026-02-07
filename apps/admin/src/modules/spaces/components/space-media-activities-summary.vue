<template>
	<template v-if="hasEndpoints">
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('spacesModule.detail.mediaActivities.title') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center justify-between min-w-[8rem]">
			<!-- Show activity tags when bindings exist -->
			<div v-if="activitySummaries.length > 0" class="flex items-center gap-2 flex-wrap">
				<el-tag
					v-for="summary in activitySummaries"
					:key="summary.activityKey"
					:type="summary.tagType"
					size="small"
					class="cursor-pointer"
					@click="onPreviewActivity(summary.activityKey)"
				>
					<div class="flex items-center gap-1">
						<icon :icon="summary.icon" />
						{{ t(`spacesModule.media.activityLabels.${summary.activityKey}`) }}
						<el-badge
							:value="summary.routeCount"
							:type="summary.tagType"
							class="ml-1"
						/>
					</div>
				</el-tag>
			</div>
			<!-- Show hint when no bindings exist -->
			<div v-else class="flex items-center gap-2 text-gray-400 text-sm">
				<icon icon="mdi:play-box-multiple-outline" />
				{{ t('spacesModule.detail.mediaActivities.noActivities') }}
			</div>
			<el-button
				text
				size="small"
				class="ml-2"
				@click="emit('edit')"
			>
				<template #icon>
					<icon icon="mdi:pencil" />
				</template>
				{{ t('spacesModule.buttons.edit.title') }}
			</el-button>
		</dd>
	</template>

	<!-- Execution Plan Preview Dialog -->
	<el-dialog
		v-model="previewDialogVisible"
		:title="previewDialogTitle"
		width="680px"
		destroy-on-close
	>
		<div
			v-loading="previewLoading"
			:element-loading-text="t('spacesModule.media.activities.loading')"
		>
			<div
				v-if="previewData"
				class="flex flex-col gap-4"
			>
				<!-- Active state info (shown when previewed activity is currently active) -->
				<el-card
					v-if="isPreviewedActivityActive"
					shadow="never"
					:class="['border-l-4', activeStateBorderClass]"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div>
								<span class="text-gray-500 text-sm">{{ t('spacesModule.media.activities.activePanel.state') }}:</span>
								<el-tag
									:type="activeStateTagType"
									size="small"
									class="ml-2"
								>
									{{ t(`spacesModule.media.activities.activationState.${activeState!.state}`) }}
								</el-tag>
							</div>
							<div v-if="activeState!.activatedAt">
								<span class="text-gray-500 text-sm">{{ t('spacesModule.media.activities.activePanel.activatedAt') }}:</span>
								<span class="ml-1 text-sm">{{ formatTimestamp(activeState!.activatedAt!) }}</span>
							</div>
						</div>
						<el-button
							v-if="activeState!.state !== 'deactivated'"
							size="small"
							type="warning"
							:loading="deactivating"
							@click="onDeactivate"
						>
							<template #icon>
								<icon icon="mdi:stop" />
							</template>
							{{ t('spacesModule.media.activities.deactivate') }}
						</el-button>
					</div>
				</el-card>

				<!-- Resolved devices -->
				<div>
					<div class="text-sm font-medium mb-2">{{ t('spacesModule.media.activities.previewDialog.resolvedDevices') }}</div>
					<div class="grid grid-cols-2 gap-2 text-sm">
						<div v-if="previewData.resolved.displayDeviceId">
							<span class="text-gray-400">{{ t('spacesModule.media.activities.activePanel.display') }}:</span>
							<span class="ml-1">{{ resolveDeviceName(previewData.resolved.displayDeviceId) }}</span>
						</div>
						<div v-if="previewData.resolved.audioDeviceId">
							<span class="text-gray-400">{{ t('spacesModule.media.activities.activePanel.audio') }}:</span>
							<span class="ml-1">{{ resolveDeviceName(previewData.resolved.audioDeviceId) }}</span>
						</div>
						<div v-if="previewData.resolved.sourceDeviceId">
							<span class="text-gray-400">{{ t('spacesModule.media.activities.activePanel.source') }}:</span>
							<span class="ml-1">{{ resolveDeviceName(previewData.resolved.sourceDeviceId) }}</span>
						</div>
						<div v-if="previewData.resolved.remoteDeviceId">
							<span class="text-gray-400">{{ t('spacesModule.media.activities.activePanel.remote') }}:</span>
							<span class="ml-1">{{ resolveDeviceName(previewData.resolved.remoteDeviceId) }}</span>
						</div>
					</div>
				</div>

				<!-- Execution plan steps -->
				<div>
					<div class="text-sm font-medium mb-2">{{ t('spacesModule.media.activities.previewDialog.executionPlan') }}</div>
					<el-table
						v-if="previewData.plan.length"
						:data="previewData.plan"
						size="small"
						border
					>
						<el-table-column
							:label="t('spacesModule.media.activities.previewDialog.step')"
							width="60"
						>
							<template #default="{ $index }">
								{{ $index + 1 }}
							</template>
						</el-table-column>
						<el-table-column
							:label="t('spacesModule.media.activities.previewDialog.action')"
							min-width="200"
						>
							<template #default="{ row }">
								<div class="flex items-center gap-2">
									<icon
										:icon="getStepKindIcon(row.action.kind)"
										class="w[16px] h[16px] shrink-0"
									/>
									<span>{{ row.label }}</span>
								</div>
							</template>
						</el-table-column>
						<el-table-column
							:label="t('spacesModule.media.activities.previewDialog.device')"
							min-width="140"
						>
							<template #default="{ row }">
								{{ resolveDeviceName(row.targetDeviceId) }}
							</template>
						</el-table-column>
						<el-table-column
							:label="t('spacesModule.media.activities.previewDialog.critical')"
							width="100"
						>
							<template #default="{ row }">
								<el-tag
									:type="row.critical ? 'danger' : 'info'"
									size="small"
								>
									{{ row.critical ? t('spacesModule.media.activities.previewDialog.criticalYes') : t('spacesModule.media.activities.previewDialog.criticalNo') }}
								</el-tag>
							</template>
						</el-table-column>
					</el-table>
					<div
						v-else
						class="text-sm text-gray-400"
					>
						{{ t('spacesModule.media.activities.previewDialog.noSteps') }}
					</div>
				</div>

				<!-- Warnings -->
				<div v-if="previewData.warnings.length">
					<div class="text-sm font-medium mb-2">{{ t('spacesModule.media.activities.previewDialog.warnings') }}</div>
					<el-alert
						v-for="(warning, idx) in previewData.warnings"
						:key="idx"
						type="warning"
						:title="warning.label"
						show-icon
						:closable="false"
						class="mb-1"
					/>
				</div>
			</div>

			<!-- Error state -->
			<el-alert
				v-if="previewError"
				type="error"
				:title="t('spacesModule.media.activities.previewFailed')"
				:description="previewError"
				show-icon
				:closable="false"
			/>
		</div>

		<template #footer>
			<el-button @click="previewDialogVisible = false">
				{{ t('spacesModule.media.activities.previewDialog.close') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import { ElAlert, ElBadge, ElButton, ElCard, ElDialog, ElTable, ElTableColumn, ElTag, vLoading } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { useFlashMessage } from '../../../common';
import {
	getActivityColor,
	getActivityIcon,
	type IMediaDryRunPreview,
	type IDerivedMediaEndpoint,
	MediaActivityKey,
	useSpaceMedia,
} from '../composables/useSpaceMedia';

import type { ISpaceMediaActivitiesSummaryProps } from './space-media-activities-summary.types';

defineOptions({
	name: 'SpaceMediaActivitiesSummary',
});

const props = defineProps<ISpaceMediaActivitiesSummaryProps>();

const emit = defineEmits<{
	(e: 'edit'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const spaceIdRef = computed(() => props.space?.id);
const {
	endpoints,
	activeState,
	fetchEndpoints,
	fetchBindings,
	fetchActiveState,
	deactivate,
	deactivating,
	findBindingByActivity,
	preview,
} = useSpaceMedia(spaceIdRef);

const hasEndpoints = ref(false);

// Preview dialog state
const previewDialogVisible = ref(false);
const previewLoading = ref(false);
const previewData = ref<IMediaDryRunPreview | null>(null);
const previewError = ref<string | null>(null);
const previewActivityKey = ref<string | null>(null);

interface IActivitySummary {
	activityKey: string;
	icon: string;
	tagType: 'primary' | 'success' | 'warning' | 'info' | 'danger';
	routeCount: number;
}

const activityKeys = [
	MediaActivityKey.watch,
	MediaActivityKey.listen,
	MediaActivityKey.gaming,
	MediaActivityKey.background,
];

const countRoutes = (binding: { displayEndpointId: string | null; audioEndpointId: string | null; sourceEndpointId: string | null; remoteEndpointId: string | null }): number => {
	return [binding.displayEndpointId, binding.audioEndpointId, binding.sourceEndpointId, binding.remoteEndpointId].filter(Boolean).length;
};

const activitySummaries = computed<IActivitySummary[]>(() => {
	const summaries: IActivitySummary[] = [];

	for (const key of activityKeys) {
		const binding = findBindingByActivity(key);
		if (!binding) continue;

		summaries.push({
			activityKey: key,
			icon: getActivityIcon(key),
			tagType: getActivityColor(key),
			routeCount: countRoutes(binding),
		});
	}

	return summaries;
});

const previewDialogTitle = computed(() => {
	if (!previewActivityKey.value) return t('spacesModule.media.activities.previewDialog.title');
	const label = t(`spacesModule.media.activityLabels.${previewActivityKey.value}`);
	return `${t('spacesModule.media.activities.previewDialog.title')} — ${label}`;
});

// Active state helpers for preview dialog
const isPreviewedActivityActive = computed(() => {
	if (!activeState.value || !previewActivityKey.value) return false;
	return activeState.value.activityKey === previewActivityKey.value && activeState.value.state !== 'deactivated';
});

const activeStateBorderClass = computed(() => {
	if (!activeState.value) return 'border-gray-300';
	switch (activeState.value.state) {
		case 'active':
			return 'border-green-500';
		case 'activating':
			return 'border-blue-500';
		case 'failed':
			return 'border-red-500';
		default:
			return 'border-gray-300';
	}
});

const activeStateTagType = computed<'primary' | 'success' | 'warning' | 'info' | 'danger'>(() => {
	if (!activeState.value) return 'info';
	switch (activeState.value.state) {
		case 'active':
			return 'success';
		case 'activating':
			return 'primary';
		case 'failed':
			return 'danger';
		default:
			return 'info';
	}
});

const formatTimestamp = (ts: string): string => {
	const date = new Date(ts);
	return isNaN(date.getTime()) ? ts : date.toLocaleString();
};

const resolveDeviceName = (deviceId: string): string => {
	const ep = endpoints.value.find((e: IDerivedMediaEndpoint) => e.deviceId === deviceId);
	return ep?.name ?? deviceId;
};

const getStepKindIcon = (kind: string): string => {
	switch (kind) {
		case 'setProperty':
			return 'mdi:tune';
		case 'sendCommand':
			return 'mdi:send';
		default:
			return 'mdi:help-circle';
	}
};

const onDeactivate = async (): Promise<void> => {
	try {
		await deactivate();
		flashMessage.success(t('spacesModule.media.activities.deactivateSuccess'));
	} catch {
		flashMessage.error(t('spacesModule.media.activities.deactivateFailed'));
	}
};

const onPreviewActivity = async (activityKey: string): Promise<void> => {
	previewActivityKey.value = activityKey;
	previewData.value = null;
	previewError.value = null;
	previewLoading.value = true;
	previewDialogVisible.value = true;

	try {
		const [previewResult] = await Promise.all([
			preview(activityKey as MediaActivityKey),
			fetchActiveState(),
		]);
		previewData.value = previewResult;
	} catch (e: unknown) {
		previewError.value = e instanceof Error ? e.message : 'Unknown error';
	} finally {
		previewLoading.value = false;
	}
};

const loadData = async (): Promise<void> => {
	if (!props.space?.id) return;

	try {
		await Promise.all([fetchEndpoints(), fetchBindings(), fetchActiveState()]);
		hasEndpoints.value = endpoints.value.length > 0;
	} catch {
		// ignore fetch errors — summary degrades gracefully
	}
};

watch(
	() => props.space?.id,
	(newId) => {
		if (newId) {
			loadData();
		}
	}
);

onMounted(() => {
	if (props.space?.id) {
		loadData();
	}
});

defineExpose({
	reload: loadData,
});
</script>
