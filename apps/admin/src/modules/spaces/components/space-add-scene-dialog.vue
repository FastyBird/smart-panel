<template>
	<el-dialog
		v-model="visible"
		:title="t('spacesModule.detail.scenes.selectScene')"
		class="max-w-[700px]"
		@close="onClose"
	>
		<el-input
			v-model="searchQuery"
			:placeholder="t('spacesModule.detail.scenes.searchPlaceholder')"
			clearable
			class="mb-4"
		>
			<template #prefix>
				<icon icon="mdi:magnify" />
			</template>
		</el-input>

		<el-table
			:data="filteredAvailableScenes"
			max-height="400px"
			table-layout="fixed"
			row-key="id"
		>
			<template #empty>
				<div
					v-if="availableScenes.length === 0"
					class="h-full w-full leading-normal"
				>
					<el-result class="h-full w-full">
						<template #icon>
							<icon-with-child :size="80">
								<template #primary>
									<icon icon="mdi:play-box-multiple" />
								</template>
								<template #secondary>
									<icon icon="mdi:information" />
								</template>
							</icon-with-child>
						</template>

						<template #title>
							{{ t('spacesModule.detail.scenes.noAvailable') }}
						</template>
					</el-result>
				</div>

				<div
					v-else-if="searchQuery.trim() && filteredAvailableScenes.length === 0"
					class="h-full w-full leading-normal"
				>
					<el-result class="h-full w-full">
						<template #icon>
							<icon-with-child :size="80">
								<template #primary>
									<icon icon="mdi:play-box-multiple" />
								</template>
								<template #secondary>
									<icon icon="mdi:filter-multiple" />
								</template>
							</icon-with-child>
						</template>

						<template #title>
							<el-text class="block">
								{{ t('spacesModule.detail.scenes.noFilteredScenes') }}
							</el-text>
						</template>
					</el-result>
				</div>
			</template>
			<el-table-column :label="t('spacesModule.detail.scenes.name')" min-width="200">
				<template #default="{ row }">
					<div class="flex items-center gap-2">
						<el-avatar :size="32">
							<icon :icon="getSceneIcon(row)" class="w[20px] h[20px]" />
						</el-avatar>
						<div>
							<template v-if="row.description">
								<strong class="block text-sm">{{ row.name }}</strong>
								<el-text
									size="small"
									class="block leading-4"
									truncated
								>
									{{ row.description }}
								</el-text>
							</template>
							<template v-else>
								<div class="font-medium">{{ row.name }}</div>
							</template>
						</div>
					</div>
				</template>
			</el-table-column>

			<el-table-column :label="t('spacesModule.detail.scenes.assignedSpace')" width="150">
				<template #default="{ row }">
					<el-tag v-if="row.primarySpaceId" size="small" type="warning">
						{{ getSpaceName(row.primarySpaceId) }}
					</el-tag>
					<span v-else class="text-gray-400 text-sm">-</span>
				</template>
			</el-table-column>

			<el-table-column label="" width="150" align="right">
				<template #default="{ row }">
					<el-button
						:type="row.primarySpaceId ? 'warning' : 'default'"
						plain
						size="small"
						:loading="assigningSceneId === row.id"
						@click="onAssignScene(row)"
					>
						<template #icon>
							<icon :icon="row.primarySpaceId ? 'mdi:swap-horizontal' : 'mdi:plus'" />
						</template>
						{{ row.primarySpaceId ? t('spacesModule.detail.scenes.reassign') : t('spacesModule.detail.scenes.assign') }}
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<template #footer>
			<el-button @click="onClose">
				{{ t('spacesModule.buttons.close.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAvatar, ElButton, ElDialog, ElInput, ElResult, ElTable, ElTableColumn, ElTag, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild, injectStoresManager, useFlashMessage } from '../../../common';
import { SCENE_CATEGORY_ICONS, SceneCategory } from '../../scenes/scenes.constants';
import { scenesStoreKey } from '../../scenes/store/keys';
import type { IScene } from '../../scenes/store/scenes.store.types';
import { useSpaces } from '../composables';

import type { ISpaceAddSceneDialogProps } from './space-add-scene-dialog.types';

defineOptions({
	name: 'SpaceAddSceneDialog',
});

const props = defineProps<ISpaceAddSceneDialogProps>();

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
	(e: 'scene-added'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const storesManager = injectStoresManager();

const scenesStore = storesManager.getStore(scenesStoreKey);

const { findById } = useSpaces();

const searchQuery = ref('');
const assigningSceneId = ref<string | null>(null);

// Get available scenes (not assigned to current space)
const availableScenes = computed(() => {
	return scenesStore.findAll()
		.filter((scene) => {
			// Filter out drafts
			if (scene.draft) return false;
			// Filter out scenes already in this space
			return scene.primarySpaceId !== props.spaceId;
		})
		.sort((a, b) => a.name.localeCompare(b.name));
});

// Filter available scenes by search query
const filteredAvailableScenes = computed(() => {
	const filtered = !searchQuery.value.trim()
		? availableScenes.value
		: availableScenes.value.filter((scene) => {
			const query = searchQuery.value.toLowerCase();
			return scene.name.toLowerCase().includes(query) ||
				scene.description?.toLowerCase().includes(query);
		});

	return filtered.sort((a, b) => a.name.localeCompare(b.name));
});

const getSceneIcon = (scene: IScene): string => {
	return SCENE_CATEGORY_ICONS[scene.category] || SCENE_CATEGORY_ICONS[SceneCategory.GENERIC];
};

const getSpaceName = (spaceId: string): string => {
	const space = findById(spaceId);
	return space?.name || 'Unknown';
};

const visible = computed({
	get: () => props.visible,
	set: (val) => emit('update:visible', val),
});

const onClose = (): void => {
	visible.value = false;
	searchQuery.value = '';
	assigningSceneId.value = null;
};

const onAssignScene = async (scene: IScene): Promise<void> => {
	assigningSceneId.value = scene.id;
	try {
		await scenesStore.edit({
			id: scene.id,
			data: {
				primarySpaceId: props.spaceId,
			},
		});
		flashMessage.success(t('spacesModule.detail.scenes.assigned', { name: scene.name }));
		emit('scene-added');
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	} finally {
		assigningSceneId.value = null;
	}
};

watch(
	() => props.visible,
	(val) => {
		if (!val) {
			searchQuery.value = '';
			assigningSceneId.value = null;
		}
	}
);
</script>
