<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<view-header
		:title="t('systemModule.headings.systemBackups.list')"
		:subtitle="t('systemModule.subHeadings.systemBackups.list')"
		icon="mdi:backup-restore"
		:actions="[
			{ icon: 'mdi:upload', label: t('systemModule.backups.buttons.upload'), handler: () => backupsList?.openUploadPicker() },
			{ icon: 'mdi:plus', label: t('systemModule.backups.buttons.create'), handler: () => backupsList?.openCreateDialog() },
		]"
	>
		<template #actions>
			<el-button
				plain
				data-test-id="system-backups-header-upload"
				@click="backupsList?.openUploadPicker()"
			>
				<template #icon>
					<icon icon="mdi:upload" />
				</template>
				{{ t('systemModule.backups.buttons.upload') }}
			</el-button>

			<el-button
				type="primary"
				data-test-id="system-backups-header-create"
				@click="backupsList?.openCreateDialog()"
			>
				<template #icon>
					<icon icon="mdi:plus" />
				</template>
				{{ t('systemModule.backups.buttons.create') }}
			</el-button>
		</template>
	</view-header>

	<system-backups ref="backupsList" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBreadcrumbs, ViewHeader } from '../../../common';
import { SystemBackups } from '../components/components';
import { RouteNames } from '../system.constants';

defineOptions({
	name: 'ViewSystemBackups',
});

const router = useRouter();
const { t } = useI18n();

const backupsList = ref<InstanceType<typeof SystemBackups> | null>(null);

const breadcrumbs = computed<{ label: string; route: RouteLocationRaw }[]>((): { label: string; route: RouteLocationRaw }[] => {
	return [
		{
			label: t('systemModule.breadcrumbs.system.system'),
			route: router.resolve({ name: RouteNames.SYSTEM }),
		},
		{
			label: t('systemModule.breadcrumbs.systemBackups.list'),
			route: router.resolve({ name: RouteNames.SYSTEM_BACKUPS }),
		},
	];
});

useMeta({
	title: t('systemModule.meta.systemBackups.list.title'),
});
</script>
