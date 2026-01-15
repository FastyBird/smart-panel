<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:pencil"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('scenes.headings.edit') }}
		</template>

		<template #subtitle>
			{{ scene?.name ?? t('scenes.subHeadings.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="formChanged ? onDiscard() : onClose()"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice && scene"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="remoteFormSubmit = true"
	>
		<span class="uppercase">{{ t('scenes.buttons.save.title') }}</span>
	</app-bar-button>

	<div class="flex flex-col overflow-hidden h-full">
		<!-- Loading State -->
		<div v-if="isLoading || !sceneReady" class="flex items-center justify-center h-full">
			<el-icon class="is-loading" :size="32">
				<icon icon="mdi:loading" />
			</el-icon>
		</div>

		<!-- Not Found State -->
		<div v-else-if="!scene" class="flex flex-col items-center justify-center h-full gap-4 p-4">
			<el-icon :size="48" class="text-gray-300">
				<icon icon="mdi:playlist-remove" />
			</el-icon>
			<div class="text-gray-500">{{ t('scenes.messages.notFound') }}</div>
			<el-button type="primary" @click="onClose">
				{{ t('scenes.buttons.backToList.title') }}
			</el-button>
		</div>

		<!-- Form -->
		<template v-else>
			<el-scrollbar class="grow-1 p-2 md:px-4">
				<scene-edit-form
					:key="scene.id"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-changed="formChanged"
					:scene="scene"
				/>
			</el-scrollbar>

			<div
				v-if="isMDDevice"
				class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
				style="background-color: var(--el-drawer-bg-color)"
			>
				<div class="p-2">
					<el-button
						v-if="formChanged"
						link
						class="mr-2"
						@click="onDiscard"
					>
						{{ t('scenes.buttons.discard.title') }}
					</el-button>
					<el-button
						v-if="!formChanged"
						link
						class="mr-2"
						@click="onClose"
					>
						{{ t('scenes.buttons.close.title') }}
					</el-button>

					<el-button
						:loading="remoteFormResult === FormResult.WORKING"
						:disabled="remoteFormResult === FormResult.WORKING || !formChanged"
						type="primary"
						@click="remoteFormSubmit = true"
					>
						{{ t('scenes.buttons.save.title') }}
					</el-button>
				</div>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';
import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, useBreakpoints } from '../../../common';
import { useScene } from '../composables/composables';
import SceneEditForm from '../components/scenes/scene-edit-form.vue';
import { FormResult, type FormResultType, RouteNames } from '../scenes.constants';

import type { IViewSceneEditProps } from './view-scene-edit.types';

defineOptions({
	name: 'ViewSceneEdit',
});

const props = defineProps<IViewSceneEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();
const router = useRouter();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { scene, isLoading, fetchScene } = useScene({ id: props.id });

// Track if we've finished loading the full scene for editing
const sceneReady = ref<boolean>(false);

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const formChanged = ref<boolean>(props.remoteFormChanged ?? false);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('scenes.texts.confirmDiscard'), t('scenes.headings.discard'), {
		confirmButtonText: t('scenes.buttons.yes.title'),
		cancelButtonText: t('scenes.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.SCENES });
			} else {
				router.push({ name: RouteNames.SCENES });
			}
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SCENES });
	} else {
		router.push({ name: RouteNames.SCENES });
	}
};

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.SCENES });
			} else {
				router.push({ name: RouteNames.SCENES });
			}
		}
	}
);

watch(
	(): boolean => props.remoteFormChanged,
	(val: boolean): void => {
		if (val !== undefined) {
			formChanged.value = val;
		}
	},
	{ immediate: true }
);

watch(
	(): boolean => formChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);

onBeforeMount(async () => {
	await fetchScene();
	sceneReady.value = true;
});
</script>
