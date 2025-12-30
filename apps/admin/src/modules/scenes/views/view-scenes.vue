<template>
	<app-bar-heading :heading="t('scenes.headings.list')" :sub-heading="t('scenes.subHeadings.list')" />
	<app-breadcrumbs :items="breadcrumbs" />

	<el-card class="scenes-list">
		<template #header>
			<div class="card-header">
				<div class="header-left">
					<span>{{ t('scenes.headings.list') }}</span>
					<el-select
						v-model="selectedSpaceId"
						:placeholder="t('scenes.filters.allRooms')"
						clearable
						class="room-filter"
					>
						<el-option
							v-for="room in rooms"
							:key="room.id"
							:label="room.name"
							:value="room.id"
						/>
					</el-select>
				</div>
				<el-button type="primary" @click="onAddScene">
					<template #icon>
						<icon icon="mdi:plus" />
					</template>
					{{ t('scenes.buttons.add.title') }}
				</el-button>
			</div>
		</template>

		<el-table v-loading="fetching || fetchingSpaces" :data="filteredScenes" stripe style="width: 100%">
			<el-table-column prop="name" :label="t('scenes.fields.name')" min-width="200">
				<template #default="{ row }">
					<div class="scene-name">
						<icon :icon="getCategoryIcon(row.category)" class="scene-icon" />
						<span>{{ row.name }}</span>
					</div>
				</template>
			</el-table-column>

			<el-table-column prop="spaceId" :label="t('scenes.fields.room')" width="180">
				<template #default="{ row }">
					<span>{{ getSpaceName(row.spaceId) }}</span>
				</template>
			</el-table-column>

			<el-table-column prop="category" :label="t('scenes.fields.category')" width="150">
				<template #default="{ row }">
					<el-tag :type="getCategoryType(row.category)">
						{{ t(`scenes.categories.${row.category}`) }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column prop="enabled" :label="t('scenes.fields.enabled')" width="100" align="center">
				<template #default="{ row }">
					<icon :icon="row.enabled ? 'mdi:check-circle' : 'mdi:close-circle'" :class="row.enabled ? 'text-success' : 'text-danger'" />
				</template>
			</el-table-column>

			<el-table-column :label="t('scenes.fields.actions')" width="200" align="center">
				<template #default="{ row }">
					<el-button-group>
						<el-button
							v-if="row.isTriggerable"
							type="success"
							size="small"
							:loading="triggering.includes(row.id)"
							@click="onTriggerScene(row)"
						>
							<icon icon="mdi:play" />
						</el-button>
						<el-button v-if="row.isEditable" type="primary" size="small" @click="onEditScene(row)">
							<icon icon="mdi:pencil" />
						</el-button>
						<el-button v-if="row.isEditable" type="danger" size="small" @click="onDeleteScene(row)">
							<icon icon="mdi:delete" />
						</el-button>
					</el-button-group>
				</template>
			</el-table-column>
		</el-table>
	</el-card>

	<router-view />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElCard, ElTable, ElTableColumn, ElButton, ElButtonGroup, ElTag, ElMessageBox, ElMessage, ElSelect, ElOption } from 'element-plus';
import { Icon } from '@iconify/vue';

import { AppBarHeading, AppBreadcrumbs, type IBreadcrumb } from '../../../common';
import { useSpaces } from '../../spaces/composables';
import { SpaceType } from '../../spaces/spaces.constants';
import { useScenes } from '../composables/useScenes';
import { RouteNames, SceneCategory, SCENE_CATEGORY_ICONS } from '../scenes.constants';
import type { IScene } from '../store/scenes.store.types';

const { t } = useI18n();
const router = useRouter();

const { scenes, fetching, fetchScenes, triggerScene, removeScene } = useScenes();
const { spaces, fetching: fetchingSpaces, fetchSpaces } = useSpaces();

const triggering = ref<string[]>([]);
const selectedSpaceId = ref<string | null>(null);

// Filter spaces to only show rooms (not zones)
const rooms = computed(() => {
	return spaces.value.filter((space) => space.type === SpaceType.ROOM).sort((a, b) => a.name.localeCompare(b.name));
});

// Filter scenes by selected room
const filteredScenes = computed<IScene[]>(() => {
	const allScenes = scenes.value;
	if (!selectedSpaceId.value) {
		return allScenes.sort((a, b) => {
			// Sort by displayOrder first, then by name
			if (a.displayOrder !== b.displayOrder) {
				return a.displayOrder - b.displayOrder;
			}
			return a.name.localeCompare(b.name);
		});
	}
	return allScenes
		.filter((scene) => scene.spaceId === selectedSpaceId.value)
		.sort((a, b) => {
			if (a.displayOrder !== b.displayOrder) {
				return a.displayOrder - b.displayOrder;
			}
			return a.name.localeCompare(b.name);
		});
});

// Get space name by ID
const getSpaceName = (spaceId: string): string => {
	const space = spaces.value.find((s) => s.id === spaceId);
	return space?.name || t('scenes.fields.unknownRoom');
};

const breadcrumbs = computed<IBreadcrumb[]>(() => [
	{
		label: t('scenes.breadcrumbs.scenes'),
	},
]);

const getCategoryIcon = (category: SceneCategory): string => {
	return SCENE_CATEGORY_ICONS[category] || 'mdi:play-circle';
};

const getCategoryType = (category: SceneCategory): 'success' | 'warning' | 'info' | 'primary' | 'danger' | '' => {
	const typeMap: Record<SceneCategory, 'success' | 'warning' | 'info' | 'primary' | 'danger' | ''> = {
		[SceneCategory.GENERIC]: '',
		[SceneCategory.LIGHTING]: 'warning',
		[SceneCategory.CLIMATE]: 'info',
		[SceneCategory.SECURITY]: 'danger',
		[SceneCategory.ENTERTAINMENT]: 'primary',
		[SceneCategory.MORNING]: 'warning',
		[SceneCategory.EVENING]: 'info',
		[SceneCategory.AWAY]: '',
		[SceneCategory.HOME]: 'success',
		[SceneCategory.SLEEP]: 'info',
		[SceneCategory.CUSTOM]: '',
	};
	return typeMap[category] || '';
};

const onAddScene = (): void => {
	router.push({ name: RouteNames.SCENES_ADD });
};

const onEditScene = (scene: IScene): void => {
	router.push({ name: RouteNames.SCENES_EDIT, params: { id: scene.id } });
};

const onTriggerScene = async (scene: IScene): Promise<void> => {
	triggering.value.push(scene.id);

	try {
		await triggerScene(scene.id, 'admin');
		ElMessage.success(t('scenes.messages.triggered', { name: scene.name }));
	} catch {
		ElMessage.error(t('scenes.messages.triggerFailed'));
	} finally {
		triggering.value = triggering.value.filter((id) => id !== scene.id);
	}
};

const onDeleteScene = async (scene: IScene): Promise<void> => {
	try {
		await ElMessageBox.confirm(t('scenes.messages.confirmDelete', { name: scene.name }), t('scenes.headings.delete'), {
			confirmButtonText: t('scenes.buttons.delete'),
			cancelButtonText: t('scenes.buttons.cancel'),
			type: 'warning',
		});

		await removeScene(scene.id);
		ElMessage.success(t('scenes.messages.deleted'));
	} catch {
		// Cancelled or error
	}
};

onMounted(async () => {
	await Promise.all([fetchScenes(), fetchSpaces()]);
});
</script>

<style scoped>
.scenes-list {
	margin: 20px;
}

.card-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.header-left {
	display: flex;
	align-items: center;
	gap: 16px;
}

.room-filter {
	width: 200px;
}

.scene-name {
	display: flex;
	align-items: center;
	gap: 8px;
}

.scene-icon {
	font-size: 20px;
	color: var(--el-color-primary);
}

.text-success {
	color: var(--el-color-success);
}

.text-danger {
	color: var(--el-color-danger);
}
</style>
