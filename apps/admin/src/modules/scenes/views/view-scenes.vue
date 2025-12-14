<template>
	<app-bar-heading :heading="t('scenes.headings.list')" :sub-heading="t('scenes.subHeadings.list')" />
	<app-breadcrumbs :items="breadcrumbs" />

	<el-card class="scenes-list">
		<template #header>
			<div class="card-header">
				<span>{{ t('scenes.headings.list') }}</span>
				<el-button type="primary" @click="onAddScene">
					<template #icon>
						<icon icon="mdi:plus" />
					</template>
					{{ t('scenes.buttons.add.title') }}
				</el-button>
			</div>
		</template>

		<el-table v-loading="fetching" :data="scenes" stripe style="width: 100%">
			<el-table-column prop="name" :label="t('scenes.fields.name')" min-width="200">
				<template #default="{ row }">
					<div class="scene-name">
						<icon :icon="getCategoryIcon(row.category)" class="scene-icon" />
						<span>{{ row.name }}</span>
					</div>
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

import { ElCard, ElTable, ElTableColumn, ElButton, ElButtonGroup, ElTag, ElMessageBox, ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';

import { AppBarHeading, AppBreadcrumbs, type IBreadcrumb } from '../../../common';
import { useScenes } from '../composables/useScenes';
import { RouteNames, SceneCategory, SCENE_CATEGORY_ICONS } from '../scenes.constants';
import type { IScene } from '../store/scenes.store.types';

const { t } = useI18n();
const router = useRouter();

const { scenes, fetching, fetchScenes, triggerScene } = useScenes();

const triggering = ref<string[]>([]);

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
	} catch (e) {
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

		// TODO: Implement delete via store
		ElMessage.success(t('scenes.messages.deleted'));
	} catch {
		// Cancelled
	}
};

onMounted(async () => {
	await fetchScenes();
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
