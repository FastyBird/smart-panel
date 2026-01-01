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

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 md:px-4">
			<div class="edit-scene-form">
				<p>{{ t('scenes.messages.editFormPlaceholder') }}</p>
			</div>
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
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElIcon, ElScrollbar } from 'element-plus';
import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, useBreakpoints } from '../../../common';
import { RouteNames } from '../scenes.constants';

const { t } = useI18n();
const router = useRouter();

const { isMDDevice, isLGDevice } = useBreakpoints();

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.SCENES });
	} else {
		router.push({ name: RouteNames.SCENES });
	}
};
</script>

<style scoped>
.edit-scene-form {
	padding: 20px;
}
</style>
