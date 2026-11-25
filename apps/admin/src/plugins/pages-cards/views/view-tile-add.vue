<template>
	<view-header
		:title="t('pagesCardsPlugin.headings.pages.addTile')"
		:subtitle="t('pagesCardsPlugin.subHeadings.pages.addTile')"
		icon="mdi:widget-tree"
		left="close"
		:primary="{ label: t('pagesCardsPlugin.buttons.add.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div class="flex flex-col overflow-hidden h-full">
		<el-scrollbar class="grow-1 p-2 tp:px-4">
			<select-tile-plugin v-model="selectedType" />

			<el-divider />

			<template v-if="selectedType">
				<component
					:is="element?.components?.tileAddForm"
					v-if="typeof element?.components?.tileAddForm !== 'undefined'"
					:id="newTileId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="selectedType"
					:parent="'card'"
					:parent-id="props.cardId"
					:schema="formSchema"
					only-draft
					:with-position="false"
					:with-size="false"
				/>

				<tile-add-form
					v-else
					:id="newTileId"
					v-model:remote-form-submit="remoteFormSubmit"
					v-model:remote-form-result="remoteFormResult"
					v-model:remote-form-reset="remoteFormReset"
					v-model:remote-form-changed="remoteFormChanged"
					:type="selectedType"
					:parent="'card'"
					:parent-id="props.cardId"
					:schema="formSchema"
					only-draft
					:with-position="false"
					:with-size="false"
				/>
			</template>

			<el-alert
				v-else
				:title="t('dashboardModule.headings.tiles.selectPlugin')"
				:description="t('dashboardModule.texts.tiles.selectPlugin')"
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
import { type RouteLocationResolvedGeneric, useRoute, useRouter } from 'vue-router';

import { ElAlert, ElDivider, ElMessageBox, ElScrollbar } from 'element-plus';

import { AppBreadcrumbs, FormFooter, type IPlugin, type IPluginElement, ViewHeader, useEditDrawer, useSizeClass, useUuid } from '../../../common';
import {
	RouteNames as DashboardRouteNames,
	FormResult,
	type FormResultType,
	type ITilePluginsComponents,
	type ITilePluginsSchemas,
	SelectTilePlugin,
	TileAddForm,
	TileAddFormSchema,
	useTilesPlugins,
} from '../../../modules/dashboard';
import { RouteNames } from '../pages-cards.contants';

import type { IViewTileAddProps } from './view-tile-add.types';

defineOptions({
	name: 'ViewCardTileAdd',
});

const props = defineProps<IViewTileAddProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

useMeta({
	title: t('pagesCardsPlugin.meta.pages.addTile.title'),
});

const { generate: uuidGenerate } = useUuid();

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const { plugins } = useTilesPlugins();

const newTileId = uuidGenerate();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const selectedType = ref<string | undefined>((route.query.tileType as string) || undefined);

watch(
	(): string | undefined => (route.query.tileType as string) || undefined,
	(val: string | undefined): void => {
		selectedType.value = val;
	}
);

const plugin = computed<IPlugin<ITilePluginsComponents, ITilePluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === selectedType.value));
});

const element = computed<IPluginElement<ITilePluginsComponents, ITilePluginsSchemas> | undefined>(() => {
	return (plugin.value?.elements ?? []).find((element) => element.type === selectedType.value);
});

const formSchema = computed<typeof TileAddFormSchema>((): typeof TileAddFormSchema => {
	return element.value?.schemas?.tileAddFormSchema ?? TileAddFormSchema;
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
			label: t('pagesCardsPlugin.breadcrumbs.pages.addTile', { page: props.page?.title }),
			route: router.resolve({
				name: RouteNames.PAGE_CARD_ADD_TILE,
				params: { id: props.page?.id, cardId: props.cardId },
			}),
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
