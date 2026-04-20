<template>
	<app-breadcrumbs :items="breadcrumbs" />

	<app-bar-heading
		v-if="!isMDDevice"
		teleport
	>
		<template #icon>
			<icon
				icon="mdi:backup-restore"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('systemModule.headings.systemBackups.list') }}
		</template>

		<template #subtitle>
			{{ t('systemModule.subHeadings.systemBackups.list') }}
		</template>
	</app-bar-heading>

	<view-header
		:heading="t('systemModule.headings.systemBackups.list')"
		:sub-heading="t('systemModule.subHeadings.systemBackups.list')"
		icon="mdi:backup-restore"
	>
		<template #extra>
			<div class="flex items-center gap-2">
				<el-upload
					:auto-upload="true"
					:show-file-list="false"
					accept=".tar.gz,.gz"
					:http-request="handleUpload"
				>
					<el-button plain>
						<template #icon>
							<icon icon="mdi:upload" />
						</template>
						{{ t('systemModule.backups.buttons.upload') }}
					</el-button>
				</el-upload>

				<el-button
					type="primary"
					plain
					@click="backupsList?.openCreateDialog()"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>
					{{ t('systemModule.backups.buttons.create') }}
				</el-button>
			</div>
		</template>
	</view-header>

	<div class="grow-1 flex flex-col gap-2 lt-sm:mx-1 sm:mx-2 lt-sm:mb-1 sm:mb-2 overflow-hidden mt-2">
		<system-backups ref="backupsList" />
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElButton, ElUpload } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { SystemBackups } from '../components/components';
import { RouteNames } from '../system.constants';

defineOptions({
	name: 'ViewSystemBackups',
});

const router = useRouter();
const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const backupsList = ref<InstanceType<typeof SystemBackups> | null>(null);

const handleUpload = (opts: { file: File }): Promise<void> => {
	return backupsList.value?.onUploadBackup(opts) ?? Promise.resolve();
};

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
