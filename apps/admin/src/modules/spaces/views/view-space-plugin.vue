<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				:icon="spaceIcon"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('spacesModule.headings.detail', { space: space?.name }) }}
		</template>

		<template #subtitle>
			{{ t('spacesModule.subHeadings.detail', { space: space?.name }) }}
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

	<view-header
		:heading="t('spacesModule.headings.detail', { space: space?.name })"
		:sub-heading="t('spacesModule.subHeadings.detail', { space: space?.name })"
		:icon="spaceIcon"
	>
		<template #extra>
			<div
				id="space-manage-actions"
				class="flex items-center"
			/>
		</template>
	</view-header>

	<div class="flex-1 overflow-hidden lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2">
		<router-view
			:key="props.id"
			v-slot="{ Component }"
		>
			<component
				:is="Component"
				v-if="space"
				:space="space"
			/>
		</router-view>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { useSpace } from '../composables';
import { RouteNames, SpaceRoomCategory, SpaceZoneCategory, getSpaceIcon } from '../spaces.constants';
import { SpacesException } from '../spaces.exceptions';
import type { ISpace } from '../store';

import type { IViewSpacePluginProps } from './view-space-plugin.types';

defineOptions({
	name: 'ViewSpacePlugin',
});

const props = defineProps<IViewSpacePluginProps>();

const router = useRouter();
const { t } = useI18n();
const { meta } = useMeta({});

const { isMDDevice, isLGDevice } = useBreakpoints();

const spaceId = computed(() => props.id);

const { space, fetching, fetchSpace } = useSpace(spaceId);

const isLoading = computed<boolean>(() => fetching.value);

const spaceIcon = computed<string>((): string =>
	space.value
		? getSpaceIcon({
				icon: space.value.icon ?? null,
				category: (space.value.category ?? null) as SpaceRoomCategory | SpaceZoneCategory | null,
				type: space.value.type,
			})
		: 'mdi:shape-outline'
);

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		return [
			{
				label: t('spacesModule.breadcrumbs.spaces.list'),
				route: router.resolve({ name: RouteNames.SPACES }),
			},
			{
				label: t('spacesModule.breadcrumbs.spaces.detail', { space: space.value?.name }),
				route: router.resolve({ name: RouteNames.SPACE, params: { id: props.id } }),
			},
		];
	}
);

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({
			name: RouteNames.SPACES,
		});
	} else {
		router.push({
			name: RouteNames.SPACES,
		});
	}
};

onBeforeMount((): void => {
	fetchSpace().catch((error: unknown): void => {
		const err = error as Error;

		throw new SpacesException('Something went wrong', err);
	});
});

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && space.value === null) {
			throw new SpacesException('Space not found');
		}
	}
);

watch(
	(): ISpace | null => space.value,
	(val: ISpace | null): void => {
		if (val !== null) {
			meta.title = t('spacesModule.meta.spaces.detail.title', { space: space.value?.name });
		}

		if (!isLoading.value && val === null) {
			throw new SpacesException('Space not found');
		}
	}
);
</script>
