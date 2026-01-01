<template>
	<el-card shadow="never" class="mt-4">
		<template #header>
			<span class="font-medium">{{ t('spacesModule.detail.parentZone.title') }}</span>
		</template>

		<div class="flex items-center gap-4">
			<div class="flex-1">
				<el-select
					v-model="selectedZoneId"
					:placeholder="t('spacesModule.detail.parentZone.select')"
					clearable
					class="w-full"
					:loading="isSaving"
					@change="onZoneChange"
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
							<el-tag v-if="zone.category" size="small" type="info" class="ml-auto">
								{{ t(`spacesModule.fields.spaces.category.options.${zone.category}`) }}
							</el-tag>
						</div>
					</el-option>
				</el-select>
			</div>

			<template v-if="currentZone">
				<el-tag type="success" size="large">
					<div class="flex items-center gap-1">
						<icon :icon="currentZone.icon || 'mdi:home-floor-1'" />
						{{ currentZone.name }}
					</div>
				</el-tag>
			</template>
			<span v-else class="text-gray-400">
				{{ t('spacesModule.detail.parentZone.none') }}
			</span>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import { ElCard, ElOption, ElSelect, ElTag } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { useFlashMessage } from '../../../common';
import { useSpace, useSpaces } from '../composables';
import type { ISpace } from '../store';

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

// Get the current parent zone
const currentZone = computed<ISpace | null>(() => {
	if (!props.space.parentId) return null;
	return findById(props.space.parentId);
});

// Get available zones (only floor-type zones, excluding self)
const availableZones = computed(() => {
	return floorZoneSpaces.value.filter((space) => space.id !== props.space.id);
});

// Watch for external changes to parent zone
watch(
	() => props.space.parentId,
	(newParentId) => {
		selectedZoneId.value = newParentId;
	}
);

const onZoneChange = async (newZoneId: string | null): Promise<void> => {
	if (newZoneId === props.space.parentId) return;

	isSaving.value = true;

	try {
		await editSpace({
			name: props.space.name,
			parentId: newZoneId,
		});

		flashMessage.success(t('spacesModule.messages.edited', { space: props.space.name }));
	} catch {
		// Revert selection on error
		selectedZoneId.value = props.space.parentId;
		flashMessage.error(t('spacesModule.messages.saveError'));
	} finally {
		isSaving.value = false;
	}
};
</script>
