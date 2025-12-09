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
			<div class="flex items-center gap-2">
				<el-button
					type="primary"
					plain
					@click="onEdit"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
					{{ t('displaysModule.actions.edit') }}
				</el-button>

				<el-button
					type="warning"
					plain
					@click="onManageTokens"
				>
					<template #icon>
						<icon icon="mdi:key" />
					</template>
					{{ t('displaysModule.actions.manageTokens') }}
				</el-button>

				<el-button
					type="danger"
					plain
					@click="onRemove"
				>
					<template #icon>
						<icon icon="mdi:delete" />
					</template>
					{{ t('displaysModule.actions.delete') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isDisplayRoute || isLGDevice"
		v-loading="isLoading"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-auto"
	>
		<div
			v-if="display"
			class="grid grid-cols-1 lg:grid-cols-2 gap-4"
		>
			<!-- Display Information -->
			<el-card shadow="never">
				<template #header>
					<div class="flex items-center gap-2">
						<icon
							icon="mdi:information"
							class="text-lg"
						/>
						<span>{{ t('displaysModule.detail.info.title') }}</span>
					</div>
				</template>

				<el-descriptions
					:column="1"
					border
				>
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
					<el-descriptions-item :label="t('displaysModule.detail.info.gridSize')">
						{{ display.cols }}x{{ display.rows }}
					</el-descriptions-item>
				</el-descriptions>
			</el-card>

			<!-- Display Settings -->
			<el-card shadow="never">
				<template #header>
					<div class="flex items-center gap-2">
						<icon
							icon="mdi:cog"
							class="text-lg"
						/>
						<span>{{ t('displaysModule.detail.settings.title') }}</span>
					</div>
				</template>

				<el-descriptions
					:column="1"
					border
				>
					<el-descriptions-item :label="t('displaysModule.detail.settings.name')">
						{{ display.name || '-' }}
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
		</div>

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
import { computed, inject, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElCard, ElDescriptions, ElDescriptionsItem, ElDrawer, ElIcon, ElMessage, ElMessageBox, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { useDisplay } from '../composables/composables';
import { RouteNames } from '../displays.constants';
import { displaysStoreKey } from '../store/keys';

import type { IViewDisplayProps } from './view-display.types';

defineOptions({
	name: 'ViewDisplay',
});

const props = defineProps<IViewDisplayProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const displaysStore = inject(displaysStoreKey);

const { isMDDevice, isLGDevice } = useBreakpoints();

const displayId = computed(() => props.id);
const { display, isLoading } = useDisplay(displayId);

useMeta({
	title: computed(() => display.value?.name || display.value?.macAddress || t('displaysModule.detail.title')),
});

const showDrawer = ref<boolean>(false);

const isDisplayRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.DISPLAY;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('displaysModule.title'),
				route: router.resolve({ name: RouteNames.DISPLAYS }),
			},
			{
				label: display.value?.name || display.value?.macAddress || t('displaysModule.detail.title'),
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

const onEdit = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DISPLAY_EDIT,
			params: { id: props.id },
		});
	} else {
		router.push({
			name: RouteNames.DISPLAY_EDIT,
			params: { id: props.id },
		});
	}
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

const onRemove = (): void => {
	ElMessageBox.confirm('Are you sure you want to delete this display? This action cannot be undone.', 'Delete Display', {
		confirmButtonText: 'Delete',
		cancelButtonText: 'Cancel',
		type: 'warning',
	})
		.then(async () => {
			try {
				await displaysStore?.remove({ id: props.id });
				ElMessage.success(t('displaysModule.messages.deleteSuccess'));
				router.push({ name: RouteNames.DISPLAYS });
			} catch {
				ElMessage.error(t('displaysModule.messages.deleteError'));
			}
		})
		.catch(() => {
			// Cancelled
		});
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
</script>
