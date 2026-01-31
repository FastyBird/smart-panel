<template>
	<el-card
		class="mt-2"
		body-class="p-0!"
	>
		<dl class="grid m-0">
			<dt
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('spacesModule.fields.spaces.name.title') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
				<el-text>
					{{ space.name }}
				</el-text>
			</dd>
			<dt
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('spacesModule.fields.spaces.type.title') }}
			</dt>
			<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
				<el-text>
					{{ t(`spacesModule.misc.types.${space.type}`) }}
				</el-text>
			</dd>
			<dt
				v-if="space.description"
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('spacesModule.fields.spaces.description.title') }}
			</dt>
			<dd
				v-if="space.description"
				class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]"
			>
				<el-text>
					{{ space.description }}
				</el-text>
			</dd>
			<dt
				v-if="space.icon"
				class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('spacesModule.fields.spaces.icon.title') }}
			</dt>
			<dd
				v-if="space.icon"
				class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center gap-2 min-w-[8rem]"
			>
				<el-icon>
					<icon :icon="space.icon" />
				</el-icon>
				<el-text>
					{{ space.icon }}
				</el-text>
			</dd>
			<!-- Lighting roles summary -->
			<space-lighting-roles-summary
				ref="lightingRolesSummaryRef"
				:space="space"
				@edit="showLightingRolesDialog = true"
			/>
			<!-- Climate roles summary -->
			<space-climate-roles-summary
				ref="climateRolesSummaryRef"
				:space="space"
				@edit="showClimateRolesDialog = true"
			/>
			<!-- Covers roles summary -->
			<space-covers-roles-summary
				ref="coversRolesSummaryRef"
				:space="space"
				@edit="showCoversRolesDialog = true"
			/>
			<!-- Sensor roles summary -->
			<space-sensor-roles-summary
				ref="sensorRolesSummaryRef"
				:space="space"
				@edit="showSensorRolesDialog = true"
			/>
			<!-- Inline Floor selector (Room only) -->
			<dt
				v-if="space.type === SpaceType.ROOM"
				class="b-r b-r-solid py-3 px-2 flex items-center justify-end"
				style="background: var(--el-fill-color-light)"
			>
				{{ t('spacesModule.detail.parentZone.title') }}
			</dt>
			<dd
				v-if="space.type === SpaceType.ROOM"
				class="col-start-2 m-0 p-2 flex items-center gap-2 min-w-[8rem]"
			>
				<!-- Text representation (shown when not editing) -->
				<div
					v-if="!isEditingFloor"
					class="flex items-center gap-2 cursor-pointer hover:opacity-70"
					@click="onFloorTextClick"
				>
					<el-tag
						v-if="currentFloor"
						type="success"
						size="small"
					>
						<div class="flex items-center gap-1">
							<icon :icon="currentFloor.icon || 'mdi:home-floor-1'" />
							{{ currentFloor.name }}
						</div>
					</el-tag>
					<span
						v-else
						class="text-gray-400 text-sm"
					>
						{{ t('spacesModule.detail.parentZone.none') }}
					</span>
				</div>
				<!-- Select box (shown when editing) -->
				<el-select
					v-else
					ref="floorSelectRef"
					v-model="selectedFloorId"
					:placeholder="t('spacesModule.detail.parentZone.select')"
					clearable
					size="small"
					class="max-w-[250px]"
					:loading="isSavingFloor"
					@change="onFloorChange"
					@blur="onFloorSelectBlur"
				>
					<el-option
						v-for="zone in floorZones"
						:key="zone.id"
						:label="zone.name"
						:value="zone.id"
					>
						<div class="flex items-center gap-2">
							<icon :icon="zone.icon || 'mdi:home-floor-1'" />
							<span>{{ zone.name }}</span>
						</div>
					</el-option>
				</el-select>
			</dd>
		</dl>
	</el-card>

	<!-- Lighting roles dialog -->
	<space-lighting-roles-dialog
		v-model:visible="showLightingRolesDialog"
		:space="space"
		@roles-changed="onLightingRolesChanged"
	/>

	<!-- Climate roles dialog -->
	<space-climate-roles-dialog
		v-model:visible="showClimateRolesDialog"
		:space="space"
		@roles-changed="onClimateRolesChanged"
	/>

	<!-- Covers roles dialog -->
	<space-covers-roles-dialog
		v-model:visible="showCoversRolesDialog"
		:space="space"
		@roles-changed="onCoversRolesChanged"
	/>

	<!-- Sensor roles dialog -->
	<space-sensor-roles-dialog
		v-model:visible="showSensorRolesDialog"
		:space="space"
		@roles-changed="onSensorRolesChanged"
	/>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElIcon, ElOption, ElSelect, ElTag, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';
import { isFloorZoneCategory, SpaceType } from '../spaces.constants';
import { type ISpace } from '../store';
import { useSpace, useSpaces } from '../composables';
import SpaceClimateRolesDialog from './space-climate-roles-dialog.vue';
import SpaceClimateRolesSummary from './space-climate-roles-summary.vue';
import SpaceCoversRolesDialog from './space-covers-roles-dialog.vue';
import SpaceCoversRolesSummary from './space-covers-roles-summary.vue';
import SpaceLightingRolesDialog from './space-lighting-roles-dialog.vue';
import SpaceLightingRolesSummary from './space-lighting-roles-summary.vue';
import SpaceSensorRolesDialog from './space-sensor-roles-dialog.vue';
import SpaceSensorRolesSummary from './space-sensor-roles-summary.vue';

import type { ISpaceDetailProps } from './space-detail.types';

defineOptions({
	name: 'SpaceDetail',
});

const props = defineProps<ISpaceDetailProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { spaces, firstLoadFinished, fetchSpaces } = useSpaces();
const { editSpace } = useSpace(computed(() => props.space?.id));

// Role dialog state
const showLightingRolesDialog = ref(false);
const showClimateRolesDialog = ref(false);
const showCoversRolesDialog = ref(false);
const showSensorRolesDialog = ref(false);
const lightingRolesSummaryRef = ref<InstanceType<typeof SpaceLightingRolesSummary> | null>(null);
const climateRolesSummaryRef = ref<InstanceType<typeof SpaceClimateRolesSummary> | null>(null);
const coversRolesSummaryRef = ref<InstanceType<typeof SpaceCoversRolesSummary> | null>(null);
const sensorRolesSummaryRef = ref<InstanceType<typeof SpaceSensorRolesSummary> | null>(null);

// Ensure all spaces are loaded when component mounts (needed for floor selector)
onMounted(async () => {
	// Only fetch if spaces haven't been loaded yet
	if (!firstLoadFinished.value) {
		await fetchSpaces().catch(() => {
			// Silently ignore fetch errors - floor selector will just be empty
		});
	}
});

// Floor selector
const selectedFloorId = ref<string | null>(null);
const isSavingFloor = ref<boolean>(false);
const isEditingFloor = ref<boolean>(false);
const floorSelectRef = ref<InstanceType<typeof ElSelect> | null>(null);
const originalFloorId = ref<string | null>(null);
const justChanged = ref<boolean>(false);

// Get floor-type zones for selector
const floorZones = computed(() => {
	return spaces.value.filter((s) => {
		if (s.type !== SpaceType.ZONE) return false;
		if (!isFloorZoneCategory(s.category)) return false;
		return true;
	});
});

// Get current parent floor
const currentFloor = computed<ISpace | null>(() => {
	if (!props.space?.parentId) return null;
	return spaces.value.find((s) => s.id === props.space?.parentId) ?? null;
});

const onFloorTextClick = (): void => {
	isEditingFloor.value = true;
	originalFloorId.value = props.space?.parentId ?? null;
	selectedFloorId.value = props.space?.parentId ?? null;
	justChanged.value = false;
	
	nextTick(() => {
		floorSelectRef.value?.focus();
	});
};

const onFloorSelectBlur = (): void => {
	// Use setTimeout to allow change event to fire first if selection was made
	setTimeout(() => {
		// Only exit edit mode if:
		// 1. No change was made (justChanged is false)
		// 2. We're not currently saving (isSavingFloor is false)
		// 3. We're still in edit mode (isEditingFloor is true)
		if (!justChanged.value && !isSavingFloor.value && isEditingFloor.value) {
			isEditingFloor.value = false;
		}
		justChanged.value = false;
	}, 200);
};

const handleEscapeKey = (event: KeyboardEvent): void => {
	if (isEditingFloor.value && event.key === 'Escape') {
		// Revert to original value
		selectedFloorId.value = originalFloorId.value;
		isEditingFloor.value = false;
		justChanged.value = false;
	}
};

const onFloorChange = async (newFloorId: string | null): Promise<void> => {
	if (!props.space || newFloorId === props.space.parentId) {
		// No change, just exit edit mode
		isEditingFloor.value = false;
		justChanged.value = false;
		return;
	}

	justChanged.value = true;
	isSavingFloor.value = true;

	try {
		await editSpace({
			name: props.space.name,
			parentId: newFloorId,
		});

		flashMessage.success(t('spacesModule.messages.edited', { space: props.space.name }));
		isEditingFloor.value = false;
		justChanged.value = false;
	} catch {
		// Revert selection on error
		selectedFloorId.value = originalFloorId.value;
		flashMessage.error(t('spacesModule.messages.saveError'));
		isEditingFloor.value = false;
		justChanged.value = false;
	} finally {
		isSavingFloor.value = false;
	}
};

// Watch for space changes to update selectedFloorId (only when not editing)
watch(
	(): string | null => props.space?.parentId ?? null,
	(val: string | null): void => {
		if (!isEditingFloor.value) {
			selectedFloorId.value = val;
			originalFloorId.value = val;
		}
	},
	{ immediate: true }
);

// Handle escape key globally when editing
onMounted(() => {
	document.addEventListener('keydown', handleEscapeKey);
});

onBeforeUnmount(() => {
	document.removeEventListener('keydown', handleEscapeKey);
});

// Role dialog handlers
const onLightingRolesChanged = (): void => {
	lightingRolesSummaryRef.value?.reload();
};

const onClimateRolesChanged = (): void => {
	climateRolesSummaryRef.value?.reload();
};

const onCoversRolesChanged = (): void => {
	coversRolesSummaryRef.value?.reload();
};

const onSensorRolesChanged = (): void => {
	sensorRolesSummaryRef.value?.reload();
};
</script>

