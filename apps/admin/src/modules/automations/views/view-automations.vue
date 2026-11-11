<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice && isAutomationsListRoute"
		teleport
	>
		<template #icon>
			<icon
				:icon="AUTOMATION_DEFAULT_ICON"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('automations.headings.list') }}
		</template>

		<template #subtitle>
			{{ t('automations.subHeadings.list') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice && isAutomationsListRoute"
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

	<app-bar-button
		v-if="!isMDDevice && isAutomationsListRoute"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onAutomationCreate"
	>
		<span class="uppercase">{{ t('automations.buttons.add.title') }}</span>
	</app-bar-button>

	<view-header
		:heading="t('automations.headings.list')"
		:sub-heading="t('automations.subHeadings.list')"
		:icon="AUTOMATION_DEFAULT_ICON"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					type="primary"
					plain
					class="px-4! ml-2!"
					@click="onAutomationCreate"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>

					{{ t('automations.buttons.add.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div
		v-if="isAutomationsListRoute || isLGDevice"
		class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2"
	>
		<list-automations
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			v-model:paginate-size="paginateSize"
			v-model:paginate-page="paginatePage"
			:items="automationsPaginated"
			:all-items="automations"
			:total-rows="totalRows"
			:loading="areLoading"
			:load-failed="loadFailed"
			:filters-active="filtersActive"
			:updating="updating"
			@edit="onAutomationEdit"
			@remove="onAutomationRemove"
			@toggle-enabled="onAutomationToggleEnabled"
			@adjust-list="onAdjustList"
			@reset-filters="onResetFilters"
			@retry="onRetry"
		/>
	</div>

	<router-view
		v-else
		:key="props.id"
		v-slot="{ Component }"
	>
		<component :is="Component" />
	</router-view>

	<!-- Details open in the drawer on large screens only; the list adjustment has no other place on any -->
	<el-drawer
		v-if="isLGDevice || adjustList"
		v-model="showDrawer"
		:show-close="false"
		:size="adjustList ? '300px' : '40%'"
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
				<list-automations-adjust
					v-if="adjustList"
					v-model:filters="filters"
					:filters-active="filtersActive"
					@reset-filters="onResetFilters"
				/>

				<view-error v-else>
					<template #icon>
						<icon :icon="AUTOMATION_DEFAULT_ICON" />
					</template>
					<template #message>
						{{ t('automations.messages.requestError') }}
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
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElIcon, ElMessageBox } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBar, AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewError, ViewHeader, useBreakpoints } from '../../../common';
import { AUTOMATION_DEFAULT_ICON, RouteNames } from '../automations.constants';
import { ListAutomations, ListAutomationsAdjust } from '../components/components';
import { useAutomationSpaces, useAutomationsActions, useAutomationsDataSource } from '../composables/composables';
import type { IAutomation } from '../store/automations.store.types';

import type { IViewAutomationsProps } from './view-automations.types';

defineOptions({
	name: 'ViewAutomations',
});

const props = defineProps<IViewAutomationsProps>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('automations.headings.list'),
});

const { isMDDevice, isLGDevice } = useBreakpoints();

const {
	fetchAutomations,
	automations,
	automationsPaginated,
	totalRows,
	filters,
	filtersActive,
	sortBy,
	sortDir,
	paginateSize,
	paginatePage,
	areLoading,
	loadFailed,
	resetFilter,
} = useAutomationsDataSource();

const { fetchSpaces } = useAutomationSpaces();

const { updating, remove, setEnabled } = useAutomationsActions();

const showDrawer = ref<boolean>(false);
const adjustList = ref<boolean>(false);

const remoteFormChanged = ref<boolean>(false);

const isAutomationsListRoute = computed<boolean>((): boolean => {
	return route.name === RouteNames.AUTOMATIONS;
});

const isDetailRouteOpen = (): boolean => {
	return route.matched.find((matched) => matched.name === RouteNames.AUTOMATIONS_ADD || matched.name === RouteNames.AUTOMATIONS_EDIT) !== undefined;
};

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('automations.breadcrumbs.automations'),
				route: router.resolve({ name: RouteNames.AUTOMATIONS }),
			},
		];
	}
);

const navigate = (name: string, params?: { id: IAutomation['id'] }): void => {
	if (isLGDevice.value) {
		router.replace({ name, params });
	} else {
		router.push({ name, params });
	}
};

const onCloseDrawer = (done?: () => void): void => {
	if (adjustList.value) {
		showDrawer.value = false;
		adjustList.value = false;

		done?.();

		return;
	}

	if (!remoteFormChanged.value) {
		navigate(RouteNames.AUTOMATIONS);

		done?.();

		return;
	}

	ElMessageBox.confirm(t('automations.texts.confirmDiscard'), t('automations.headings.discard'), {
		confirmButtonText: t('automations.buttons.yes.title'),
		cancelButtonText: t('automations.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			navigate(RouteNames.AUTOMATIONS);

			done?.();
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onAutomationEdit = (id: IAutomation['id']): void => {
	navigate(RouteNames.AUTOMATIONS_EDIT, { id });
};

const onAutomationRemove = (id: IAutomation['id']): void => {
	remove(id).catch((): void => {
		// The automation is gone from the list already
	});
};

const onAutomationToggleEnabled = (id: IAutomation['id'], enabled: boolean): void => {
	setEnabled(id, enabled).catch((): void => {
		// The automation is gone from the list already
	});
};

const onResetFilters = (): void => {
	resetFilter();
};

const onAutomationCreate = (): void => {
	navigate(RouteNames.AUTOMATIONS_ADD);
};

const onAdjustList = (): void => {
	showDrawer.value = true;
	adjustList.value = true;
};

const loadAutomations = (): void => {
	fetchAutomations().catch((): void => {
		// The list says so and offers to try again
	});
};

const onRetry = (): void => {
	loadAutomations();
};

onBeforeMount((): void => {
	loadAutomations();

	fetchSpaces().catch((): void => {
		// Spaces only name the column and the filter; the list works without them
	});

	showDrawer.value = isDetailRouteOpen();
});

watch(
	(): string => route.path,
	(): void => {
		showDrawer.value = isDetailRouteOpen();
	}
);
</script>
