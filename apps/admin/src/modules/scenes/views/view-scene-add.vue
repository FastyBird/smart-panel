<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:plus"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('scenes.headings.add') }}
		</template>

		<template #subtitle>
			{{ t('scenes.subHeadings.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="onClose"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="remoteFormSubmit = true"
	>
		<span class="uppercase">{{ t('scenes.buttons.save') }}</span>
	</app-bar-button>

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 md:px-4">
			<scene-add-form
				:id="sceneId"
				:remote-form-submit="remoteFormSubmit"
				:remote-form-result="remoteFormResult"
				@update:remote-form-submit="remoteFormSubmit = $event"
				@update:remote-form-result="onFormResult"
				@update:remote-form-changed="remoteFormChanged = $event"
			/>
		</el-scrollbar>

		<div
			v-if="isMDDevice"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button link class="mr-2" @click="onClose">
					{{ t('scenes.buttons.cancel') }}
				</el-button>

				<el-button :loading="saving" type="primary" @click="remoteFormSubmit = true">
					{{ t('scenes.buttons.save') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElIcon, ElScrollbar } from 'element-plus';
import { Icon } from '@iconify/vue';
import { v4 as uuid } from 'uuid';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, useBreakpoints } from '../../../common';
import SceneAddForm from '../components/scenes/scene-add-form.vue';
import { FormResult, type FormResultType, RouteNames } from '../scenes.constants';

import type { IViewSceneAddProps } from './view-scene-add.types';

defineOptions({
	name: 'ViewSceneAdd',
});

defineProps<IViewSceneAddProps>();

defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();
const router = useRouter();

const { isMDDevice, isLGDevice } = useBreakpoints();

const sceneId = ref<string>(uuid());
const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormChanged = ref<boolean>(false);
const saving = ref<boolean>(false);

const onFormResult = (result: FormResultType): void => {
	remoteFormResult.value = result;

	if (result === FormResult.WORKING) {
		saving.value = true;
	} else if (result === FormResult.OK) {
		saving.value = false;
		onClose();
	} else if (result === FormResult.ERROR) {
		saving.value = false;
	}
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SCENES });
	} else {
		router.push({ name: RouteNames.SCENES });
	}
};
</script>
