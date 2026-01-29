<template>
	<div
		v-loading="initialLoading"
		:element-loading-text="t('spacesModule.media.activities.loading')"
		class="flex flex-col gap-4"
	>
		<div class="flex items-center justify-end gap-2 mb-2">
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
			<div class="w-240px shrink-0">
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
								:type="getActivityStatusType(activity)"
								size="small"
								round
							>
								{{ getActivityStatusLabel(activity) }}
							</el-tag>
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
						ref="formRef"
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
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElForm,
	ElFormItem,
	ElInput,
	ElOption,
	ElResult,
	ElSelect,
	ElSlider,
	ElTag,
	vLoading,
} from 'element-plus';
import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';
import {
	type IMediaActivityBinding,
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
	fetchingEndpoints,
	fetchingBindings,
	savingBinding,
	applyingDefaults,
	saveError,
	fetchEndpoints,
	fetchBindings,
	saveBinding,
	createBinding,
	applyDefaults,
	findBindingByActivity,
} = useSpaceMedia(spaceIdRef);

const activityKeys = [
	MediaActivityKey.watch,
	MediaActivityKey.listen,
	MediaActivityKey.gaming,
	MediaActivityKey.background,
	MediaActivityKey.off,
];

const selectedActivity = ref<MediaActivityKey | null>(null);

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

const formRef = ref();
const lastLoadedForm = ref<typeof form | null>(null);

const initialLoading = computed(() => fetchingEndpoints.value || fetchingBindings.value);

// Filtered endpoints by type
const displayEndpoints = computed(() => endpoints.value.filter((ep) => ep.type === MediaEndpointType.display));
const audioEndpoints = computed(() => endpoints.value.filter((ep) => ep.type === MediaEndpointType.audio_output));
const sourceEndpoints = computed(() => endpoints.value.filter((ep) => ep.type === MediaEndpointType.source));
const remoteEndpoints = computed(() => endpoints.value.filter((ep) => ep.type === MediaEndpointType.remote_target));

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

const getActivityStatusType = (key: MediaActivityKey): '' | 'success' | 'warning' | 'info' | 'danger' => {
	const binding = findBindingByActivity(key);
	if (!binding) return 'info';

	const hasSlots = binding.displayEndpointId || binding.audioEndpointId || binding.sourceEndpointId || binding.remoteEndpointId;
	return hasSlots ? 'success' : 'warning';
};

const getActivityStatusLabel = (key: MediaActivityKey): string => {
	const binding = findBindingByActivity(key);
	if (!binding) return t('spacesModule.media.activities.status.unconfigured');

	const hasSlots = binding.displayEndpointId || binding.audioEndpointId || binding.sourceEndpointId || binding.remoteEndpointId;
	return hasSlots
		? t('spacesModule.media.activities.status.configured')
		: t('spacesModule.media.activities.status.incomplete');
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
	if (!selectedActivity.value) return;

	const payload = {
		displayEndpointId: form.displayEndpointId || null,
		audioEndpointId: form.audioEndpointId || null,
		sourceEndpointId: form.sourceEndpointId || null,
		remoteEndpointId: form.remoteEndpointId || null,
		displayInputId: form.displayInputId || null,
		audioVolumePreset: selectedAudioHasVolume.value ? form.audioVolumePreset : null,
	};

	try {
		const existingBinding = findBindingByActivity(selectedActivity.value);

		if (existingBinding) {
			await saveBinding(existingBinding.id, payload);
		} else {
			await createBinding(selectedActivity.value, payload);
		}

		// Reload bindings to get updated state
		await fetchBindings();

		// Reload form with updated binding
		const updatedBinding = findBindingByActivity(selectedActivity.value);
		loadBindingIntoForm(updatedBinding);

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
	await applyDefaults();
	flashMessage.success(t('spacesModule.media.activities.defaultsApplied'));

	// Reload form if an activity is selected
	if (selectedActivity.value) {
		const binding = findBindingByActivity(selectedActivity.value);
		loadBindingIntoForm(binding);
	}
};

onBeforeMount(async () => {
	await Promise.all([fetchEndpoints(), fetchBindings()]);
});
</script>
