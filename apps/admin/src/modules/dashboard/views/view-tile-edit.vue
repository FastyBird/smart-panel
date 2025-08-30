<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon
				icon="mdi:widget-tree"
				class="w[20px] h[20px]"
			/>
		</template>

		<template #title>
			{{ t('dashboardModule.headings.tiles.edit') }}
		</template>

		<template #subtitle>
			{{ t('dashboardModule.subHeadings.tiles.edit') }}
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
		v-loading="isLoading || tile === null"
		:element-loading-text="t('dashboardModule.texts.tiles.loadingTile')"
		class="flex flex-col overflow-hidden h-full"
	>
		<el-scrollbar
			v-if="tile !== null"
			class="grow-1 p-2 md:px-4"
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

import {
	AppBarButton,
	AppBarButtonAlign,
	AppBarHeading,
	AppBreadcrumbs,
	type IPlugin,
	type IPluginElement,
	useBreakpoints,
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

useMeta({
	title: t('dashboardModule.meta.tiles.edit.title'),
});

const { validate: validateUuid } = useUuid();

const { isMDDevice, isLGDevice } = useBreakpoints();

const { tile, isLoading, fetchTile } = useTile({ id: props.id });

if (!validateUuid(props.id)) {
	throw new Error('Element identifier is not valid');
}

const { plugins } = useTilesPlugins();

const remoteFormSubmit = ref<boolean>(false);
const remoteFormResult = ref<FormResultType>(FormResult.NONE);
const remoteFormReset = ref<boolean>(false);
const remoteFormChanged = ref<boolean>(false);

const plugin = computed<IPlugin<ITilePluginsComponents, ITilePluginsSchemas> | undefined>(() => {
	return plugins.value.find((plugin) => plugin.type === tile.value?.type);
});

const element = computed<IPluginElement<ITilePluginsComponents, ITilePluginsSchemas> | undefined>(() => {
	return plugin.value?.elements.find((element) => element.type === tile.value?.type);
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
		confirmButtonText: t('dashboardModule.buttons.yes.title'),
		cancelButtonText: t('dashboardModule.buttons.no.title'),
		type: 'warning',
	})
		.then((): void => {
			if (isLGDevice.value) {
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
	if (isLGDevice.value) {
		router.replace({ name: RouteNames.TILE, params: { id: props.id } });
	} else {
		router.push({ name: RouteNames.TILE, params: { id: props.id } });
	}
};

onBeforeMount(async (): Promise<void> => {
	fetchTile()
		.then((): void => {
			if (!isLoading.value && tile.value === null) {
				throw new DashboardException('Tile not found');
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
	(): boolean => isLoading.value,
	(val: boolean): void => {
		if (!val && tile.value === null) {
			throw new DashboardException('Tile not found');
		}
	}
);

watch(
	(): ITile | null => tile.value,
	(val: ITile | null): void => {
		if (!isLoading.value && val === null) {
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
