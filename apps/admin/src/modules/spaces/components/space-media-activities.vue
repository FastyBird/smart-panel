<template>
	<div
		v-loading="initialLoading"
		:element-loading-text="t('spacesModule.media.activities.loading')"
		class="flex flex-col gap-4"
	>
		<!-- Active State Panel -->
		<el-card
			v-if="activeState"
			shadow="never"
			:class="['border-l-4', activeStateBorderClass]"
		>
			<template #header>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<icon
							icon="mdi:play-circle"
							class="w[20px] h[20px]"
						/>
						<span class="font-medium">{{ t('spacesModule.media.activities.activePanel.title') }}</span>
					</div>
					<div class="flex items-center gap-2">
						<el-button
							size="small"
							:loading="fetchingActiveState"
							@click="onRefreshStatus"
						>
							<template #icon>
								<icon icon="mdi:refresh" />
							</template>
							{{ t('spacesModule.media.activities.refreshStatus') }}
						</el-button>
						<el-button
							v-if="activeState.activityKey && activeState.state !== 'deactivated'"
							size="small"
							type="warning"
							:loading="deactivating"
							:disabled="activating || deactivating"
							@click="onDeactivate"
						>
							<template #icon>
								<icon icon="mdi:stop" />
							</template>
							{{ t('spacesModule.media.activities.deactivate') }}
						</el-button>
						<el-button
							v-if="activeState.activityKey && (activeState.state === 'active' || activeState.state === 'failed')"
							size="small"
							type="primary"
							:loading="activating"
							:disabled="activating || deactivating"
							@click="onRerun"
						>
							<template #icon>
								<icon icon="mdi:replay" />
							</template>
							{{ t('spacesModule.media.activities.rerun') }}
						</el-button>
					</div>
				</div>
			</template>

			<div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
				<div>
					<span class="text-gray-500">{{ t('spacesModule.media.activities.activePanel.currentActivity') }}:</span>
					<span class="ml-2 font-medium">
						{{ activeState.activityKey ? t(`spacesModule.media.activityLabels.${activeState.activityKey}`) : t('spacesModule.media.activities.activePanel.none') }}
					</span>
				</div>
				<div>
					<span class="text-gray-500">{{ t('spacesModule.media.activities.activePanel.state') }}:</span>
					<el-tag
						:type="activationStateTagType"
						size="small"
						class="ml-2"
					>
						{{ t(`spacesModule.media.activities.activationState.${activeState.state}`) }}
					</el-tag>
				</div>
				<div v-if="activeState.activatedAt">
					<span class="text-gray-500">{{ t('spacesModule.media.activities.activePanel.activatedAt') }}:</span>
					<span class="ml-2">{{ formatTimestamp(activeState.activatedAt) }}</span>
				</div>
				<div v-if="activeState.updatedAt">
					<span class="text-gray-500">{{ t('spacesModule.media.activities.activePanel.updatedAt') }}:</span>
					<span class="ml-2">{{ formatTimestamp(activeState.updatedAt) }}</span>
				</div>
			</div>

			<!-- Resolved devices -->
			<div
				v-if="activeState.resolved"
				class="mt-3 pt-3 border-t border-gray-100"
			>
				<div class="text-sm text-gray-500 mb-2">{{ t('spacesModule.media.activities.activePanel.resolvedDevices') }}</div>
				<div class="grid grid-cols-2 gap-2 text-sm">
					<div v-if="activeState.resolved.displayDeviceId">
						<span class="text-gray-400">{{ t('spacesModule.media.activities.activePanel.display') }}:</span>
						<span class="ml-1">{{ resolveDeviceName(activeState.resolved.displayDeviceId) }}</span>
					</div>
					<div v-if="activeState.resolved.audioDeviceId">
						<span class="text-gray-400">{{ t('spacesModule.media.activities.activePanel.audio') }}:</span>
						<span class="ml-1">{{ resolveDeviceName(activeState.resolved.audioDeviceId) }}</span>
					</div>
					<div v-if="activeState.resolved.sourceDeviceId">
						<span class="text-gray-400">{{ t('spacesModule.media.activities.activePanel.source') }}:</span>
						<span class="ml-1">{{ resolveDeviceName(activeState.resolved.sourceDeviceId) }}</span>
					</div>
					<div v-if="activeState.resolved.remoteDeviceId">
						<span class="text-gray-400">{{ t('spacesModule.media.activities.activePanel.remote') }}:</span>
						<span class="ml-1">{{ resolveDeviceName(activeState.resolved.remoteDeviceId) }}</span>
					</div>
				</div>
			</div>

			<!-- Warnings -->
			<div
				v-if="activeState.warnings?.length"
				class="mt-3"
			>
				<el-alert
					v-for="(warning, idx) in activeState.warnings"
					:key="idx"
					type="warning"
					:title="warning"
					show-icon
					:closable="false"
					class="mb-1"
				/>
			</div>

			<!-- Failures section -->
			<div
				v-if="activeState.summary && activeState.summary.stepsFailed > 0"
				class="mt-3 pt-3 border-t border-gray-100"
			>
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center gap-2">
						<icon
							icon="mdi:alert-circle"
							class="w[18px] h[18px] text-red-500"
						/>
						<span class="font-medium text-sm text-red-600">{{ t('spacesModule.media.activities.failures.title') }}</span>
					</div>
					<el-button
						size="small"
						text
						@click="onCopyDebugJson"
					>
						<template #icon>
							<icon icon="mdi:content-copy" />
						</template>
						{{ t('spacesModule.media.activities.copyDebugJson') }}
					</el-button>
				</div>

				<!-- Summary counts -->
				<div class="flex gap-4 text-sm mb-3">
					<span>
						<span class="text-gray-500">{{ t('spacesModule.media.activities.failures.total') }}:</span>
						<span class="ml-1 font-medium">{{ activeState.summary.stepsTotal }}</span>
					</span>
					<span>
						<span class="text-gray-500">{{ t('spacesModule.media.activities.failures.succeeded') }}:</span>
						<span class="ml-1 font-medium text-green-600">{{ activeState.summary.stepsSucceeded }}</span>
					</span>
					<span>
						<span class="text-gray-500">{{ t('spacesModule.media.activities.failures.failed') }}:</span>
						<span class="ml-1 font-medium text-red-600">{{ activeState.summary.stepsFailed }}</span>
					</span>
					<span v-if="activeState.summary.errorCount">
						<span class="text-gray-500">Errors:</span>
						<span class="ml-1 font-medium text-red-600">{{ activeState.summary.errorCount }}</span>
					</span>
					<span v-if="activeState.summary.warningCount">
						<span class="text-gray-500">Warnings:</span>
						<span class="ml-1 font-medium text-orange-500">{{ activeState.summary.warningCount }}</span>
					</span>
				</div>

				<!-- Structured failure tables (errors + warnings) -->
				<template
					v-for="section in failureSections"
					:key="section.key"
				>
					<div :class="['text-xs font-semibold mb-1', section.headerClass]">{{ section.label }}</div>
					<el-table
						:data="section.items"
						size="small"
						border
						:class="section.key === 'errors' ? 'mb-3' : 'mb-2'"
					>
						<el-table-column
							:label="t('spacesModule.media.activities.failures.stepIndex')"
							prop="stepIndex"
							width="80"
						/>
						<el-table-column
							label="Label"
							min-width="120"
						>
							<template #default="{ row }">
								{{ row.label ?? '-' }}
							</template>
						</el-table-column>
						<el-table-column
							:label="t('spacesModule.media.activities.failures.device')"
							min-width="140"
						>
							<template #default="{ row }">
								{{ row.targetDeviceId ? resolveDeviceName(row.targetDeviceId) : '-' }}
							</template>
						</el-table-column>
						<el-table-column
							:label="t('spacesModule.media.activities.failures.reason')"
							prop="reason"
							min-width="200"
						/>
					</el-table>
				</template>

				<!-- Legacy failures table (fallback if no structured warnings/errors) -->
				<el-table
					v-if="activeState.summary.failures?.length && !activeState.summary.errors?.length && !activeState.summary.warnings?.length"
					:data="activeState.summary.failures"
					size="small"
					border
					class="mb-2"
				>
					<el-table-column
						:label="t('spacesModule.media.activities.failures.stepIndex')"
						prop="stepIndex"
						width="80"
					/>
					<el-table-column
						label="Critical"
						width="80"
					>
						<template #default="{ row }">
							<el-tag
								:type="row.critical ? 'danger' : 'warning'"
								size="small"
							>
								{{ row.critical ? 'Error' : 'Warning' }}
							</el-tag>
						</template>
					</el-table-column>
					<el-table-column
						:label="t('spacesModule.media.activities.failures.device')"
						min-width="140"
					>
						<template #default="{ row }">
							{{ row.targetDeviceId ? resolveDeviceName(row.targetDeviceId) : '-' }}
						</template>
					</el-table-column>
					<el-table-column
						:label="t('spacesModule.media.activities.failures.property')"
						min-width="120"
					>
						<template #default="{ row }">
							{{ row.propertyId ?? '-' }}
						</template>
					</el-table-column>
					<el-table-column
						:label="t('spacesModule.media.activities.failures.reason')"
						prop="reason"
						min-width="200"
					/>
				</el-table>
			</div>
		</el-card>

		<!-- Activation error -->
		<el-alert
			v-if="activationError"
			type="error"
			:title="t(`spacesModule.media.activities.${activationErrorSource === 'deactivate' ? 'deactivateFailed' : activationErrorSource === 'fetch' ? 'fetchFailed' : 'activateFailed'}`)"
			:description="activationError"
			show-icon
			closable
			@close="activationError = null"
		/>

		<!-- Top controls -->
		<div class="flex items-center justify-between gap-2 mb-2">
			<div class="flex items-center gap-2">
				<el-button
					type="warning"
					plain
					:loading="deactivating"
					:disabled="activating || deactivating || !activeState || activeState.state === 'deactivated'"
					@click="onDeactivate"
				>
					<template #icon>
						<icon icon="mdi:stop" />
					</template>
					{{ t('spacesModule.media.activities.deactivate') }}
				</el-button>
			</div>
			<el-button
				type="primary"
				plain
				:loading="applyingDefaults"
				@click="onApplyDefaults"
			>
				<template #icon>
					<icon icon="mdi:auto-fix" />
				</template>
				{{ t('spacesModule.media.activities.applyDefaults') }}
			</el-button>
		</div>

		<div class="flex gap-4 min-h-400px">
			<!-- Left: Activity list -->
			<div class="w-280px shrink-0">
				<el-card
					shadow="never"
					body-class="p-0!"
				>
					<template
						v-for="activity in activityKeys"
						:key="activity"
					>
						<div
							:class="[
								'flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors',
								selectedActivity === activity ? 'bg-blue-50' : 'hover:bg-gray-50',
							]"
							@click="onSelectActivity(activity)"
						>
							<icon
								:icon="getActivityIcon(activity)"
								class="w[20px] h[20px] shrink-0"
							/>
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm">
									{{ t(`spacesModule.media.activityLabels.${activity}`) }}
								</div>
							</div>
							<el-tag
								:type="getActivityTagType(activity)"
								size="small"
								round
							>
								{{ getActivityStatusLabel(activity) }}
							</el-tag>
							<el-button
								size="small"
								circle
								:loading="previewing && previewingKey === activity"
								:disabled="activating || deactivating || previewing || activity === MediaActivityKey.off"
								:title="t('spacesModule.media.activities.preview')"
								@click.stop="onPreview(activity)"
							>
								<template #icon>
									<icon icon="mdi:eye-outline" />
								</template>
							</el-button>
							<el-button
								size="small"
								type="success"
								circle
								:loading="activating && activatingKey === activity"
								:disabled="activating || deactivating || (activeState?.state === 'activating')"
								:title="t('spacesModule.media.activities.run')"
								@click.stop="onActivate(activity)"
							>
								<template #icon>
									<icon icon="mdi:play" />
								</template>
							</el-button>
						</div>
					</template>
				</el-card>
			</div>

			<!-- Right: Editor panel -->
			<div class="flex-1 min-w-0">
				<el-card
					v-if="selectedActivity"
					shadow="never"
				>
					<template #header>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<icon
									:icon="getActivityIcon(selectedActivity)"
									class="w[24px] h[24px]"
								/>
								<span class="font-medium">
									{{ t(`spacesModule.media.activityLabels.${selectedActivity}`) }}
								</span>
							</div>
						</div>
					</template>

					<el-form
						label-position="top"
						class="flex flex-col gap-2"
					>
						<!-- Display slot -->
						<el-form-item :label="t('spacesModule.media.activities.slots.display')">
							<el-select
								v-model="form.displayEndpointId"
								:placeholder="t('spacesModule.media.activities.selectEndpoint')"
								clearable
								class="w-full"
							>
								<el-option
									v-for="ep in displayEndpoints"
									:key="ep.endpointId"
									:label="ep.name"
									:value="ep.endpointId"
								>
									<div class="flex items-center justify-between w-full">
										<span>{{ ep.name }}</span>
										<div class="flex gap-1 ml-2">
											<el-tag
												v-if="ep.capabilities.inputSelect"
												size="small"
												type="info"
											>
												{{ t('spacesModule.media.capabilities.input') }}
											</el-tag>
										</div>
									</div>
								</el-option>
							</el-select>
						</el-form-item>

						<!-- Display input override (only if selected display supports inputSelect) -->
						<el-form-item
							v-if="selectedDisplayHasInputSelect"
							:label="t('spacesModule.media.activities.overrides.displayInput')"
						>
							<el-input
								v-model="form.displayInputId"
								:placeholder="t('spacesModule.media.activities.overrides.displayInputPlaceholder')"
								clearable
							/>
						</el-form-item>

						<!-- Audio slot -->
						<el-form-item :label="t('spacesModule.media.activities.slots.audio')">
							<el-select
								v-model="form.audioEndpointId"
								:placeholder="t('spacesModule.media.activities.selectEndpoint')"
								clearable
								class="w-full"
							>
								<el-option
									v-for="ep in audioEndpoints"
									:key="ep.endpointId"
									:label="ep.name"
									:value="ep.endpointId"
								>
									<div class="flex items-center justify-between w-full">
										<span>{{ ep.name }}</span>
										<div class="flex gap-1 ml-2">
											<el-tag
												v-if="ep.capabilities.volume"
												size="small"
												type="info"
											>
												{{ t('spacesModule.media.capabilities.volume') }}
											</el-tag>
										</div>
									</div>
								</el-option>
							</el-select>
						</el-form-item>

						<!-- Audio volume preset override (only if selected audio supports volume) -->
						<el-form-item
							v-if="selectedAudioHasVolume"
							:label="t('spacesModule.media.activities.overrides.audioVolume')"
						>
							<el-slider
								v-model="form.audioVolumePreset"
								:min="0"
								:max="100"
								show-input
							/>
						</el-form-item>

						<!-- Source slot -->
						<el-form-item :label="t('spacesModule.media.activities.slots.source')">
							<el-select
								v-model="form.sourceEndpointId"
								:placeholder="t('spacesModule.media.activities.selectEndpoint')"
								clearable
								class="w-full"
							>
								<el-option
									v-for="ep in sourceEndpoints"
									:key="ep.endpointId"
									:label="ep.name"
									:value="ep.endpointId"
								/>
							</el-select>
						</el-form-item>

						<!-- Remote target slot -->
						<el-form-item :label="t('spacesModule.media.activities.slots.remote')">
							<el-select
								v-model="form.remoteEndpointId"
								:placeholder="t('spacesModule.media.activities.selectEndpoint')"
								clearable
								class="w-full"
							>
								<el-option
									v-for="ep in remoteEndpoints"
									:key="ep.endpointId"
									:label="ep.name"
									:value="ep.endpointId"
								/>
							</el-select>
						</el-form-item>

						<!-- Error display -->
						<el-alert
							v-if="saveError"
							type="error"
							:title="t('spacesModule.media.activities.saveError')"
							:description="saveError"
							show-icon
							closable
							class="mb-4"
							@close="saveError = null"
						/>

						<!-- Action buttons -->
						<div class="flex items-center gap-2 mt-2">
							<el-button
								type="primary"
								:loading="savingBinding"
								:disabled="!formChanged"
								@click="onSave"
							>
								{{ t('spacesModule.media.activities.save') }}
							</el-button>
							<el-button
								:disabled="!formChanged"
								@click="onReset"
							>
								{{ t('spacesModule.media.activities.reset') }}
							</el-button>
						</div>
					</el-form>
				</el-card>

				<el-result
					v-else
					icon="info"
				>
					<template #title>
						{{ t('spacesModule.media.activities.selectPrompt') }}
					</template>
				</el-result>
			</div>
		</div>

		<!-- Preview Dialog -->
		<el-dialog
			v-model="previewDialogVisible"
			:title="t('spacesModule.media.activities.previewDialog.title')"
			width="680px"
			destroy-on-close
		>
			<div
				v-if="previewData"
				class="flex flex-col gap-4"
			>
				<!-- Resolved composition -->
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
								{{ $index }}
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

			<template #footer>
				<el-button @click="previewDialogVisible = false">
					{{ t('spacesModule.media.activities.previewDialog.close') }}
				</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElDialog,
	ElForm,
	ElFormItem,
	ElInput,
	ElOption,
	ElResult,
	ElSelect,
	ElSlider,
	ElTable,
	ElTableColumn,
	ElTag,
	vLoading,
} from 'element-plus';
import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';
import {
	type IMediaActivityBinding,
	type IMediaDryRunPreview,
	type IMediaStepFailure,
	type MediaActivationState,
	MediaActivityKey,
	MediaEndpointType,
	useSpaceMedia,
} from '../composables/useSpaceMedia';

import type { ISpaceMediaActivitiesProps } from './space-media-activities.types';

defineOptions({
	name: 'SpaceMediaActivities',
});

const props = defineProps<ISpaceMediaActivitiesProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const spaceIdRef = computed(() => props.spaceId);
const {
	endpoints,
	activeState,
	fetchingEndpoints,
	fetchingBindings,
	fetchingActiveState,
	activating,
	deactivating,
	previewing,
	savingBinding,
	applyingDefaults,
	saveError,
	activationError,
	activationErrorSource,
	fetchEndpoints,
	fetchBindings,
	fetchActiveState,
	activate,
	preview,
	deactivate,
	saveBinding,
	createBinding,
	applyDefaults,
	findBindingByActivity,
	endpointsByType,
} = useSpaceMedia(spaceIdRef);

const activityKeys = [
	MediaActivityKey.watch,
	MediaActivityKey.listen,
	MediaActivityKey.gaming,
	MediaActivityKey.background,
	MediaActivityKey.off,
];

const selectedActivity = ref<MediaActivityKey | null>(null);
const activatingKey = ref<MediaActivityKey | null>(null);
const previewingKey = ref<MediaActivityKey | null>(null);
const previewDialogVisible = ref(false);
const previewData = ref<IMediaDryRunPreview | null>(null);

const form = reactive<{
	displayEndpointId: string;
	audioEndpointId: string;
	sourceEndpointId: string;
	remoteEndpointId: string;
	displayInputId: string;
	audioVolumePreset: number;
}>({
	displayEndpointId: '',
	audioEndpointId: '',
	sourceEndpointId: '',
	remoteEndpointId: '',
	displayInputId: '',
	audioVolumePreset: 30,
});

const lastLoadedForm = ref<typeof form | null>(null);

const initialLoading = computed(() => fetchingEndpoints.value || fetchingBindings.value);

// Structured failure sections for the template loop
const failureSections = computed(() => {
	const summary = activeState.value?.summary;
	if (!summary) return [];

	const sections: { key: string; label: string; headerClass: string; items: IMediaStepFailure[] }[] = [];

	if (summary.errors?.length) {
		sections.push({ key: 'errors', label: 'Critical Errors', headerClass: 'text-red-600', items: summary.errors });
	}
	if (summary.warnings?.length) {
		sections.push({ key: 'warnings', label: 'Warnings (non-critical)', headerClass: 'text-orange-500', items: summary.warnings });
	}

	return sections;
});

// Filtered endpoints by type
const displayEndpoints = endpointsByType(MediaEndpointType.display);
const audioEndpoints = endpointsByType(MediaEndpointType.audio_output);
const sourceEndpoints = endpointsByType(MediaEndpointType.source);
const remoteEndpoints = endpointsByType(MediaEndpointType.remote_target);

// Check if selected endpoints support overrides
const selectedDisplayHasInputSelect = computed(() => {
	if (!form.displayEndpointId) return false;
	const ep = endpoints.value.find((e) => e.endpointId === form.displayEndpointId);
	return ep?.capabilities.inputSelect ?? false;
});

const selectedAudioHasVolume = computed(() => {
	if (!form.audioEndpointId) return false;
	const ep = endpoints.value.find((e) => e.endpointId === form.audioEndpointId);
	return ep?.capabilities.volume ?? false;
});

const formChanged = computed(() => {
	if (!lastLoadedForm.value) return false;
	return (
		form.displayEndpointId !== lastLoadedForm.value.displayEndpointId ||
		form.audioEndpointId !== lastLoadedForm.value.audioEndpointId ||
		form.sourceEndpointId !== lastLoadedForm.value.sourceEndpointId ||
		form.remoteEndpointId !== lastLoadedForm.value.remoteEndpointId ||
		form.displayInputId !== lastLoadedForm.value.displayInputId ||
		form.audioVolumePreset !== lastLoadedForm.value.audioVolumePreset
	);
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
		case 'deactivated':
			return 'border-gray-300';
		default:
			return 'border-gray-300';
	}
});

const getStateTagType = (state: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
	switch (state) {
		case 'active':
			return 'success';
		case 'activating':
			return 'primary';
		case 'failed':
			return 'danger';
		case 'deactivated':
			return 'info';
		default:
			return 'info';
	}
};

const activationStateTagType = computed<'primary' | 'success' | 'warning' | 'info' | 'danger'>(() => {
	if (!activeState.value) return 'info';
	return getStateTagType(activeState.value.state);
});

const getActivityIcon = (key: string): string => {
	switch (key) {
		case MediaActivityKey.watch:
			return 'mdi:television-play';
		case MediaActivityKey.listen:
			return 'mdi:music';
		case MediaActivityKey.gaming:
			return 'mdi:controller';
		case MediaActivityKey.background:
			return 'mdi:music-note';
		case MediaActivityKey.off:
			return 'mdi:power';
		default:
			return 'mdi:help-circle';
	}
};

const getActivityContext = (key: MediaActivityKey): { isActive: boolean; state?: MediaActivationState; binding?: IMediaActivityBinding; hasSlots: boolean } => {
	const isActive = activeState.value?.activityKey === key && activeState.value.state !== 'deactivated';
	const state = isActive ? (activeState.value!.state as MediaActivationState) : undefined;
	const binding = findBindingByActivity(key);
	const hasSlots = !!(binding?.displayEndpointId || binding?.audioEndpointId || binding?.sourceEndpointId || binding?.remoteEndpointId);
	return { isActive, state, binding, hasSlots };
};

const getActivityTagType = (key: MediaActivityKey): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
	const { isActive, state, binding, hasSlots } = getActivityContext(key);

	if (isActive && state) {
		return getStateTagType(state);
	}

	if (!binding) return 'info';
	return hasSlots ? 'success' : 'warning';
};

const getActivityStatusLabel = (key: MediaActivityKey): string => {
	const { isActive, state, binding, hasSlots } = getActivityContext(key);

	if (isActive) {
		return t(`spacesModule.media.activities.activationState.${state}`);
	}

	if (!binding) return t('spacesModule.media.activities.status.unconfigured');
	return hasSlots
		? t('spacesModule.media.activities.status.configured')
		: t('spacesModule.media.activities.status.incomplete');
};

const resolveDeviceName = (deviceId: string): string => {
	// Try to find the device name from endpoints data (endpoints contain deviceId and name)
	const ep = endpoints.value.find((e) => e.deviceId === deviceId);
	return ep?.name ?? deviceId;
};

const formatTimestamp = (ts: string): string => {
	const date = new Date(ts);
	return isNaN(date.getTime()) ? ts : date.toLocaleString();
};

const loadBindingIntoForm = (binding: IMediaActivityBinding | undefined): void => {
	form.displayEndpointId = binding?.displayEndpointId ?? '';
	form.audioEndpointId = binding?.audioEndpointId ?? '';
	form.sourceEndpointId = binding?.sourceEndpointId ?? '';
	form.remoteEndpointId = binding?.remoteEndpointId ?? '';
	form.displayInputId = binding?.displayInputId ?? '';
	form.audioVolumePreset = binding?.audioVolumePreset ?? 30;

	lastLoadedForm.value = { ...form };
};

const onSelectActivity = (key: MediaActivityKey): void => {
	selectedActivity.value = key;
	const binding = findBindingByActivity(key);
	loadBindingIntoForm(binding);
};

const onSave = async (): Promise<void> => {
	const activityKey = selectedActivity.value;
	if (!activityKey) return;

	const payload = {
		displayEndpointId: form.displayEndpointId || null,
		audioEndpointId: form.audioEndpointId || null,
		sourceEndpointId: form.sourceEndpointId || null,
		remoteEndpointId: form.remoteEndpointId || null,
		displayInputId: selectedDisplayHasInputSelect.value ? form.displayInputId || null : null,
		audioVolumePreset: selectedAudioHasVolume.value ? form.audioVolumePreset : null,
	};

	try {
		const existingBinding = findBindingByActivity(activityKey);

		if (existingBinding) {
			await saveBinding(existingBinding.id, payload);
		} else {
			await createBinding(activityKey, payload);
		}

		// Reload bindings to get updated state
		await fetchBindings();

		// Reload form only if the same activity is still selected
		if (selectedActivity.value === activityKey) {
			const updatedBinding = findBindingByActivity(activityKey);
			loadBindingIntoForm(updatedBinding);
		}

		flashMessage.success(t('spacesModule.media.activities.savedSuccessfully'));
	} catch {
		// saveError is already set by the composable
	}
};

const onReset = (): void => {
	if (!selectedActivity.value) return;
	const binding = findBindingByActivity(selectedActivity.value);
	loadBindingIntoForm(binding);
};

const onApplyDefaults = async (): Promise<void> => {
	try {
		await applyDefaults();
		flashMessage.success(t('spacesModule.media.activities.defaultsApplied'));

		// Reload form if an activity is selected
		if (selectedActivity.value) {
			const binding = findBindingByActivity(selectedActivity.value);
			loadBindingIntoForm(binding);
		}
	} catch {
		flashMessage.error(t('spacesModule.media.activities.defaultsFailed'));
	}
};

const onActivate = async (key: MediaActivityKey): Promise<void> => {
	activatingKey.value = key;
	try {
		await activate(key);
		flashMessage.success(t('spacesModule.media.activities.activateSuccess'));
	} catch {
		flashMessage.error(t('spacesModule.media.activities.activateFailed'));
	} finally {
		activatingKey.value = null;
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

const onRerun = async (): Promise<void> => {
	if (!activeState.value?.activityKey) return;
	await onActivate(activeState.value.activityKey as MediaActivityKey);
};

const onRefreshStatus = async (): Promise<void> => {
	await fetchActiveState();
};

const onCopyDebugJson = async (): Promise<void> => {
	if (!activeState.value) return;
	try {
		await navigator.clipboard.writeText(JSON.stringify(activeState.value, null, 2));
		flashMessage.success(t('spacesModule.media.activities.copiedToClipboard'));
	} catch {
		// Clipboard API may fail in non-secure contexts; silently ignore
	}
};

const onPreview = async (key: MediaActivityKey): Promise<void> => {
	previewingKey.value = key;
	try {
		const result = await preview(key);
		previewData.value = result;
		previewDialogVisible.value = true;
	} catch {
		flashMessage.error(t('spacesModule.media.activities.previewFailed'));
	} finally {
		previewingKey.value = null;
	}
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

onBeforeMount(async () => {
	await Promise.all([fetchEndpoints(), fetchBindings(), fetchActiveState()]);
});
</script>
