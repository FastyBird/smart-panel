<template>
	<el-dialog
		v-model="visible"
		:title="t('spacesModule.dialogs.mediaActivities.title')"
		class="max-w-[800px]"
		destroy-on-close
		@open="onDialogOpen"
		@close="onClose"
	>
		<div
			v-loading="initialLoading"
			:element-loading-text="t('spacesModule.media.activities.loading')"
			class="flex flex-col gap-4"
		>
			<!-- Info alert -->
			<el-alert
				type="info"
				:closable="false"
				show-icon
				class="mb-0!"
			>
				{{ t('spacesModule.media.activities.description') }}
			</el-alert>

			<!-- Collapse panels (one per activity) -->
			<el-collapse
				v-model="activePanel"
				accordion
			>
				<el-collapse-item
					v-for="activity in activityKeys"
					:key="activity"
					:name="activity"
				>
					<template #title>
						<div class="flex items-center gap-3 flex-1 pr-2">
							<icon
								:icon="getActivityIcon(activity)"
								class="w[20px] h[20px] shrink-0"
							/>
							<span class="font-medium text-sm">
								{{ t(`spacesModule.media.activityLabels.${activity}`) }}
							</span>
							<el-tag
								:type="getActivityTagType(activity)"
								size="small"
								round
							>
								{{ getActivityStatusLabel(activity) }}
							</el-tag>
							<icon
								v-if="autoSaving[activity]"
								icon="mdi:loading"
								class="animate-spin text-blue-500 w[14px] h[14px]"
							/>
							<div class="flex-1" />
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

					<!-- Activity form body -->
					<el-form
						label-position="top"
						class="flex flex-col gap-2"
					>
						<!-- Display + Display input preset -->
						<div :class="hasInputSelect(activity, 'displayEndpointId') ? 'grid grid-cols-2 gap-x-4' : ''">
							<el-form-item :label="t('spacesModule.media.activities.slots.display')">
								<el-select
									v-model="forms[activity].displayEndpointId"
									:placeholder="t('spacesModule.media.activities.selectEndpoint')"
									clearable
									class="w-full"
								>
									<el-option
										v-for="ep in displayEndpoints"
										:key="ep.endpointId"
										:label="endpointDisplayName(ep)"
										:value="ep.endpointId"
									>
										<div class="flex items-center justify-between w-full">
											<span>{{ endpointDisplayName(ep) }}</span>
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

							<el-form-item
								v-if="hasInputSelect(activity, 'displayEndpointId')"
								:label="t('spacesModule.media.activities.overrides.displayInput')"
							>
								<el-select
									v-if="getInputSelectOptions(forms[activity].displayEndpointId).type === 'select'"
									v-model="forms[activity].displayInputId"
									:placeholder="t('spacesModule.media.activities.overrides.displayInputPlaceholder')"
									clearable
									class="w-full"
								>
									<el-option
										v-for="opt in getInputSelectOptionsList(forms[activity].displayEndpointId)"
										:key="String(opt)"
										:label="mediaInputSourceLabel(opt)"
										:value="String(opt)"
									/>
								</el-select>
								<el-input
									v-else
									v-model="forms[activity].displayInputId"
									:placeholder="t('spacesModule.media.activities.overrides.displayInputPlaceholder')"
									clearable
								/>
							</el-form-item>
						</div>

						<!-- Audio output + Audio input preset -->
						<div :class="hasInputSelect(activity, 'audioEndpointId') ? 'grid grid-cols-2 gap-x-4' : ''">
							<el-form-item :label="t('spacesModule.media.activities.slots.audio')">
								<el-select
									v-model="forms[activity].audioEndpointId"
									:placeholder="t('spacesModule.media.activities.selectEndpoint')"
									clearable
									class="w-full"
								>
									<el-option
										v-for="ep in audioEndpoints"
										:key="ep.endpointId"
										:label="endpointDisplayName(ep)"
										:value="ep.endpointId"
									>
										<div class="flex items-center justify-between w-full">
											<span>{{ endpointDisplayName(ep) }}</span>
											<div class="flex gap-1 ml-2">
												<el-tag
													v-if="ep.capabilities.volume"
													size="small"
													type="info"
												>
													{{ t('spacesModule.media.capabilities.volume') }}
												</el-tag>
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

							<el-form-item
								v-if="hasInputSelect(activity, 'audioEndpointId')"
								:label="t('spacesModule.media.activities.overrides.audioInput')"
							>
								<el-select
									v-if="getInputSelectOptions(forms[activity].audioEndpointId).type === 'select'"
									v-model="forms[activity].audioInputId"
									:placeholder="t('spacesModule.media.activities.overrides.audioInputPlaceholder')"
									clearable
									class="w-full"
								>
									<el-option
										v-for="opt in getInputSelectOptionsList(forms[activity].audioEndpointId)"
										:key="String(opt)"
										:label="mediaInputSourceLabel(opt)"
										:value="String(opt)"
									/>
								</el-select>
								<el-input
									v-else
									v-model="forms[activity].audioInputId"
									:placeholder="t('spacesModule.media.activities.overrides.audioInputPlaceholder')"
									clearable
								/>
							</el-form-item>
						</div>

						<!-- Audio volume preset (full width, below audio row) -->
						<el-form-item
							v-if="hasVolume(activity)"
							:label="t('spacesModule.media.activities.overrides.audioVolume')"
						>
							<el-slider
								v-model="forms[activity].audioVolumePreset"
								:min="0"
								:max="100"
								show-input
							/>
						</el-form-item>

						<!-- Source + Source input preset -->
						<div :class="hasInputSelect(activity, 'sourceEndpointId') ? 'grid grid-cols-2 gap-x-4' : ''">
							<el-form-item :label="t('spacesModule.media.activities.slots.source')">
								<el-select
									v-model="forms[activity].sourceEndpointId"
									:placeholder="t('spacesModule.media.activities.selectEndpoint')"
									clearable
									class="w-full"
								>
									<el-option
										v-for="ep in sourceEndpoints"
										:key="ep.endpointId"
										:label="endpointDisplayName(ep)"
										:value="ep.endpointId"
									>
										<div class="flex items-center justify-between w-full">
											<span>{{ endpointDisplayName(ep) }}</span>
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

							<el-form-item
								v-if="hasInputSelect(activity, 'sourceEndpointId')"
								:label="t('spacesModule.media.activities.overrides.sourceInput')"
							>
								<el-select
									v-if="getInputSelectOptions(forms[activity].sourceEndpointId).type === 'select'"
									v-model="forms[activity].sourceInputId"
									:placeholder="t('spacesModule.media.activities.overrides.sourceInputPlaceholder')"
									clearable
									class="w-full"
								>
									<el-option
										v-for="opt in getInputSelectOptionsList(forms[activity].sourceEndpointId)"
										:key="String(opt)"
										:label="mediaInputSourceLabel(opt)"
										:value="String(opt)"
									/>
								</el-select>
								<el-input
									v-else
									v-model="forms[activity].sourceInputId"
									:placeholder="t('spacesModule.media.activities.overrides.sourceInputPlaceholder')"
									clearable
								/>
							</el-form-item>
						</div>

						<!-- Remote target (full width, last) -->
						<el-form-item :label="t('spacesModule.media.activities.slots.remote')">
							<el-select
								v-model="forms[activity].remoteEndpointId"
								:placeholder="t('spacesModule.media.activities.selectEndpoint')"
								clearable
								class="w-full"
							>
								<el-option
									v-for="ep in remoteEndpoints"
									:key="ep.endpointId"
									:label="endpointDisplayName(ep)"
									:value="ep.endpointId"
								/>
							</el-select>
						</el-form-item>

						<!-- Save error for this activity -->
						<el-alert
							v-if="activityErrors[activity]"
							type="error"
							:title="t('spacesModule.media.activities.saveError')"
							:description="activityErrors[activity]!"
							show-icon
							closable
							@close="activityErrors[activity] = null"
						/>
					</el-form>
				</el-collapse-item>
			</el-collapse>

			<!-- Apply defaults at bottom (matches lighting roles pattern) -->
			<div class="flex justify-between items-center mt-2">
				<el-button
					size="small"
					:loading="applyingDefaults"
					@click="onApplyDefaults"
				>
					{{ t('spacesModule.media.activities.applyDefaults') }}
				</el-button>
				<div class="text-xs text-gray-400">
					{{ t('spacesModule.media.activities.applyDefaultsHint') }}
				</div>
			</div>

			<!-- Activation error -->
			<el-alert
				v-if="activationError"
				type="error"
				:title="t('spacesModule.media.activities.activateFailed')"
				:description="activationError"
				show-icon
				closable
				@close="activationError = null"
			/>
		</div>

		<template #footer>
			<el-button
				type="primary"
				@click="onClose"
			>
				{{ t('spacesModule.buttons.done.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';
import {
	ElAlert,
	ElButton,
	ElCollapse,
	ElCollapseItem,
	ElDialog,
	ElForm,
	ElFormItem,
	ElInput,
	ElOption,
	ElSelect,
	ElSlider,
	ElTag,
	vLoading,
} from 'element-plus';

import { useFlashMessage } from '../../../common';
import {
	getActivityColor,
	getActivityIcon,
	type IDerivedMediaEndpoint,
	type IMediaActivityBinding,
	type MediaActivationState,
	MediaActivityKey,
	MediaEndpointType,
	useSpaceMedia,
} from '../composables/useSpaceMedia';

import type { ISpaceMediaActivitiesDialogProps } from './space-media-activities-dialog.types';

defineOptions({
	name: 'SpaceMediaActivitiesDialog',
});

const props = defineProps<ISpaceMediaActivitiesDialogProps>();

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
	(e: 'bindings-changed'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const visible = computed({
	get: () => props.visible,
	set: (val) => emit('update:visible', val),
});

const spaceIdRef = computed(() => props.space?.id);
const {
	endpoints,
	activeState,
	fetchingEndpoints,
	fetchingBindings,
	activating,
	deactivating,
	applyingDefaults,
	activationError,
	fetchEndpoints,
	fetchBindings,
	fetchActiveState,
	activate,
	saveBinding,
	createBinding,
	applyDefaults,
	findBindingByActivity,
	endpointsByType,
} = useSpaceMedia(spaceIdRef);

type ConfiguredActivityKey = MediaActivityKey.watch | MediaActivityKey.listen | MediaActivityKey.gaming | MediaActivityKey.background;

const activityKeys: ConfiguredActivityKey[] = [
	MediaActivityKey.watch,
	MediaActivityKey.listen,
	MediaActivityKey.gaming,
	MediaActivityKey.background,
];

const activePanel = ref<string>('');
const activatingKey = ref<MediaActivityKey | null>(null);
const autoSaveReady = ref(false);
const initialLoading = computed(() => fetchingEndpoints.value || fetchingBindings.value);

// Per-activity form state
interface IFormState {
	displayEndpointId: string;
	audioEndpointId: string;
	sourceEndpointId: string;
	remoteEndpointId: string;
	displayInputId: string;
	audioInputId: string;
	sourceInputId: string;
	audioVolumePreset: number;
}

const createEmptyForm = (): IFormState => ({
	displayEndpointId: '',
	audioEndpointId: '',
	sourceEndpointId: '',
	remoteEndpointId: '',
	displayInputId: '',
	audioInputId: '',
	sourceInputId: '',
	audioVolumePreset: 30,
});

const forms = reactive<Record<ConfiguredActivityKey, IFormState>>({
	[MediaActivityKey.watch]: createEmptyForm(),
	[MediaActivityKey.listen]: createEmptyForm(),
	[MediaActivityKey.gaming]: createEmptyForm(),
	[MediaActivityKey.background]: createEmptyForm(),
});

const snapshots = reactive<Record<ConfiguredActivityKey, IFormState>>({
	[MediaActivityKey.watch]: createEmptyForm(),
	[MediaActivityKey.listen]: createEmptyForm(),
	[MediaActivityKey.gaming]: createEmptyForm(),
	[MediaActivityKey.background]: createEmptyForm(),
});

// Per-activity autosave state
const autoSaving = reactive<Record<ConfiguredActivityKey, boolean>>({
	[MediaActivityKey.watch]: false,
	[MediaActivityKey.listen]: false,
	[MediaActivityKey.gaming]: false,
	[MediaActivityKey.background]: false,
});

const activityErrors = reactive<Record<ConfiguredActivityKey, string | null>>({
	[MediaActivityKey.watch]: null,
	[MediaActivityKey.listen]: null,
	[MediaActivityKey.gaming]: null,
	[MediaActivityKey.background]: null,
});

// Filtered endpoints by type
const displayEndpoints = endpointsByType(MediaEndpointType.display);
const audioEndpoints = endpointsByType(MediaEndpointType.audio_output);
const sourceEndpoints = endpointsByType(MediaEndpointType.source);
const remoteEndpoints = endpointsByType(MediaEndpointType.remote_target);

// Load a binding into a specific activity form
const loadBindingIntoForm = (key: ConfiguredActivityKey, binding: IMediaActivityBinding | undefined): void => {
	forms[key].displayEndpointId = binding?.displayEndpointId ?? '';
	forms[key].audioEndpointId = binding?.audioEndpointId ?? '';
	forms[key].sourceEndpointId = binding?.sourceEndpointId ?? '';
	forms[key].remoteEndpointId = binding?.remoteEndpointId ?? '';
	forms[key].displayInputId = binding?.displayInputId ?? '';
	forms[key].audioInputId = binding?.audioInputId ?? '';
	forms[key].sourceInputId = binding?.sourceInputId ?? '';
	forms[key].audioVolumePreset = binding?.audioVolumePreset ?? 30;

	// Snapshot for dirty detection
	Object.assign(snapshots[key], { ...forms[key] });
};

const initAllForms = (): void => {
	for (const key of activityKeys) {
		const binding = findBindingByActivity(key);
		loadBindingIntoForm(key, binding);
	}
};

// Dirty detection
const isFormDirty = (key: ConfiguredActivityKey): boolean => {
	const form = forms[key];
	const snap = snapshots[key];
	return (
		form.displayEndpointId !== snap.displayEndpointId ||
		form.audioEndpointId !== snap.audioEndpointId ||
		form.sourceEndpointId !== snap.sourceEndpointId ||
		form.remoteEndpointId !== snap.remoteEndpointId ||
		form.displayInputId !== snap.displayInputId ||
		form.audioInputId !== snap.audioInputId ||
		form.sourceInputId !== snap.sourceInputId ||
		form.audioVolumePreset !== snap.audioVolumePreset
	);
};

// Override visibility helpers
const hasInputSelect = (activityKey: ConfiguredActivityKey, endpointField: 'displayEndpointId' | 'audioEndpointId' | 'sourceEndpointId'): boolean => {
	const epId = forms[activityKey][endpointField];
	if (!epId) return false;
	const ep = endpoints.value.find((e) => e.endpointId === epId);
	return ep?.capabilities.inputSelect ?? false;
};

const hasVolume = (activityKey: ConfiguredActivityKey): boolean => {
	const epId = forms[activityKey].audioEndpointId;
	if (!epId) return false;
	const ep = endpoints.value.find((e) => e.endpointId === epId);
	return ep?.capabilities.volume ?? false;
};

const getInputSelectOptions = (endpointId: string): { type: 'select'; options: (string | number)[] } | { type: 'text' } => {
	const ep = endpoints.value.find((e) => e.endpointId === endpointId);

	if (ep?.links?.inputSelect?.dataType === 'enum' && Array.isArray(ep.links.inputSelect.format) && ep.links.inputSelect.format.length > 0) {
		return { type: 'select', options: ep.links.inputSelect.format };
	}

	return { type: 'text' };
};

const getInputSelectOptionsList = (endpointId: string): (string | number)[] => {
	const result = getInputSelectOptions(endpointId);
	return result.type === 'select' ? result.options : [];
};

const mediaInputSourceLabel = (source: string | number): string => {
	const key = `spacesModule.media.activities.mediaInputSources.${source}`;
	const translated = t(key);
	return translated !== key ? translated : String(source);
};

const endpointDisplayName = (ep: IDerivedMediaEndpoint): string => {
	const typeLabel = t(`spacesModule.media.endpointTypes.${ep.type}`);
	const suffix = ` (${typeLabel})`;
	return ep.name.endsWith(suffix) ? ep.name.slice(0, -suffix.length) : ep.name;
};

// Status helpers
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

const getActivityContext = (key: MediaActivityKey): { isActive: boolean; state?: MediaActivationState; binding?: IMediaActivityBinding; hasSlots: boolean } => {
	const isActive = activeState.value?.activityKey === key && activeState.value?.state !== 'deactivated';
	const state = isActive ? (activeState.value!.state as MediaActivationState) : undefined;
	const binding = findBindingByActivity(key);
	const hasSlots = !!(binding?.displayEndpointId || binding?.audioEndpointId || binding?.sourceEndpointId || binding?.remoteEndpointId);
	return { isActive, state, binding, hasSlots };
};

const getActivityTagType = (key: MediaActivityKey): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
	const { isActive, state } = getActivityContext(key);

	// Runtime activation state overrides static color
	if (isActive && state) {
		return getStateTagType(state);
	}

	return getActivityColor(key);
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

// Autosave with debounce
const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

const buildPayload = (activityKey: ConfiguredActivityKey) => {
	const form = forms[activityKey];
	return {
		displayEndpointId: form.displayEndpointId || null,
		audioEndpointId: form.audioEndpointId || null,
		sourceEndpointId: form.sourceEndpointId || null,
		remoteEndpointId: form.remoteEndpointId || null,
		displayInputId: hasInputSelect(activityKey, 'displayEndpointId') ? form.displayInputId || null : null,
		audioInputId: hasInputSelect(activityKey, 'audioEndpointId') ? form.audioInputId || null : null,
		sourceInputId: hasInputSelect(activityKey, 'sourceEndpointId') ? form.sourceInputId || null : null,
		audioVolumePreset: hasVolume(activityKey) ? form.audioVolumePreset : null,
	};
};

const performAutoSave = async (key: ConfiguredActivityKey): Promise<void> => {
	if (autoSaving[key]) return;

	autoSaving[key] = true;
	activityErrors[key] = null;

	try {
		const existingBinding = findBindingByActivity(key);
		const payload = buildPayload(key);

		// Capture the form state that corresponds to what we're about to save,
		// so edits made during the HTTP request aren't silently marked as saved.
		const savedSnapshot = { ...forms[key] };

		if (existingBinding) {
			await saveBinding(existingBinding.id, payload);
		} else {
			await createBinding(key, payload);
		}

		Object.assign(snapshots[key], savedSnapshot);
	} catch (e: unknown) {
		activityErrors[key] = e instanceof Error ? e.message : 'Failed to save';
	} finally {
		autoSaving[key] = false;
	}
};

const debouncedAutoSave = (key: ConfiguredActivityKey): void => {
	const existing = pendingSaves.get(key);
	if (existing) clearTimeout(existing);

	pendingSaves.set(key, setTimeout(() => {
		pendingSaves.delete(key);
		performAutoSave(key);
	}, 500));
};

// Set up deep watchers for autosave on each activity form
for (const key of activityKeys) {
	watch(
		() => forms[key],
		() => {
			if (!autoSaveReady.value || !isFormDirty(key)) return;
			debouncedAutoSave(key);
		},
		{ deep: true }
	);

	// Clear stale overrides when endpoint changes
	watch(() => forms[key].displayEndpointId, () => {
		if (!autoSaveReady.value) return;
		forms[key].displayInputId = '';
	});
	watch(() => forms[key].audioEndpointId, () => {
		if (!autoSaveReady.value) return;
		forms[key].audioInputId = '';
		forms[key].audioVolumePreset = 30;
	});
	watch(() => forms[key].sourceEndpointId, () => {
		if (!autoSaveReady.value) return;
		forms[key].sourceInputId = '';
	});
}

// Actions
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

const onApplyDefaults = async (): Promise<void> => {
	autoSaveReady.value = false;

	try {
		await applyDefaults();
		initAllForms();
		flashMessage.success(t('spacesModule.media.activities.defaultsApplied'));
	} catch {
		flashMessage.error(t('spacesModule.media.activities.defaultsFailed'));
	}

	await nextTick();
	autoSaveReady.value = true;
};

const onDialogOpen = async (): Promise<void> => {
	autoSaveReady.value = false;

	await Promise.all([fetchEndpoints(), fetchBindings(), fetchActiveState()]);
	initAllForms();

	await nextTick();
	autoSaveReady.value = true;
};

const onClose = async (): Promise<void> => {
	autoSaveReady.value = false;

	// Flush pending debounced saves so no edits are lost
	const flushPromises: Promise<void>[] = [];

	for (const [key, timer] of pendingSaves) {
		clearTimeout(timer);
		pendingSaves.delete(key);
		flushPromises.push(performAutoSave(key as ConfiguredActivityKey));
	}

	// Also flush any dirty forms without a pending timer
	for (const key of activityKeys) {
		if (!flushPromises.length || !pendingSaves.has(key)) {
			if (isFormDirty(key)) {
				flushPromises.push(performAutoSave(key));
			}
		}
	}

	await Promise.allSettled(flushPromises);

	emit('bindings-changed');
	visible.value = false;
};
</script>
