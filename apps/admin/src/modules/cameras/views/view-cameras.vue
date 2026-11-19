<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:cctv"
				class="w-[20px] h-[20px]"
			/>
		</template>

		<template #title>
			{{ t('camerasModule.headings.cameras') }}
		</template>

		<template #subtitle>
			{{ t('camerasModule.subHeadings.cameras') }}
		</template>
	</app-bar-heading>

	<view-header
		:heading="t('camerasModule.headings.cameras')"
		:sub-heading="t('camerasModule.subHeadings.cameras')"
		icon="mdi:cctv"
	/>

	<div class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-auto mt-2">
		<cameras-grid />
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { Icon } from '@iconify/vue';

import { AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { RouteNames } from '../cameras.constants';
import { CamerasGrid } from '../components/components';

defineOptions({
	name: 'ViewCameras',
});

const { t } = useI18n();
const router = useRouter();

useMeta({
	title: t('camerasModule.menu.title'),
});

const { isMDDevice } = useBreakpoints();

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => [
		{
			label: t('camerasModule.menu.title'),
			route: router.resolve({ name: RouteNames.CAMERAS }),
		},
	]
);
</script>
