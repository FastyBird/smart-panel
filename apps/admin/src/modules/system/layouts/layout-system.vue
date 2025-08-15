<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:hammer"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('systemModule.headings.system.system') }}
		</template>

		<template #subtitle>
			{{ t('systemModule.subHeadings.system') }}
		</template>
	</app-bar-heading>

	<view-header
		:heading="t('systemModule.headings.system.system')"
		:sub-heading="t('systemModule.subHeadings.system')"
		icon="mdi:hammer"
	>
		<template #extra>
			<div class="flex items-center">
				<el-button
					plain
					class="px-4! ml-2!"
					@click="onAboutInfo"
				>
					<template #icon>
						<icon icon="mdi:about" />
					</template>

					{{ t('systemModule.buttons.about.title') }}
				</el-button>
				<el-button
					type="danger"
					plain
					class="px-4! ml-2!"
					@click="onManageSystem"
				>
					<template #icon>
						<icon icon="mdi:volume-control" />
					</template>

					{{ t('systemModule.buttons.manage.title') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div class="lt-md:px-1 lt-md:py-1">
		<router-view />
	</div>

	<el-dialog
		v-model="showAboutInfo"
		:title="t('systemModule.headings.system.about')"
	>
		<about-application />

		<template #footer>
			<el-button
				link
				@click="showAboutInfo = false"
			>
				{{ t('usersModule.buttons.close.title') }}
			</el-button>
		</template>
	</el-dialog>

	<el-dialog
		v-model="showManageSystem"
		:title="t('systemModule.headings.manage.manageSystem')"
	>
		<manage-system />

		<template #footer>
			<el-button
				link
				@click="showManageSystem = false"
			>
				{{ t('usersModule.buttons.close.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElButton, ElDialog } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { AboutApplication, ManageSystem } from '../components/components';
import { RouteNames } from '../system.constants';

defineOptions({
	name: 'LayoutSystem',
});

const router = useRouter();
const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const showAboutInfo = ref<boolean>(false);

const showManageSystem = ref<boolean>(false);

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => {
	return [
		{
			label: t('systemModule.breadcrumbs.system.system'),
			route: router.resolve({ name: RouteNames.SYSTEM }),
		},
		{
			label: t('systemModule.breadcrumbs.system.systemInfo'),
			route: router.resolve({ name: RouteNames.SYSTEM_INFO }),
		},
	];
});

const onAboutInfo = (): void => {
	showAboutInfo.value = true;
};

const onManageSystem = (): void => {
	showManageSystem.value = true;
};
</script>
