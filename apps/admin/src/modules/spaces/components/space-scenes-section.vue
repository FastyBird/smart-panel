<template>
	<el-table
		v-loading="loading"
		:element-loading-text="t('spacesModule.detail.scenes.loading')"
		:data="scenes"
		table-layout="fixed"
		row-key="id"
	>
		<el-table-column :label="t('spacesModule.detail.scenes.name')" min-width="200">
			<template #default="{ row }">
				<div class="flex items-center gap-2">
					<el-avatar :size="32">
						<icon :icon="getSceneCategoryIcon(row.category)" class="w[20px] h[20px]" />
					</el-avatar>
					<div>
						<div class="font-medium">{{ row.name }}</div>
						<div v-if="row.description" class="text-xs text-gray-500">
							{{ row.description }}
						</div>
					</div>
				</div>
			</template>
		</el-table-column>

		<el-table-column :label="t('spacesModule.detail.scenes.category')" width="150">
			<template #default="{ row }">
				<el-tag size="small" type="info">
					{{ row.category }}
				</el-tag>
			</template>
		</el-table-column>

		<el-table-column :label="t('spacesModule.detail.scenes.status')" width="100" align="center">
			<template #default="{ row }">
				<el-tag
					:type="row.enabled ? 'success' : 'info'"
					size="small"
				>
					{{ row.enabled ? t('spacesModule.detail.scenes.enabled') : t('spacesModule.detail.scenes.disabled') }}
				</el-tag>
			</template>
		</el-table-column>

		<el-table-column label="" width="220" align="right">
			<template #default="{ row }">
				<div class="flex items-center gap-2 justify-end">
					<el-button
						type="warning"
						plain
						size="small"
						@click="onReassignScene(row)"
					>
						<template #icon>
							<icon icon="mdi:swap-horizontal" />
						</template>
						{{ t('spacesModule.detail.scenes.reassign') }}
					</el-button>
					<el-button
						type="danger"
						plain
						size="small"
						@click="onRemoveScene(row)"
					>
						<template #icon>
							<icon icon="mdi:close" />
						</template>
						{{ t('spacesModule.detail.scenes.remove') }}
					</el-button>
				</div>
			</template>
		</el-table-column>

		<template #empty>
			<div
				v-if="loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:play-box-multiple" />
							</template>
							<template #secondary>
								<icon icon="mdi:database-refresh" />
							</template>
						</icon-with-child>
					</template>
				</el-result>
			</div>

			<div
				v-else
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
						{{ t('spacesModule.detail.scenes.empty') }}
					</template>

					<template #extra>
						<el-button
							type="primary"
							plain
							@click="openAddDialog"
						>
							<template #icon>
								<icon icon="mdi:plus" />
							</template>

							{{ t('spacesModule.detail.scenes.add') }}
						</el-button>
					</template>
				</el-result>
			</div>
		</template>
	</el-table>

	<!-- Reassign Scene Dialog -->
	<el-dialog
		v-model="showReassignDialog"
		:title="t('spacesModule.detail.scenes.reassign')"
		width="400px"
	>
		<p class="mb-4">{{ t('spacesModule.detail.scenes.selectSpace') }}</p>

		<el-select
			v-model="selectedTargetSpace"
			:placeholder="t('spacesModule.onboarding.selectSpace')"
			clearable
			class="w-full"
		>
			<el-option
				v-for="space in allSpaces"
				:key="space.id"
				:label="space.name"
				:value="space.id"
				:disabled="space.id === props.spaceId"
			/>
		</el-select>

		<template #footer>
			<el-button @click="showReassignDialog = false">
				{{ t('spacesModule.buttons.cancel.title') }}
			</el-button>
			<el-button type="primary" :loading="isReassigning" @click="confirmReassign">
				{{ t('spacesModule.buttons.save.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { onMounted, ref, toRef } from 'vue';

import { Icon } from '@iconify/vue';
import {
	ElAvatar,
	ElButton,
	ElDialog,
	ElMessageBox,
	ElOption,
	ElResult,
	ElSelect,
	ElTable,
	ElTableColumn,
	ElTag,
	vLoading,
} from 'element-plus';
import { useI18n } from 'vue-i18n';

import { IconWithChild, useFlashMessage } from '../../../common';
import { SCENE_CATEGORY_ICONS, SceneCategory } from '../../scenes/scenes.constants';
import type { IScene } from '../../scenes/store/scenes.store.types';
import { useSpaceScenes, useSpaces } from '../composables';

import type { ISpaceScenesSectionProps } from './space-scenes-section.types';

defineOptions({
	name: 'SpaceScenesSection',
});

const props = defineProps<ISpaceScenesSectionProps>();

const emit = defineEmits<{
	(e: 'open-add-dialog'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { spaces: allSpaces } = useSpaces();

const spaceIdRef = toRef(props, 'spaceId');

const {
	scenes,
	loading,
	firstLoadFinished,
	fetchScenes,
	reassignScene,
	removeScene,
} = useSpaceScenes(spaceIdRef);

const showReassignDialog = ref(false);
const selectedScene = ref<IScene | null>(null);
const selectedTargetSpace = ref<string | null>(null);
const isReassigning = ref(false);

const getSceneCategoryIcon = (category: SceneCategory): string => {
	return SCENE_CATEGORY_ICONS[category] || SCENE_CATEGORY_ICONS[SceneCategory.GENERIC];
};

const openAddDialog = (): void => {
	emit('open-add-dialog');
};

const onReassignScene = (scene: IScene): void => {
	selectedScene.value = scene;
	selectedTargetSpace.value = null;
	showReassignDialog.value = true;
};

const confirmReassign = async (): Promise<void> => {
	if (!selectedScene.value) return;

	isReassigning.value = true;

	try {
		await reassignScene(selectedScene.value.id, selectedTargetSpace.value);
		showReassignDialog.value = false;
		flashMessage.success(t('spacesModule.detail.scenes.reassigned', { name: selectedScene.value.name }));
	} catch {
		flashMessage.error(t('spacesModule.messages.saveError'));
	} finally {
		isReassigning.value = false;
	}
};

const onRemoveScene = (scene: IScene): void => {
	ElMessageBox.confirm(
		t('spacesModule.detail.scenes.confirmRemove', { name: scene.name }),
		t('spacesModule.detail.scenes.removeHeading'),
		{
			confirmButtonText: t('spacesModule.buttons.yes.title'),
			cancelButtonText: t('spacesModule.buttons.no.title'),
			type: 'warning',
		}
	)
		.then(async (): Promise<void> => {
			try {
				await removeScene(scene.id);
				flashMessage.success(t('spacesModule.detail.scenes.removed', { name: scene.name }));
			} catch {
				flashMessage.error(t('spacesModule.messages.saveError'));
			}
		})
		.catch((): void => {
			flashMessage.info(t('spacesModule.detail.scenes.removeCanceled'));
		});
};

onMounted(async () => {
	// Only fetch if scenes haven't been loaded yet
	if (!firstLoadFinished.value) {
		await fetchScenes();
	}
});

// Expose methods for parent component
defineExpose({
	openAddDialog,
	fetchScenes,
});
</script>
