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
		@click="onClose"
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
		<span class="uppercase">{{ t('scenes.buttons.save') }}</span>
	</app-bar-button>

	<div class="flex flex-col overflow-hidden h-full">
		<!-- Loading State -->
		<div v-if="isLoading" class="flex items-center justify-center h-full">
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
				{{ t('scenes.buttons.backToList') }}
			</el-button>
		</div>

		<!-- Form -->
		<template v-else>
			<el-scrollbar class="grow-1 p-2 md:px-4">
				<scene-edit-form
					:scene="scene"
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
		</template>
	</div>
</template>

<script setup lang="ts">
import { onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElIcon, ElScrollbar } from 'element-plus';
import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, useBreakpoints } from '../../../common';
import { useScene } from '../composables/composables';
import SceneEditForm from '../components/scenes/scene-edit-form.vue';
import { FormResult, type FormResultType, RouteNames } from '../scenes.constants';

interface IViewSceneEditProps {
	id: string;
}

defineOptions({
	name: 'ViewSceneEdit',
});

const props = defineProps<IViewSceneEditProps>();

defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();
const router = useRouter();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { scene, isLoading, fetchScene } = useScene({ id: props.id });

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

onBeforeMount(async () => {
	await fetchScene();
});
</script>
