<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:database-cog-outline"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('dashboardModule.headings.tiles.addDataSource') }}
		</template>

		<template #subtitle>
			{{ t('dashboardModule.subHeadings.tiles.addDataSource') }}
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

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 md:px-4">
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

				<div
					:id="SUBMIT_FORM_SM"
					class="order-2 inline-block [&>*:first-child:not(:only-child)]:hidden"
				>
					<el-button
						:loading="remoteFormResult === FormResult.WORKING"
						:disabled="remoteFormResult !== FormResult.NONE"
						type="primary"
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
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElAlert, ElButton, ElDivider, ElIcon, ElMessageBox, ElScrollbar } from 'element-plus';

import { Icon } from '@iconify/vue';

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	type IPlugin,
	type IPluginElement,
	SUBMIT_FORM_SM,
	useBreakpoints,
	useUuid,
} from '../../../common';
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

const { isMDDevice, isLGDevice } = useBreakpoints();

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
		confirmButtonText: t('dashboardModule.buttons.yes.title'),
		cancelButtonText: t('dashboardModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isLGDevice.value) {
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
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.TILE, params: { id: props.tile?.id } });
	} else {
		router.push({ name: RouteNames.TILE, params: { id: props.tile?.id } });
	}
};

watch(
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (isLGDevice.value) {
				router.replace({
					name: RouteNames.TILE_EDIT_DATA_SOURCE,
					params: { id: props.tile?.id, dataSourceId: newDataSourceId },
				});
			} else {
				router.push({
					name: RouteNames.TILE_EDIT_DATA_SOURCE,
					params: { id: props.tile?.id, dataSourceId: newDataSourceId },
				});
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
