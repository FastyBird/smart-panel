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

	<div
		v-loading="isLoadingSystemInfo || isLoadingThrottleStatus || systemInfo === null"
		:element-loading-text="t('systemModule.texts.system.loadingSystemInfo')"
	>
		<system-info-detail
			:system-info="systemInfo"
			:throttle-status="throttleStatus"
		/>
	</div>

	<responsive-card-section
		:is-m-d-device="isMDDevice"
		class="mt-4"
	>
		<template #header>
			<div class="flex items-center justify-between">
				<span class="font-semibold">
					{{ t('systemModule.backups.title') }}
				</span>

				<div class="flex items-center gap-2">
					<el-upload
						:auto-upload="true"
						:show-file-list="false"
						accept=".tar.gz,.gz"
						:http-request="handleUpload"
					>
						<el-button size="small">
							<template #icon>
								<icon icon="mdi:upload" />
							</template>
							{{ t('systemModule.backups.buttons.upload') }}
						</el-button>
					</el-upload>

					<el-button
						type="primary"
						size="small"
						@click="backupsList?.openCreateDialog()"
					>
						<template #icon>
							<icon icon="mdi:plus" />
						</template>
						{{ t('systemModule.backups.buttons.create') }}
					</el-button>
				</div>
			</div>
		</template>

		<system-backups ref="backupsList" />
	</responsive-card-section>

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
		<manage-system @close="showManageSystem = false" />

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
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationRaw, useRouter } from 'vue-router';

import { ElButton, ElDialog, ElUpload, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarHeading, AppBreadcrumbs, ViewHeader, useBreakpoints } from '../../../common';
import { AboutApplication, ManageSystem, ResponsiveCardSection, SystemBackups, SystemInfoDetail } from '../components/components';
import { useSystemInfo, useThrottleStatus } from '../composables/composables';
import { RouteNames } from '../system.constants';
import { SystemException } from '../system.exceptions';

defineOptions({
	name: 'ViewSystemInfo',
});

const router = useRouter();
const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const { systemInfo, fetchSystemInfo, isLoading: isLoadingSystemInfo } = useSystemInfo();
const { throttleStatus, fetchThrottleStatus, isLoading: isLoadingThrottleStatus } = useThrottleStatus();

const showAboutInfo = ref<boolean>(false);

const showManageSystem = ref<boolean>(false);

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

onBeforeMount(async (): Promise<void> => {
	fetchSystemInfo().catch((error: unknown): void => {
		const err = error as Error;

		throw new SystemException('Something went wrong', err);
	});

	fetchThrottleStatus().catch((error: unknown): void => {
		const err = error as Error;

		throw new SystemException('Something went wrong', err);
	});
});

watch(
	(): boolean => isLoadingSystemInfo.value,
	(val: boolean): void => {
		if (!val && systemInfo.value === null) {
			throw new SystemException('Something went wrong');
		}
	}
);

useMeta({
	title: t('systemModule.meta.system.systemInfo.title'),
});
</script>
