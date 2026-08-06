<template>
	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:wizard-hat"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('devicesVirtualPlugin.wizard.title') }}
		</template>

		<template #subtitle>
			{{ t('devicesVirtualPlugin.wizard.subtitle') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="onCancel"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:heading="t('devicesVirtualPlugin.wizard.title')"
		:sub-heading="t('devicesVirtualPlugin.wizard.subtitle')"
		icon="mdi:wizard-hat"
	>
		<template
			v-if="isMDDevice"
			#extra
		>
			<el-button @click="onCancel">
				{{ t('devicesModule.buttons.cancel.title') }}
			</el-button>
		</template>
	</view-header>

	<div class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2">
		<el-card
			shadow="never"
			class="max-h-full flex flex-col overflow-hidden box-border"
			body-class="p-0! max-h-full overflow-hidden flex flex-col"
		>
			<template #header>
				<el-steps
					:active="0"
					finish-status="success"
					align-center
				>
					<el-step :title="t('devicesVirtualPlugin.wizard.steps.category')" />
					<el-step :title="t('devicesVirtualPlugin.wizard.steps.mapping')" />
					<el-step :title="t('devicesVirtualPlugin.wizard.steps.details')" />
					<el-step :title="t('devicesVirtualPlugin.wizard.steps.review')" />
				</el-steps>
			</template>

			<el-scrollbar class="flex-1 overflow-hidden h-full">
				<!--
					Step 1 of 4: category selection only. Steps 2-4 (mapping, details, review) and the
					back/next navigation between them are wired up in later tasks — see Tasks 9-11 in
					docs/superpowers/plans/2026-08-02-virtual-devices-admin.md. This view currently only
					hosts step 1's content and a way back to the device list.
				-->
				<div class="p-4">
					<virtual-wizard-category-step v-model="state.category" />
				</div>
			</el-scrollbar>
		</el-card>
	</div>

	<div
		v-if="!isMDDevice"
		class="mt-2 flex justify-end lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<el-button @click="onCancel">
			{{ t('devicesModule.buttons.cancel.title') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElCard, ElIcon, ElScrollbar, ElStep, ElSteps } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { RouteNames as DevicesRouteNames } from '../../../modules/devices';
import VirtualWizardCategoryStep from '../components/wizard/virtual-wizard-category-step.vue';
import type { IVirtualWizardState } from '../components/wizard/virtual-wizard.types';
import { RouteNames } from '../devices-virtual.constants';

defineOptions({
	name: 'ViewVirtualDeviceWizard',
});

const { t } = useI18n();
const router = useRouter();

const { isMDDevice, isLGDevice } = useBreakpoints();

useMeta({
	title: t('devicesVirtualPlugin.wizard.title'),
});

// Owned here and handed down to whichever step is active. Steps 2-4 (Tasks 9-10) read and write
// the same object as they land; nothing about this location changes when they do.
const state = reactive<IVirtualWizardState>({
	category: null,
	mappings: [],
	name: '',
	roomId: null,
	zoneIds: [],
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('devicesModule.breadcrumbs.devices.list'),
				route: router.resolve({ name: DevicesRouteNames.DEVICES }),
			},
			{
				label: t('devicesVirtualPlugin.wizard.breadcrumb'),
				route: router.resolve({ name: RouteNames.WIZARD }),
			},
		];
	}
);

const onCancel = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: DevicesRouteNames.DEVICES });
	} else {
		router.push({ name: DevicesRouteNames.DEVICES });
	}
};
</script>
