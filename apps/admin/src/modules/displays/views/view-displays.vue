<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isDisplaysListRoute"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:monitor"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('displaysModule.title') }}
		</template>

		<template #subtitle>
			{{ t('displaysModule.description') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice && isDisplaysListRoute"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="router.push('/')"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>

		<span class="uppercase">{{ t('application.buttons.home.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('displaysModule.title')"
		:sub-heading="t('displaysModule.description')"
		icon="mdi:monitor"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="default"
					plain
					class="px-4! ml-2!"
					@click="fetchDisplays"
				>
					<template #icon>
						<icon icon="mdi:refresh" />
					</template>

					{{ t('displaysModule.actions.refresh') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isDisplaysListRoute || isLGDevice"
		class="grow-1 flex flex-col lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden"
	>
		<el-card
			shadow="never"
			class="flex-1 overflow-auto"
		>
			<el-table
				v-loading="isLoading"
				:data="displays"
				style="width: 100%"
				@row-click="onRowClick"
			>
				<el-table-column
					prop="name"
					:label="t('displaysModule.table.columns.name')"
					min-width="150"
				>
					<template #default="{ row }">
						{{ row.name || row.macAddress }}
					</template>
				</el-table-column>

				<el-table-column
					prop="macAddress"
					:label="t('displaysModule.table.columns.macAddress')"
					width="180"
				/>

				<el-table-column
					prop="version"
					:label="t('displaysModule.table.columns.version')"
					width="120"
				/>

				<el-table-column
					:label="t('displaysModule.table.columns.resolution')"
					width="150"
				>
					<template #default="{ row }">
						{{ row.screenWidth }}x{{ row.screenHeight }}
					</template>
				</el-table-column>

				<el-table-column
					prop="createdAt"
					:label="t('displaysModule.table.columns.createdAt')"
					width="180"
				>
					<template #default="{ row }">
						{{ formatDate(row.createdAt) }}
					</template>
				</el-table-column>

				<el-table-column
					fixed="right"
					width="120"
				>
					<template #default="{ row }">
						<el-button
							link
							type="primary"
							size="small"
							@click.stop="onDisplayDetail(row.id)"
						>
							{{ t('displaysModule.actions.viewDetail') }}
						</el-button>
					</template>
				</el-table-column>
			</el-table>

			<div
				v-if="!isLoading && displays.length === 0"
				class="text-center py-8 text-gray-500"
			>
				No displays registered yet. Displays will appear here once they connect to the system.
			</div>
		</el-card>
	</div>

	<router-view
		v-else
		:key="props.id"
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
				<view-error>
					<template #icon>
						<icon icon="mdi:monitor" />
					</template>
					<template #message>
						{{ t('displaysModule.messages.loadError') }}
					</template>

					<suspense>
						<router-view
							:key="props.id"
							v-slot="{ Component }"
						>
							<component
								:is="Component"
								v-model:remote-form-changed="remoteFormChanged"
							/>
						</router-view>
					</suspense>
				</view-error>
			</template>
		</div>
	</el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElCard, ElDrawer, ElIcon, ElTable, ElTableColumn } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import { useDisplays } from '../composables/composables';
import { RouteNames } from '../displays.constants';
import type { IDisplay } from '../store/displays.store.types';

import type { IViewDisplaysProps } from './view-displays.types';

defineOptions({
	name: 'ViewDisplays',
});

const props = defineProps<IViewDisplaysProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('displaysModule.title'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const { displays, isLoading, fetchDisplays } = useDisplays();

const mounted = ref<boolean>(false);

const showDrawer = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isDisplaysListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.DISPLAYS;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('displaysModule.title'),
				route: router.resolve({ name: RouteNames.DISPLAYS }),
			},
		];
	}
);

const formatDate = (date: Date | string): string => {
	const d = date instanceof Date ? date : new Date(date);
	return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
};

const onCloseDrawer = (done?: () => void): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.DISPLAYS,
		});
	} else {
		router.push({
			name: RouteNames.DISPLAYS,
		});
	}

	done?.();
};

const onDisplayDetail = (id: IDisplay['id']): void => {
	router.push({
		name: RouteNames.DISPLAY,
		params: {
			id,
		},
	});
};

const onRowClick = (row: IDisplay): void => {
	onDisplayDetail(row.id);
};

onBeforeMount((): void => {
	showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.DISPLAYS_EDIT) !== undefined;
});

onMounted((): void => {
	mounted.value = true;
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = route.matched.find((matched) => matched.name === RouteNames.DISPLAYS_EDIT) !== undefined;
	}
);
</script>
