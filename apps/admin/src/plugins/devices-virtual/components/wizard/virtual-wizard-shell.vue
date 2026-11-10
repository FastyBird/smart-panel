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
			<el-button
				link
				:disabled="busy"
				data-test-id="wizard-cancel"
				@click="onCancel"
			>
				{{ t('devicesModule.wizard.actions.cancel') }}
			</el-button>
		</template>
	</view-header>

	<div class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2">
		<el-scrollbar class="flex-1 overflow-hidden h-full">
			<virtual-wizard-mode-selector
				class="mb-2"
				:mode="mode"
				:disabled="busy"
			/>

			<slot />
		</el-scrollbar>
	</div>

	<div
		v-if="!isMDDevice"
		class="mt-2 flex justify-end lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2"
	>
		<el-button
			link
			:disabled="busy"
			data-test-id="wizard-cancel"
			@click="onCancel"
		>
			{{ t('devicesModule.wizard.actions.cancel') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, onBeforeRouteLeave, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../../common';
import { RouteNames as DevicesRouteNames } from '../../../../modules/devices';
import type { DevicesVirtualPluginDeviceMode } from '../../../../openapi.constants';
import { RouteNames } from '../../devices-virtual.constants';

import VirtualWizardModeSelector from './virtual-wizard-mode-selector.vue';

defineOptions({
	name: 'VirtualWizardShell',
});

// The page chrome of the projection wizard (app bar, breadcrumbs, header, Cancel) for the kinds that
// are authored by a single editor rather than by the four projection steps. Without it those editors
// rendered as bare forms: no title, no breadcrumbs, no way back to the device list and no sign of the
// other kinds, which read as having been thrown out of the wizard.
const props = defineProps<{ mode: DevicesVirtualPluginDeviceMode; busy?: boolean }>();

const { t } = useI18n();
const router = useRouter();
const { isMDDevice, isLGDevice } = useBreakpoints();

useMeta({
	title: t('devicesVirtualPlugin.wizard.title'),
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('devicesModule.breadcrumbs.devices.list'),
			route: router.resolve({ name: DevicesRouteNames.DEVICES }),
		},
		{
			label: t('devicesVirtualPlugin.wizard.breadcrumb'),
			route: router.resolve({ name: RouteNames.WIZARD }),
		},
	]
);

// A save in flight cannot be cancelled, so leaving waits for it — same contract as the projection
// wizard, for the same reason: the editor that would report the outcome is unmounted by the navigation.
onBeforeRouteLeave((): boolean => !props.busy);

const onCancel = (): void => {
	if (props.busy) {
		return;
	}

	if (isLGDevice.value) {
		void router.replace({ name: DevicesRouteNames.DEVICES });
	} else {
		void router.push({ name: DevicesRouteNames.DEVICES });
	}
};
</script>
