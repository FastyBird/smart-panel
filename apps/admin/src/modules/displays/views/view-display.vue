<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:monitor"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ display?.name || display?.macAddress || t('displaysModule.detail.title') }}
		</template>

		<template #subtitle>
			{{ t('displaysModule.detail.title') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push({ name: RouteNames.DISPLAYS })"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('displaysModule.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="display?.name || display?.macAddress || t('displaysModule.detail.title')"
		:sub-heading="t('displaysModule.detail.title')"
		icon="mdi:monitor"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="warning"
					plain
					class="px-4! ml-2!"
					@click="onManageTokens"
				>
					<template #icon>
						<icon icon="mdi:key" />
					</template>
					{{ t('displaysModule.actions.manageTokens') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isDisplayRoute || isLGDevice"
		v-loading="isLoading"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-auto"
	>
		<el-row v-if="display">
			<!-- Display Information -->
			<el-col
				:xs="24"
				:sm="12"
				:md="8"
			>
				<el-card
					class="md:m-2 xs:my-1"
					body-class="p-0!"
				>
					<el-descriptions
						:label-width="170"
						:column="1"
						border
					>
						<template #title>
							<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
								<el-icon
									class="mr-2"
									size="28"
								>
									<icon icon="mdi:information" />
								</el-icon>
								{{ t('displaysModule.detail.info.title') }}
							</div>
						</template>

						<el-descriptions-item :label="t('displaysModule.detail.info.macAddress')">
							<code>{{ display.macAddress }}</code>
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.version')">
							{{ display.version }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.build')">
							{{ display.build || '-' }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.resolution')">
							{{ display.screenWidth }}x{{ display.screenHeight }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.pixelRatio')">
							{{ display.pixelRatio }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.registeredFromIp')">
							{{ formatIpAddress(display.registeredFromIp) }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.currentIpAddress')">
							{{ formatIpAddress(display.currentIpAddress) }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.info.status')">
							<el-tag :type="display.status === 'connected' ? 'success' : display.status === 'disconnected' ? 'warning' : display.status === 'lost' ? 'danger' : 'info'">
								{{ t(`displaysModule.states.${display.status ?? 'unknown'}`) }}
							</el-tag>
						</el-descriptions-item>
					</el-descriptions>
				</el-card>
			</el-col>

			<!-- Display Settings -->
			<el-col
				:xs="24"
				:sm="12"
				:md="8"
			>
				<el-card
					class="md:m-2 xs:my-1"
					body-class="p-0!"
				>
					<el-descriptions
						:label-width="170"
						:column="1"
						border
					>
						<template #title>
							<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
								<el-icon
									class="mr-2"
									size="28"
								>
									<icon icon="mdi:cog" />
								</el-icon>
								{{ t('displaysModule.detail.settings.title') }}
							</div>
						</template>

						<el-descriptions-item :label="t('displaysModule.detail.settings.gridSize')">
							{{ display.cols }}x{{ display.rows }}
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.settings.darkMode')">
							<el-tag :type="display.darkMode ? 'success' : 'info'">
								{{ display.darkMode ? 'Enabled' : 'Disabled' }}
							</el-tag>
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.settings.brightness')">
							{{ display.brightness }}%
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.settings.screenLockDuration')">
							{{ display.screenLockDuration }}s
						</el-descriptions-item>
						<el-descriptions-item :label="t('displaysModule.detail.settings.screenSaver')">
							<el-tag :type="display.screenSaver ? 'success' : 'info'">
								{{ display.screenSaver ? 'Enabled' : 'Disabled' }}
							</el-tag>
						</el-descriptions-item>
					</el-descriptions>
				</el-card>
			</el-col>

			<!-- Peripherals - Only shown if any peripheral is supported -->
			<el-col
				v-if="display.audioOutputSupported || display.audioInputSupported"
				:xs="24"
				:sm="12"
				:md="8"
			>
				<el-card
					class="md:m-2 xs:my-1"
					body-class="p-0!"
				>
					<el-descriptions
						:label-width="170"
						:column="1"
						border
					>
						<template #title>
							<div class="flex flex-row items-center pt-2 pl-2 min-h-10">
								<el-icon
									class="mr-2"
									size="28"
								>
									<icon icon="mdi:usb" />
								</el-icon>
								{{ t('displaysModule.detail.peripherals.title') }}
							</div>
						</template>

						<!-- Audio Output -->
						<template v-if="display.audioOutputSupported">
							<el-descriptions-item :label="t('displaysModule.detail.peripherals.audioOutput')">
								<el-tag :type="display.speaker ? 'success' : 'info'">
									{{ display.speaker ? 'Enabled' : 'Disabled' }}
								</el-tag>
							</el-descriptions-item>
							<el-descriptions-item :label="t('displaysModule.detail.peripherals.audioOutputVolume')">
								{{ display.speakerVolume }}%
							</el-descriptions-item>
						</template>

						<!-- Audio Input -->
						<template v-if="display.audioInputSupported">
							<el-descriptions-item :label="t('displaysModule.detail.peripherals.audioInput')">
								<el-tag :type="display.microphone ? 'success' : 'info'">
									{{ display.microphone ? 'Enabled' : 'Disabled' }}
								</el-tag>
							</el-descriptions-item>
							<el-descriptions-item :label="t('displaysModule.detail.peripherals.audioInputVolume')">
								{{ display.microphoneVolume }}%
							</el-descriptions-item>
						</template>
					</el-descriptions>
				</el-card>
			</el-col>
		</el-row>

		<div
			v-else-if="!isLoading"
			class="text-center py-8 text-gray-500"
		>
			{{ t('displaysModule.messages.notFound') }}
		</div>
	</div>

	<router-view
		v-else
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<el-drawer
		v-if="isLGDevice"
		v-model="showDrawer"
		:show-close="false"
		size="40%"
		:with-header="false"
		:before-close="onCloseDrawer"
	>
		<div class="flex flex-col h-full">
			<app-bar menu-button-hidden>
				<template #button-right>
					<app-bar-button
						:align="AppBarButtonAlign.RIGHT"
						class="mr-2"
						@click="() => onCloseDrawer()"
					>
						<template #icon>
							<el-icon>
								<icon icon="mdi:close" />
							</el-icon>
						</template>
					</app-bar-button>
				</template>
			</app-bar>

			<template v-if="showDrawer">
				<suspense>
					<router-view v-slot="{ Component }">
						<component :is="Component" />
					</router-view>
				</suspense>
			</template>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElCard, ElCol, ElDescriptions, ElDescriptionsItem, ElDrawer, ElIcon, ElRow, ElTag, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { useDisplay } from '../composables/composables';
import { RouteNames } from '../displays.constants';
import type { IDisplay } from '../store/displays.store.types';

import type { IViewDisplayProps } from './view-display.types';

defineOptions({
	name: 'ViewDisplay',
});

const props = defineProps<IViewDisplayProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const { isMDDevice, isLGDevice } = useBreakpoints();

const displayId = computed(() => props.id);
const { display, isLoading } = useDisplay(displayId);

const formatIpAddress = (ipAddress: string | null | undefined): string => {
	if (!ipAddress) {
		return '-';
	}
	const normalized = ipAddress.toLowerCase().trim();
	if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
		return t('displaysModule.table.columns.local');
	}
	return ipAddress;
};

const { meta } = useMeta({});

const showDrawer = ref<boolean>(false);

const isDisplayRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.DISPLAY;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('displaysModule.breadcrumbs.displays.list'),
				route: router.resolve({ name: RouteNames.DISPLAYS }),
			},
			{
				label: t('displaysModule.breadcrumbs.displays.detail', { display: display.value?.name || display.value?.macAddress }),
				route: router.resolve({ name: RouteNames.DISPLAY, params: { id: props.id } }),
			},
		];
	}
);

const onCloseDrawer = (done?: () => void): void => {
	router.replace({
		name: RouteNames.DISPLAY,
		params: { id: props.id },
	});

	done?.();
};

const onManageTokens = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DISPLAY_TOKENS,
			params: { id: props.id },
		});
	} else {
		router.push({
			name: RouteNames.DISPLAY_TOKENS,
			params: { id: props.id },
		});
	}
};

onBeforeMount((): void => {
	showDrawer.value =
		route.matched.find((matched) => matched.name === RouteNames.DISPLAY_EDIT || matched.name === RouteNames.DISPLAY_TOKENS) !== undefined;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value =
			route.matched.find((matched) => matched.name === RouteNames.DISPLAY_EDIT || matched.name === RouteNames.DISPLAY_TOKENS) !== undefined;
	}
);

watch(
	(): IDisplay | null => display.value,
	(val: IDisplay | null): void => {
		if (val !== null) {
			meta.title = t('displaysModule.meta.displays.detail.title', { display: val.name || val.macAddress });
		} else if (val === null && !isLoading.value) {
			// Display was deleted, redirect to list
			router.push({ name: RouteNames.DISPLAYS });
		}
	},
	{ immediate: true },
);
</script>
