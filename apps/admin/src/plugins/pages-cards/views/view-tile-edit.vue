<template>
	<view-header
		:title="t('pagesCardsPlugin.headings.pages.editTile')"
		:subtitle="t('pagesCardsPlugin.subHeadings.pages.editTile')"
		icon="mdi:widget-tree"
		left="close"
		:primary="{ label: t('pagesCardsPlugin.buttons.update.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || tile === null"
		:element-loading-text="t('pagesCardsPlugin.texts.tiles.loadingTile')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="tile !== null"
			class="grow-1 p-2 tp:px-4"
		>
			<component
				:is="element?.components?.tileEditForm"
				v-if="typeof element?.components?.tileEditForm !== 'undefined'"
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:tile="tile"
				:schema="formSchema"
				only-draft
				:with-position="false"
				:with-size="false"
			/>

			<tile-edit-form
				v-else
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:tile="tile"
				:schema="formSchema"
				only-draft
				:with-position="false"
				:with-size="false"
			/>
		</el-scrollbar>

		<!-- Wherever the phone app bar is not there to carry Save: in the drawer, and on a page kept open past 720 px -->
		<form-footer
			v-if="tile !== null"
			v-show="inDrawer || !isPhone"
			:dirty="remoteFormChanged"
			:saving="remoteFormResult === FormResult.WORKING"
			:can-save="remoteFormChanged && remoteFormResult === FormResult.NONE"
			@save="onSubmit"
			@discard="onDiscard"
			@close="onClose"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMeta } from 'vue-meta';
import { type RouteLocationResolvedGeneric, useRouter } from 'vue-router';

import { ElMessageBox, ElScrollbar, vLoading } from 'element-plus';

import {
	AppBreadcrumbs,
	FormFooter,
	type IPlugin,
	type IPluginElement,
	ViewHeader,
	useEditDrawer,
	useFlashMessage,
	useSizeClass,
	useUuid,
} from '../../../common';
import {
	DashboardApiException,
	DashboardException,
	RouteNames as DashboardRouteNames,
	FormResult,
	type FormResultType,
	type ITile,
	type ITilePluginsComponents,
	type ITilePluginsSchemas,
	TileEditForm,
	TileEditFormSchema,
	useTile,
	useTilesPlugins,
} from '../../../modules/dashboard';
import { RouteNames } from '../pages-cards.contants';

import type { IViewTileEditProps } from './view-tile-edit.types';

defineOptions({
	name: 'ViewCardTileEdit',
});

const props = defineProps<IViewTileEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

useMeta({
	title: t('pagesCardsPlugin.meta.pages.editTile.title'),
});

const { validate: validateUuid } = useUuid();

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const { tile, isLoading, fetchTile } = useTile({ id: props.id, parent: 'card', parentId: props.cardId });

const wasTileLoaded = ref<boolean>(false);

if (!validateUuid(props.id)) {
	throw new Error('Element identifier is not valid');
}

const { plugins } = useTilesPlugins();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const plugin = computed<IPlugin<ITilePluginsComponents, ITilePluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => (plugin.elements ?? []).some((element) => element.type === tile.value?.type));
});

const element = computed<IPluginElement<ITilePluginsComponents, ITilePluginsSchemas> | undefined>(() => {
	return (plugin.value?.elements ?? []).find((element) => element.type === tile.value?.type);
});

const formSchema = computed<typeof TileEditFormSchema>((): typeof TileEditFormSchema => {
	return element.value?.schemas?.tileEditFormSchema ?? TileEditFormSchema;
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
			label: t('pagesCardsPlugin.breadcrumbs.pages.editTile', { page: props.page?.title }),
			route: router.resolve({
				name: RouteNames.PAGE_CARD_EDIT_TILE,
				params: { id: props.page?.id, cardId: props.cardId, tileId: tile.value?.id },
			}),
		});

		return items;
	}
);

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

onBeforeMount(async (): Promise<void> => {
	fetchTile()
		.then((): void => {
			if (tile.value !== null) {
				wasTileLoaded.value = true;
			}
			if (!isLoading.value && tile.value === null && !wasTileLoaded.value) {
				throw new DashboardException('Tile not found');
			}
		})
		.catch((error: unknown): void => {
			if (error instanceof DashboardException) {
				throw error;
			}

			const err = error as Error;

			if (err instanceof DashboardApiException && err.code === 404) {
				throw new DashboardException('Tile not found');
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
		if (!val && tile.value === null && !wasTileLoaded.value) {
			throw new DashboardException('Tile not found');
		}
	}
);

watch(
	(): ITile | null => tile.value,
	(val: ITile | null): void => {
		if (val !== null) {
			wasTileLoaded.value = true;
		} else if (wasTileLoaded.value && !isLoading.value) {
			releaseForm();

			flashMessage.warning(t('pagesCardsPlugin.messages.tiles.deletedWhileEditing'), { duration: 0 });
			if (props.page?.id) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.PAGE, params: { id: props.page.id } });
				} else {
					router.push({ name: RouteNames.PAGE, params: { id: props.page.id } });
				}
			} else {
				if (inDrawer.value) {
					router.replace({ name: DashboardRouteNames.PAGES });
				} else {
					router.push({ name: DashboardRouteNames.PAGES });
				}
			}
		} else if (!isLoading.value && val === null && !wasTileLoaded.value) {
			throw new DashboardException('Tile not found');
		}
	}
);

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
