<template>
	<view-header
		:title="t('dashboardModule.headings.tiles.edit')"
		:subtitle="t('dashboardModule.subHeadings.tiles.edit')"
		icon="mdi:widget-tree"
		left="close"
		:primary="{ label: t('dashboardModule.buttons.save.title'), handler: onSubmit }"
		@back="() => (remoteFormChanged ? onDiscard() : onClose())"
	/>

	<app-breadcrumbs :items="breadcrumbs" />

	<div
		v-loading="isLoading || tile === null"
		:element-loading-text="t('dashboardModule.texts.tiles.loadingTile')"
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
			/>

			<tile-edit-form
				v-else
				v-model:remote-form-submit="remoteFormSubmit"
				v-model:remote-form-result="remoteFormResult"
				v-model:remote-form-reset="remoteFormReset"
				v-model:remote-form-changed="remoteFormChanged"
				:tile="tile"
				:schema="formSchema"
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
import TileEditForm from '../components/tiles/tile-edit-form.vue';
import { useTile } from '../composables/useTile';
import { useTilesPlugins } from '../composables/useTilesPlugins';
import { FormResult, type FormResultType, RouteNames } from '../dashboard.constants';
import { DashboardApiException, DashboardException } from '../dashboard.exceptions';
import type { ITilePluginsComponents, ITilePluginsSchemas } from '../dashboard.types';
import { TileEditFormSchema } from '../schemas/tiles.schemas';
import type { ITile } from '../store/tiles.store.types';

import type { IViewTileEditProps } from './view-tile-edit.types';

defineOptions({
	name: 'ViewPageTileEdit',
});

const props = defineProps<IViewTileEditProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
}>();

const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

useMeta({
	title: t('dashboardModule.meta.tiles.edit.title'),
});

const { validate: validateUuid } = useUuid();

// Template 4: in the drawer from tablet portrait up, its own page on phone
const { inDrawer } = useEditDrawer();
const { isPhone } = useSizeClass();

const { tile, isLoading, fetchTile } = useTile({ id: props.id });

// Track if tile was previously loaded to detect deletion
const wasTileLoaded = ref<boolean>(false);
// Track parent page ID before deletion for redirect
const parentPageId = ref<string | null>(null);

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
	if (element.value && element.value.schemas?.tileEditFormSchema) {
		return element.value.schemas?.tileEditFormSchema;
	}

	return TileEditFormSchema;
});

const breadcrumbs = computed<{ label: string; route: RouteLocationResolvedGeneric }[]>(
	(): { label: string; route: RouteLocationResolvedGeneric }[] => {
		const items = [];

		items.push({
			label: t('dashboardModule.breadcrumbs.tiles.detail'),
			route: router.resolve({ name: RouteNames.TILE, params: { id: props.id } }),
		});
		items.push({
			label: t('dashboardModule.breadcrumbs.tiles.edit'),
			route: router.resolve({ name: RouteNames.TILE_EDIT, params: { id: props.id } }),
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
				router.replace({ name: RouteNames.TILE, params: { id: props.id } });
			} else {
				router.push({ name: RouteNames.TILE, params: { id: props.id } });
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
		router.replace({ name: RouteNames.TILE, params: { id: props.id } });
	} else {
		router.push({ name: RouteNames.TILE, params: { id: props.id } });
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchTile()
		.then((): void => {
			if (!isLoading.value && tile.value === null && !wasTileLoaded.value) {
				throw new DashboardException('Tile not found');
			}
			// Mark as loaded if tile was successfully fetched
			if (tile.value !== null) {
				wasTileLoaded.value = true;
			}
		})
		.catch((error: unknown): void => {
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
	(): FormResultType => remoteFormResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			if (inDrawer.value) {
				router.replace({ name: RouteNames.TILE, params: { id: props.id } });
			} else {
				router.push({ name: RouteNames.TILE, params: { id: props.id } });
			}
		}
	}
);

watch(
	(): boolean => isLoading.value,
	(val: boolean): void => {
		// Only throw error if tile was never loaded (initial load failed)
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
			// Capture parent page ID before deletion
			if (val.parent?.type === 'page' && val.parent?.id) {
				parentPageId.value = val.parent.id;
			}
		} else if (wasTileLoaded.value && !isLoading.value) {
			// Tile was previously loaded but is now null - it was deleted
			flashMessage.warning(t('dashboardModule.messages.tiles.deletedWhileEditing'), { duration: 0 });
			// Redirect to parent page if available, otherwise to pages list
			if (parentPageId.value) {
				if (inDrawer.value) {
					router.replace({ name: RouteNames.PAGE, params: { id: parentPageId.value } });
				} else {
					router.push({ name: RouteNames.PAGE, params: { id: parentPageId.value } });
				}
			} else {
				// Fallback to pages list if parent not available
				if (inDrawer.value) {
					router.replace({ name: RouteNames.PAGES });
				} else {
					router.push({ name: RouteNames.PAGES });
				}
			}
		} else if (!isLoading.value && val === null && !wasTileLoaded.value) {
			// Tile was never loaded - initial load failed
			throw new DashboardException('Tile not found');
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
