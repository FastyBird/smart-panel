<template>
	<view-header
		:title="t('pagesCardsPlugin.headings.pages.addDataSource')"
		:subtitle="t('pagesCardsPlugin.subHeadings.pages.addDataSource')"
		icon="mdi:database-cog-outline"
		left="close"
		:primary="{ label: t('pagesCardsPlugin.buttons.add.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 tp:px-4">
			<select-data-source-plugin v-model="selectedType" />

			<el-divider />

			<template v-if="selectedType">
				<component
					:is="element?.components?.dataSourceAddForm"
					v-if="typeof element?.components?.dataSourceAddForm !== 'undefined'"
					:id="newDataSourceId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:parent="'page'"
					:parent-id="props.page.id"
					:schema="formSchema"
					only-draft
				/>

				<data-source-add-form
					v-else
					:id="newDataSourceId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="selectedType"
					:parent="'page'"
					:parent-id="props.page.id"
					:schema="formSchema"
					only-draft
				/>
			</template>

			<el-alert
				v-else
				:title="t('dashboardModule.headings.dataSources.selectPlugin')"
				:description="t('dashboardModule.texts.dataSources.selectPlugin')"
				:closable="false"
				show-icon
				type="info"
			/>
		</el-scrollbar>

		<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
		<form-footer
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:saving="remoteFormResult === FormResult.WORKING"
			:can-save="selectedType !== undefined && remoteFormResult === FormResult.NONE"
			@save="onSubmit"
			@discard="onDiscard"
			@close="onClose"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElAlert, ElDivider, ElMessageBox, ElScrollbar } from 'element-plus';

import { AppBreadcrumbs, FormFooter, type IPlugin, type IPluginElement, ViewHeader, useEditDrawer, useSizeClass, useUuid } from '../../../common';
import {
	RouteNames as DashboardRouteNames,
	DataSourceAddForm,
	DataSourceAddFormSchema,
	FormResult,
	type FormResultType,
	type IDataSourcePluginsComponents,
	type IDataSourcePluginsSchemas,
	SelectDataSourcePlugin,
	useDataSourcesPlugins,
} from '../../../modules/dashboard';
import { RouteNames } from '../pages-cards.contants';

import type { IViewDataSourceAddProps } from './view-data-source-add.types';

defineOptions({
	name: 'ViewCardsPageDataSourceAdd',
});

const props = defineProps<IViewDataSourceAddProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('pagesCardsPlugin.meta.pages.addDataSource.title'),
});

const { generate: uuidGenerate } = useUuid();

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const { plugins } = useDataSourcesPlugins();

const newDataSourceId = uuidGenerate();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const selectedType = ref<string | undefined>(undefined);

const plugin = computed<IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === selectedType.value));
});

const element = computed<IPluginElement<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined>(() => {
	return (plugin.value?.elements ?? []).find((element) => element.type === selectedType.value);
});

const formSchema = computed<typeof DataSourceAddFormSchema>((): typeof DataSourceAddFormSchema => {
	return element.value?.schemas?.dataSourceAddFormSchema ?? DataSourceAddFormSchema;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [];

		items.push({
			label: t('dashboardModule.breadcrumbs.pages.list'),
			route: router.resolve({ name: DashboardRouteNames.PAGES }),
		});
		items.push({
			label: t('dashboardModule.breadcrumbs.pages.detail', { page: props.page?.title }),
			route: router.resolve({ name: DashboardRouteNames.PAGE, params: { id: props.page?.id } }),
		});
		items.push({
			label: t('pagesCardsPlugin.breadcrumbs.pages.configure', { page: props.page?.title }),
			route: router.resolve({ name: RouteNames.PAGE, params: { id: props.page?.id } }),
		});
		items.push({
			label: t('pagesCardsPlugin.breadcrumbs.pages.addDataSource', { page: props.page?.title }),
			route: router.resolve({ name: RouteNames.PAGE_ADD_DATA_SOURCE, params: { id: props.page?.id } }),
		});

		return items;
	}
);

onMounted((): void => {
	emit('update:remote-form-changed', remoteFormChanged.value);
});

// The editor asks before a changed form is left; a confirmed discard, a save or a deleted record lets it go
const releaseForm = (): void => {
	remoteFormChanged.value = false;

	emit('update:remote-form-changed', false);
};

const onDiscard = (): void => {
	ElMessageBox.confirm(t('pagesCardsPlugin.texts.misc.confirmDiscard'), t('pagesCardsPlugin.headings.misc.discard'), {
		confirmButtonText: t('dashboardModule.buttons.discard.title'),
		cancelButtonText: t('dashboardModule.buttons.keepEditing.title'),
		type: 'warning',
	})
		.then((): void => {
			releaseForm();

			if (inDrawer.value) {
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
	if (inDrawer.value) {
		router.replace({ name: RouteNames.PAGE, params: { id: props.page?.id } });
	} else {
		router.push({ name: RouteNames.PAGE, params: { id: props.page?.id } });
	}
};

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			releaseForm();

			if (inDrawer.value) {
				router.replace({ name: RouteNames.PAGE, params: { id: props.page?.id } });
			} else {
				router.push({ name: RouteNames.PAGE, params: { id: props.page?.id } });
			}
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
