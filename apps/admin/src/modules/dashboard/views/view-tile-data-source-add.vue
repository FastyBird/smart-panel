<template>
	<view-header
		:title="t('dashboardModule.headings.tiles.addDataSource')"
		:subtitle="t('dashboardModule.subHeadings.tiles.addDataSource')"
		icon="mdi:database-cog-outline"
		left="close"
		:primary="selectedType ? { label: t('dashboardModule.buttons.save.title'), handler: onSubmit } : undefined"
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
					:parent="'tile'"
					:parent-id="props.tile.id"
					:schema="formSchema"
				/>

				<data-source-add-form
					v-else
					:id="newDataSourceId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="selectedType"
					:parent="'tile'"
					:parent-id="props.tile.id"
					:schema="formSchema"
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
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElAlert, ElDivider, ElMessageBox, ElScrollbar } from 'element-plus';

import { AppBreadcrumbs, FormFooter, type IPlugin, type IPluginElement, ViewHeader, useEditDrawer, useSizeClass, useUuid } from '../../../common';
import DataSourceAddForm from '../components/data-sources/data-source-add-form.vue';
import SelectDataSourcePlugin from '../components/data-sources/select-data-source-plugin.vue';
import { useDataSourcesPlugins } from '../composables/useDataSourcesPlugins';
import { FormResult, type FormResultType, RouteNames } from '../dashboard.constants';
import { type IDataSourcePluginsComponents, type IDataSourcePluginsSchemas } from '../dashboard.types';
import { DataSourceAddFormSchema } from '../schemas/dataSources.schemas';

import type { IViewTileDataSourceAddProps } from './view-tile-data-source-add.types';

defineOptions({
	name: 'ViewTileDataSourceAdd',
});

const props = defineProps<IViewTileDataSourceAddProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('dashboardModule.meta.tiles.addDataSource.title'),
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
	if (element.value && element.value.schemas?.dataSourceAddFormSchema) {
		return element.value.schemas?.dataSourceAddFormSchema;
	}

	return DataSourceAddFormSchema;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [];

		items.push({
			label: t('dashboardModule.breadcrumbs.tiles.detail'),
			route: router.resolve({ name: RouteNames.TILE, params: { id: props.tile?.id } }),
		});
		items.push({
			label: t('dashboardModule.breadcrumbs.tiles.addDataSource'),
			route: router.resolve({ name: RouteNames.TILE_ADD_DATA_SOURCE, params: { id: props.tile?.id } }),
		});

		return items;
	}
);

const onDiscard = (): void => {
	ElMessageBox.confirm(t('dashboardModule.texts.misc.confirmDiscard'), t('dashboardModule.headings.misc.discard'), {
		confirmButtonText: t('dashboardModule.buttons.discard.title'),
		cancelButtonText: t('dashboardModule.buttons.keepEditing.title'),
		type: 'warning',
	})
		.then((): void => {
			if (inDrawer.value) {
				router.replace({ name: RouteNames.TILE, params: { id: props.tile?.id } });
			} else {
				router.push({ name: RouteNames.TILE, params: { id: props.tile?.id } });
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
		router.replace({ name: RouteNames.TILE, params: { id: props.tile?.id } });
	} else {
		router.push({ name: RouteNames.TILE, params: { id: props.tile?.id } });
	}
};

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (inDrawer.value) {
				router.replace({ name: RouteNames.TILE, params: { id: props.tile?.id } });
			} else {
				router.push({ name: RouteNames.TILE, params: { id: props.tile?.id } });
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
