<template>
	<view-header
		:title="t('scenes.headings.edit')"
		:subtitle="scene?.name ?? t('scenes.subHeadings.list')"
		icon="mdi:pencil"
		left="close"
		:primary="scene ? { label: t('scenes.buttons.save.title'), handler: () => (remoteFormSubmit = true) } : undefined"
		@back="formChanged ? onDiscard() : onClose()"
	/>

	<div class="flex flex-col overflow-hidden h-full">
		<!-- Loading State -->
		<div
			v-if="isLoading || !sceneReady"
			class="flex items-center justify-center h-full"
		>
			<el-icon
				class="is-loading"
				:size="32"
			>
				<icon icon="mdi:loading" />
			</el-icon>
		</div>

		<!-- Not Found State -->
		<div
			v-else-if="!scene"
			class="flex flex-col items-center justify-center h-full gap-4 p-4"
		>
			<el-icon
				:size="48"
				class="text-muted"
			>
				<icon icon="mdi:playlist-remove" />
			</el-icon>
			<div class="text-secondary">{{ t('scenes.messages.notFound') }}</div>
			<el-button
				type="primary"
				@click="onClose"
			>
				{{ t('scenes.buttons.backToList.title') }}
			</el-button>
		</div>

		<!-- Form -->
		<template v-else>
			<el-scrollbar class="grow-1 p-2 tp:px-4">
				<scene-edit-form
					:key="scene.id"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-changed="formChanged"
					:scene="scene"
				/>
			</el-scrollbar>

			<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
			<form-footer
				v-show="inDrawer || !isPhone"
				:dirty="formChanged"
				:saving="remoteFormResult === FormResult.WORKING"
				:can-save="formChanged && remoteFormResult !== FormResult.WORKING"
				@save="remoteFormSubmit = true"
				@discard="onDiscard"
				@close="onClose"
			/>
		</template>
	</div>
</template>

<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import { FormFooter, ViewHeader, useEditDrawer, useSizeClass } from '../../../common';
import { useSpaces } from '../../spaces/composables';
import SceneEditForm from '../components/scenes/scene-edit-form.vue';
import { useScene } from '../composables/composables';
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

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const { scene, isLoading, fetchScene } = useScene({ id: props.id });

const { fetchSpaces, firstLoadFinished: spacesLoaded } = useSpaces();

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
			if (inDrawer.value) {
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
	if (inDrawer.value) {
		router.replace({ name: RouteNames.SCENES });
	} else {
		router.push({ name: RouteNames.SCENES });
	}
};

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (inDrawer.value) {
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
	if (!spacesLoaded.value) {
		fetchSpaces();
	}

	await fetchScene();
	sceneReady.value = true;
});
</script>
