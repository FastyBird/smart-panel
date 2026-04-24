<template>
	<dt
		class="b-r b-r-solid py-3 px-2 flex items-center justify-end"
		style="background: var(--el-fill-color-light)"
	>
		{{ t('spacesModule.detail.parentZone.title') }}
	</dt>
	<dd class="col-start-2 m-0 p-2 flex items-center gap-2 min-w-[8rem]">
		<div
			v-if="!isEditingFloor"
			role="button"
			tabindex="0"
			:aria-label="t('spacesModule.detail.parentZone.select')"
			class="flex items-center gap-2 cursor-pointer hover:opacity-70"
			@click="onFloorTextClick"
			@keydown.enter.prevent="onFloorTextClick"
			@keydown.space.prevent="onFloorTextClick"
		>
			<el-tag
				v-if="currentZone"
				type="success"
				size="small"
			>
				<div class="flex items-center gap-1">
					<icon :icon="currentZone.icon || 'mdi:home-floor-1'" />
					{{ currentZone.name }}
				</div>
			</el-tag>
			<span
				v-else
				class="text-gray-400 text-sm"
			>
				{{ t('spacesModule.detail.parentZone.none') }}
			</span>
		</div>

		<el-select
			v-else
			ref="floorSelectRef"
			v-model="selectedZoneId"
			:placeholder="t('spacesModule.detail.parentZone.select')"
			clearable
			size="small"
			class="max-w-[250px]"
			:loading="isSaving"
			@change="onZoneChange"
			@blur="onFloorSelectBlur"
		>
			<el-option
				v-for="zone in availableZones"
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
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElOption, ElSelect, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';
import { useSpace, useSpaces } from '../../../modules/spaces/composables';
import type { ISpace } from '../../../modules/spaces/store';

import type { ISpaceParentZoneSectionProps } from './space-parent-zone-section.types';

defineOptions({
	name: 'SpaceParentZoneSection',
});

const props = defineProps<ISpaceParentZoneSectionProps>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const spaceId = computed(() => props.space.id);

const { floorZoneSpaces, findById } = useSpaces();
const { editSpace } = useSpace(spaceId);

const selectedZoneId = ref<string | null>(props.space.parentId);
const isSaving = ref(false);
const isEditingFloor = ref(false);
const floorSelectRef = ref<InstanceType<typeof ElSelect> | null>(null);
const originalZoneId = ref<string | null>(props.space.parentId);
const justChanged = ref(false);

// Get the current parent zone
const currentZone = computed<ISpace | null>(() => {
	if (!props.space.parentId) return null;
	return findById(props.space.parentId);
});

// Get available zones (only floor-type zones, excluding self)
const availableZones = computed(() => {
	return floorZoneSpaces.value.filter((space) => space.id !== props.space.id);
});

const onFloorTextClick = (): void => {
	isEditingFloor.value = true;
	originalZoneId.value = props.space.parentId;
	selectedZoneId.value = props.space.parentId;
	justChanged.value = false;

	nextTick(() => {
		floorSelectRef.value?.focus?.();
	});
};

const onFloorSelectBlur = (): void => {
	setTimeout(() => {
		if (!justChanged.value && !isSaving.value && isEditingFloor.value) {
			isEditingFloor.value = false;
		}

		justChanged.value = false;
	}, 200);
};

const handleEscapeKey = (event: KeyboardEvent): void => {
	if (isEditingFloor.value && event.key === 'Escape') {
		selectedZoneId.value = originalZoneId.value;
		isEditingFloor.value = false;
		justChanged.value = false;
	}
};

// Watch for external changes to parent zone
watch(
	() => props.space.parentId,
	(newParentId) => {
		if (!isEditingFloor.value) {
			selectedZoneId.value = newParentId;
			originalZoneId.value = newParentId;
		}
	},
	{ immediate: true }
);

const onZoneChange = async (newZoneId: string | null): Promise<void> => {
	if (newZoneId === props.space.parentId) {
		isEditingFloor.value = false;
		justChanged.value = false;
		return;
	}

	justChanged.value = true;
	isSaving.value = true;

	try {
		await editSpace({
			name: props.space.name,
			parentId: newZoneId,
		});

		flashMessage.success(t('spacesModule.messages.edited', { space: props.space.name }));
		isEditingFloor.value = false;
		justChanged.value = false;
	} catch {
		// Revert selection on error
		selectedZoneId.value = originalZoneId.value;
		flashMessage.error(t('spacesModule.messages.saveError'));
		isEditingFloor.value = false;
		justChanged.value = false;
	} finally {
		isSaving.value = false;
	}
};

onMounted(() => {
	document.addEventListener('keydown', handleEscapeKey);
});

onBeforeUnmount(() => {
	document.removeEventListener('keydown', handleEscapeKey);
});
</script>
