<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:database-cog-outline"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('dashboardModule.headings.pages.editDataSource') }}
		</template>

		<template #subtitle>
			{{ t('dashboardModule.subHeadings.pages.editDataSource') }}
		</template>
	</app-bar-heading>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.LEFT"
		teleport
		small
		@click="() => (remoteFormChanged ? onDiscard() : onClose())"
	>
		<template #icon>
			<el-icon :size="24">
				<icon icon="mdi:chevron-left" />
			</el-icon>
		</template>
	</app-bar-button>

	<app-bar-button
		v-if="!isMDDevice"
		:align="AppBarButtonAlign.RIGHT"
		teleport
		small
		@click="onSubmit"
	>
		<span class="uppercase">{{ t('dashboardModule.buttons.save.title') }}</span>
	</app-bar-button>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || dataSource === null"
		:element-loading-text="t('dashboardModule.texts.dataSources.loadingDataSource')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="dataSource !== null"
			class="grow-1 p-2 md:px-4"
		>
			<component
				:is="plugin?.components?.dataSourceEditForm"
				v-if="typeof plugin?.components?.dataSourceEditForm !== 'undefined'"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:data-source="dataSource"
				:schema="formSchema"
			/>

			<data-source-edit-form
				v-else
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:data-source="dataSource"
				:schema="formSchema"
			/>
		</el-scrollbar>

		<div
			v-if="isMDDevice"
			class="flex flex-row gap-2 justify-end items-center b-t b-t-solid shadow-top z-10 w-full h-[3rem]"
			style="background-color: var(--el-drawer-bg-color)"
		>
			<div class="p-2">
				<el-button
					v-if="remoteFormChanged"
					link
					class="mr-2"
					@click="onDiscard"
				>
					{{ t('dashboardModule.buttons.discard.title') }}
				</el-button>
				<el-button
					v-if="!remoteFormChanged"
					link
					class="mr-2"
					@click="onClose"
				>
					{{ t('dashboardModule.buttons.close.title') }}
				</el-button>

				<el-button
					:loading="remoteFormResult === FormResult.WORKING"
					:disabled="remoteFormResult !== FormResult.NONE"
					type="primary"
					class="order-2"
					@click="onSubmit"
				>
					<template
						v-if="remoteFormResult === FormResult.OK || remoteFormResult === FormResult.ERROR"
						#icon
					>
						<icon
							v-if="remoteFormResult === FormResult.OK"
							icon="mdi:check-circle"
						/>
						<icon
							v-else-if="remoteFormResult === FormResult.ERROR"
							icon="mdi:cross-circle"
						/>
					</template>
					{{ t('dashboardModule.buttons.save.title') }}
				</el-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElButton, ElIcon, ElMessageBox, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { AppBarButton, AppBarButtonAlign, AppBarHeading, AppBreadcrumbs, type IPlugin, useBreakpoints, useUuid } from '../../../common';
import DataSourceEditForm from '../components/data-sources/data-source-edit-form.vue';
import { useDataSource } from '../composables/useDataSource';
import { useDataSourcesPlugins } from '../composables/useDataSourcesPlugins';
import { FormResult, type FormResultType, RouteNames } from '../dashboard.constants';
import { DashboardApiException, DashboardException } from '../dashboard.exceptions';
import { type IDataSourcePluginsComponents, type IDataSourcePluginsSchemas } from '../dashboard.types';
import { DataSourceEditFormSchema } from '../schemas/dataSources.schemas';
import type { IDataSource } from '../store/data-sources.store.types';

import type { IViewPageDataSourceEditProps } from './view-page-data-source-edit.types';

defineOptions({
	name: 'ViewPageDataSourceEdit',
});

const props = defineProps<IViewPageDataSourceEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('dashboardModule.meta.pages.editDataSource.title'),
});

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { dataSource, isLoading, fetchDataSource } = useDataSource({ id: props.id, parent: 'page', parentId: props.page.id });

if (!validateUuid(props.id)) {
	throw new Error('Element identifier is not valid');
}

const { plugins } = useDataSourcesPlugins();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const plugin = computed<IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => plugin.type === dataSource.value?.type);
});

const formSchema = computed<typeof DataSourceEditFormSchema>((): typeof DataSourceEditFormSchema => {
	if (plugin.value && plugin.value.schemas?.dataSourceEditFormSchema) {
		return plugin.value.schemas?.dataSourceEditFormSchema;
	}

	return DataSourceEditFormSchema;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [];

		items.push({
			label: t('dashboardModule.breadcrumbs.pages.list'),
			route: router.resolve({ name: RouteNames.PAGES }),
		});
		items.push({
			label: t('dashboardModule.breadcrumbs.pages.detail', { page: props.page?.title }),
			route: router.resolve({ name: RouteNames.PAGE, params: { id: props.page?.id } }),
		});
		items.push({
			label: t('dashboardModule.breadcrumbs.pages.editDataSource'),
			route: router.resolve({
				name: RouteNames.PAGE_EDIT_DATA_SOURCE,
				params: { dataSourceId: props.id, id: props.page?.id },
			}),
		});

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('dashboardModule.texts.misc.confirmDiscard'), t('dashboardModule.headings.misc.discard'), {
		confirmButtonText: t('dashboardModule.buttons.yes.title'),
		cancelButtonText: t('dashboardModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isLGDevice.value) {
				router.replace({ name: RouteNames.PAGE, params: { id: props.page?.id } });
			} else {
				router.push({ name: RouteNames.PAGE, params: { id: props.page?.id } });
			}
		})
		.catch((): void => {
			// Just ignore it
		});
};

const onSubmit = (): void => {
	remoteFormSubmit.value = true;
};

const onClose = (): void => {
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.PAGE, params: { id: props.page?.id } });
	} else {
		router.push({ name: RouteNames.PAGE, params: { id: props.page?.id } });
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchDataSource()
		.then((): void => {
			if (!isLoading.value && dataSource.value === null) {
				throw new DashboardException('Data source not found');
			}
		})
		.catch((error: unknown): void => {
			const err = error as Error;

			if (err instanceof DashboardApiException && err.code === 404) {
				throw new DashboardException('Data source not found');
			} else {
				throw new DashboardException('Something went wrong', err);
			}
		});
});

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && dataSource.value === null) {
			throw new DashboardException('Data source not found');
		}
	}
);

watch(
	(): IDataSource | null => dataSource.value,
	(val: IDataSource | null): void => {
		if (!isLoading.value && val === null) {
			throw new DashboardException('Data source not found');
		}
	}
);

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);
</script>
