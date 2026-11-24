<template>
	<!-- Phone: a tile or data source form is its own page -->
	<router-view
		v-if="isFormRoute && !inDrawer"
		:key="formKey"
		v-slot="{ Component }"
	>
		<component
			:is="Component"
			v-model:remote-form-changed="remoteFormChanged"
			:page="props.page"
		/>
	</router-view>

	<!-- Template 4: the tile and data source forms open next to the editor from tablet portrait up -->
	<edit-drawer-layout
		v-else
		:open="showDrawer"
		:before-close="onCloseDrawer"
		class="h-full"
		@close="onCloseDrawer()"
	>
		<!-- Template 8 on phone: the page is read as a list -->
		<el-scrollbar
			v-if="phoneList"
			class="flex-1 min-h-0"
		>
			<tiles-page-list
				:tiles="tiles"
				:grid-layout="gridLayout"
				@detail="onTileDetail"
			/>
		</el-scrollbar>

		<!-- Template 8: toolbar · palette · canvas with the bottom panel · inspector -->
		<div
			v-else
			class="tiles-editor flex flex-col flex-1 min-h-0 overflow-hidden"
			data-test-id="tiles-editor"
		>
			<div class="tiles-editor__bar flex flex-row flex-wrap items-center gap-2 px-3 py-2">
				<template v-if="compactEditor">
					<el-button
						type="primary"
						plain
						class="ml-0!"
						data-test-id="tiles-editor-add-tile"
						@click="paletteSheet = true"
					>
						<template #icon>
							<icon icon="mdi:plus" />
						</template>
						{{ t('pagesTilesPlugin.editor.buttons.addTile') }}
					</el-button>

					<el-button
						:type="pagePanelOpen ? 'primary' : 'default'"
						:plain="pagePanelOpen"
						:aria-pressed="pagePanelOpen"
						class="ml-0!"
						data-test-id="tiles-editor-data-sources"
						@click="onTogglePagePanel"
					>
						<template #icon>
							<icon icon="mdi:database-outline" />
						</template>
						{{ t('pagesTilesPlugin.editor.buttons.dataSources') }}
					</el-button>
				</template>

				<el-tag
					v-if="remotePageChanged"
					type="warning"
					disable-transitions
					data-test-id="tiles-editor-unsaved"
				>
					{{ t('pagesTilesPlugin.editor.texts.unsaved') }}
				</el-tag>

				<div class="grow-1" />

				<div
					v-if="selectedDisplay"
					class="flex items-center gap-2 min-w-0"
				>
					<span class="text-label">{{ t('pagesTilesPlugin.editor.display.title') }}</span>

					<el-select
						v-if="applicableDisplays.length > 1"
						:model-value="selectedDisplay.id"
						:aria-label="t('pagesTilesPlugin.editor.display.title')"
						class="w-[200px]"
						data-test-id="tiles-editor-display"
						@change="(value: string) => onDisplaySelect(value)"
					>
						<el-option
							v-for="display in applicableDisplays"
							:key="display.id"
							:value="display.id"
							:label="display.name || display.macAddress"
						/>
					</el-select>

					<span
						v-else
						class="text-body truncate"
					>
						{{ selectedDisplay.name || selectedDisplay.macAddress }}
					</span>

					<span
						v-if="gridLayout"
						class="text-help whitespace-nowrap"
					>
						{{ displayDetails }}
					</span>
				</div>

				<el-button
					v-if="remotePageChanged"
					class="ml-0!"
					:disabled="saving"
					data-test-id="tiles-editor-discard"
					@click="onDiscard"
				>
					{{ t('pagesTilesPlugin.buttons.discard.title') }}
				</el-button>

				<el-button
					v-else
					class="ml-0!"
					data-test-id="tiles-editor-close"
					@click="onClose"
				>
					{{ t('pagesTilesPlugin.buttons.close.title') }}
				</el-button>

				<el-button
					type="primary"
					class="ml-0!"
					:loading="saving"
					:disabled="!remotePageChanged || saving"
					data-test-id="tiles-editor-save"
					@click="onSave"
				>
					{{ t('pagesTilesPlugin.buttons.save.title') }}
				</el-button>
			</div>

			<div class="relative flex flex-row flex-1 min-h-0">
				<!-- Template 8: the palette is 240 px, 208 px on tablet landscape; on tablet portrait it is a sheet -->
				<el-scrollbar
					v-if="!compactEditor"
					:style="{ flexBasis: isTabletLandscape ? '208px' : '240px' }"
					class="tiles-editor__palette shrink-0"
				>
					<tiles-palette @add="onTileAdd" />
				</el-scrollbar>

				<page-configure
					v-if="gridLayout"
					ref="configure"
					v-model:remote-page-submit="remotePageSubmit"
					v-model:remote-page-result="remotePageResult"
					v-model:remote-page-changed="remotePageChanged"
					:page="props.page"
					:grid-layout="gridLayout"
					:dark="selectedDisplay?.darkMode ?? false"
					:selected-tile-id="selectedPlace?.id ?? null"
					@select="onSelect"
					@edit="onTileEdit"
				/>

				<state-view
					v-else
					:kind="loadingDisplays ? 'loading' : 'empty'"
					icon="mdi:monitor-off"
					:title="loadingDisplays ? t('pagesTilesPlugin.editor.texts.loadingDisplays') : t('pagesTilesPlugin.editor.texts.noDisplay')"
					:description="loadingDisplays ? undefined : t('pagesTilesPlugin.editor.texts.noDisplayHint')"
					class="flex-1"
				/>

				<!-- Template 8: the inspector, 340 px beside the canvas (360 px on wide); on tablet portrait it lies over the
				     canvas, for the selected tile or when Data sources is pressed -->
				<el-scrollbar
					v-if="!compactEditor || selectedPlace !== null || pagePanelOpen"
					:style="{ width: `${sizeClass === 'wd' ? INSPECTOR_WIDTH_WIDE : INSPECTOR_WIDTH}px` }"
					:class="['tiles-editor__inspector shrink-0', { 'tiles-editor__inspector--overlay': compactEditor }]"
				>
					<tiles-inspector
						:place="selectedPlace"
						:tile="selectedTile"
						:data-sources="pageDataSources"
						:data-sources-loading="dataSourcesLoading"
						:disabled="saving"
						@close="onInspectorClose"
						@edit="onTileEdit"
						@detail="onTileDetail"
						@hide="onTileHide"
						@show="onTileShow"
						@remove="onTileRemove"
						@add-data-source="onPageDataSourceAdd"
						@edit-data-source="onPageDataSourceEdit"
						@remove-data-source="onPageDataSourceRemove"
					/>
				</el-scrollbar>
			</div>

			<!-- Tablet portrait: Add tile opens the palette as a sheet; picking a type closes it -->
			<el-drawer
				v-model="paletteSheet"
				:title="t('pagesTilesPlugin.editor.buttons.addTile')"
				direction="btt"
				size="60%"
				append-to-body
			>
				<tiles-palette @add="onTileAdd" />
			</el-drawer>
		</div>

		<template #form>
			<!-- Keyed like the form: an error caught in one form does not stay over the next one -->
			<view-error :key="formKey">
				<template #icon>
					<icon icon="mdi:widget-tree" />
				</template>
				<template #message>
					{{ t('pagesTilesPlugin.messages.misc.requestError') }}
				</template>

				<suspense>
					<router-view
						:key="formKey"
						v-slot="{ Component }"
					>
						<component
							:is="Component"
							v-model:remote-form-changed="remoteFormChanged"
							:page="props.page"
						/>
					</router-view>
				</suspense>
			</view-error>
		</template>
	</edit-drawer-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationNormalized, onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';

import { ElButton, ElDrawer, ElMessageBox, ElOption, ElScrollbar, ElSelect, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { EditDrawerLayout, StateView, ViewError, provideEditDrawer, useFlashMessage, useSizeClass } from '../../../common';
import {
	RouteNames as DashboardRouteNames,
	FormResult,
	type FormResultType,
	type IDataSource,
	type ITile,
	useDataSourcesActions,
	useDataSourcesDataSource,
	useTiles,
} from '../../../modules/dashboard';
import { type IDisplay, useDisplays } from '../../../modules/displays';
import type { IPageConfigureExpose, IPageConfigureTilePlace } from '../components/page-configure.types';
import PageConfigure from '../components/page-configure.vue';
import TilesInspector from '../components/tiles-inspector.vue';
import TilesPageList from '../components/tiles-page-list.vue';
import TilesPalette from '../components/tiles-palette.vue';
import { RouteNames } from '../pages-tiles.constants';

import type { IViewPageConfigureProps } from './view-page-configure.types';

defineOptions({
	name: 'ViewPageConfigure',
});

const props = defineProps<IViewPageConfigureProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
	(e: 'update:remote-page-changed', pageChanged: boolean): void;
}>();

const INSPECTOR_WIDTH = 340;
const INSPECTOR_WIDTH_WIDE = 360;

const FORM_ROUTES: string[] = [
	RouteNames.PAGE_ADD_TILE,
	RouteNames.PAGE_EDIT_TILE,
	RouteNames.PAGE_ADD_DATA_SOURCE,
	RouteNames.PAGE_EDIT_DATA_SOURCE,
];

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

const { sizeClass, isPhone, isTabletPortrait, isTabletLandscape } = useSizeClass();

const { displays, fetchDisplays, isLoading: loadingDisplays } = useDisplays();

const { tiles, fetchTiles, areLoading: loadingTiles } = useTiles({ parent: 'page', parentId: props.page.id });

const { dataSources, areLoading: dataSourcesLoading, fetchDataSources } = useDataSourcesDataSource({ parent: 'page', parentId: props.page.id });
const dataSourcesActions = useDataSourcesActions({ parent: 'page', parentId: props.page.id });

const configure = ref<IPageConfigureExpose | null>(null);

const remoteFormChanged = ref<boolean>(false);
const remotePageSubmit = ref<boolean>(false);
const remotePageResult = ref<FormResultType>(FormResult.NONE);
const remotePageChanged = ref<boolean>(false);

const selectedDisplayId = ref<string | null>(null);
const selectedPlace = ref<IPageConfigureTilePlace | null>(null);

const paletteSheet = ref<boolean>(false);
// Tablet portrait: the inspector shows the page's data sources only when asked
const pagePanelOpen = ref<boolean>(false);

// Leaving the editor asks first while the layout has changes; Discard and a save let it go
let allowLeave = false;

const isFormRoute = computed<boolean>((): boolean => route.matched.some((matched) => FORM_ROUTES.includes(String(matched.name))));

const showDrawer = computed<boolean>((): boolean => isFormRoute.value);

// Template 4: the forms open next to the editor from tablet portrait up, as their own page on phone
const { inDrawer } = provideEditDrawer((): boolean => isFormRoute.value);

// One form per tile and data source (and one for each Add): a new key remounts the routed form
const formKeyOf = (location: RouteLocationNormalized): string => {
	const tileId = typeof location.params?.tileId === 'string' ? location.params.tileId : '';
	const dataSourceId = typeof location.params?.dataSourceId === 'string' ? location.params.dataSourceId : '';
	const tileType = typeof location.query?.tileType === 'string' ? location.query.tileType : '';

	return `${String(location.name)}:${tileId}:${dataSourceId}:${tileType}`;
};

const formKey = computed<string>((): string => formKeyOf(route));

// Phone reads the page as a list. A window that narrows past 720 px with unsaved layout changes keeps the editor, as
// the grids hold the only copy of those changes
const phoneList = computed<boolean>((): boolean => isPhone.value && !remotePageChanged.value);

// Tablet portrait, and a phone-width window still holding unsaved changes: palette and inspector over the canvas
const compactEditor = computed<boolean>((): boolean => isTabletPortrait.value || isPhone.value);

const saving = computed<boolean>((): boolean => remotePageResult.value === FormResult.WORKING);

const pageDataSources = computed<IDataSource[]>((): IDataSource[] => dataSources.value.filter((dataSource) => !dataSource.draft));

const selectedTile = computed<ITile | null>((): ITile | null => {
	return selectedPlace.value ? (tiles.value.find((tile) => tile.id === selectedPlace.value?.id) ?? null) : null;
});

const applicableDisplays = computed<IDisplay[]>((): IDisplay[] => {
	if (props.page.displays !== null && props.page.displays.length > 0) {
		return displays.value.filter((display) => props.page.displays!.includes(display.id));
	}

	return displays.value;
});

const selectedDisplay = computed<IDisplay | null>((): IDisplay | null => {
	return applicableDisplays.value.find((display) => display.id === selectedDisplayId.value) ?? applicableDisplays.value[0] ?? null;
});

const gridLayout = computed<{ rows: number; cols: number } | null>((): { rows: number; cols: number } | null => {
	if (selectedDisplay.value === null) {
		return null;
	}

	const rows = props.page.rows ?? selectedDisplay.value.rows ?? 12;
	const cols = props.page.cols ?? selectedDisplay.value.cols ?? 24;

	return { rows, cols };
});

const displayDetails = computed<string>((): string => {
	const display = selectedDisplay.value;
	const grid = t('pagesTilesPlugin.editor.display.grid', { cols: gridLayout.value?.cols ?? 0, rows: gridLayout.value?.rows ?? 0 });

	if (display?.screenWidth && display.screenHeight) {
		return `${display.screenWidth} × ${display.screenHeight} · ${grid}`;
	}

	return grid;
});

const confirmDiscard = async (): Promise<boolean> => {
	try {
		await ElMessageBox.confirm(t('pagesTilesPlugin.texts.misc.confirmDiscard'), t('pagesTilesPlugin.headings.misc.discard'), {
			confirmButtonText: t('dashboardModule.buttons.discard.title'),
			cancelButtonText: t('dashboardModule.buttons.keepEditing.title'),
			type: 'warning',
		});

		return true;
	} catch {
		return false;
	}
};

const navigate = (to: { name: string; params: Record<string, string>; query?: Record<string, string> }): void => {
	if (inDrawer.value) {
		router.replace(to);
	} else {
		router.push(to);
	}
};

// Next to an open form the editor stays usable: replacing a changed form asks first, as closing it does
// A confirmed discard lets the form go here, so the route guard below does not ask a second time
const discardForm = async (): Promise<boolean> => {
	if (!(await confirmDiscard())) {
		return false;
	}

	remoteFormChanged.value = false;

	return true;
};

const canReplaceOpenForm = async (): Promise<boolean> => !showDrawer.value || !remoteFormChanged.value || discardForm();

// On phone a form is its own page and replaces the editor, whose grids hold the only copy of unsaved layout changes
const canOpenForm = async (): Promise<boolean> => {
	if (!inDrawer.value && remotePageChanged.value) {
		if (!(await confirmDiscard())) {
			return false;
		}

		// The editor goes away with its changes; it comes back with the saved layout
		remotePageChanged.value = false;

		return true;
	}

	return canReplaceOpenForm();
};

const gridOf = (display: IDisplay | null): string =>
	display ? `${props.page.rows ?? display.rows ?? 12}x${props.page.cols ?? display.cols ?? 24}` : '';

// A display with another grid rebuilds the canvas from the saved layout, so unsaved changes are asked about first; a
// display with the same grid only changes the theme and keeps them
const onDisplaySelect = async (displayId: string): Promise<void> => {
	const next = applicableDisplays.value.find((display) => display.id === displayId) ?? null;

	if (remotePageChanged.value && gridOf(next) !== gridOf(selectedDisplay.value) && !(await confirmDiscard())) {
		return;
	}

	selectedDisplayId.value = displayId;
};

const onSelect = (place: IPageConfigureTilePlace | null): void => {
	selectedPlace.value = place;

	if (place !== null) {
		pagePanelOpen.value = false;
	}
};

const onInspectorClose = (): void => {
	selectedPlace.value = null;
};

const onTogglePagePanel = (): void => {
	pagePanelOpen.value = !pagePanelOpen.value;

	if (pagePanelOpen.value) {
		selectedPlace.value = null;
	}
};

const onClose = (): void => {
	router.push({ name: DashboardRouteNames.PAGES });
};

const onDiscard = async (): Promise<void> => {
	if (!(await confirmDiscard())) {
		return;
	}

	allowLeave = true;

	router.push({ name: DashboardRouteNames.PAGES });
};

const onSave = (): void => {
	remotePageSubmit.value = true;
};

const onTileAdd = async (tileType: string): Promise<void> => {
	paletteSheet.value = false;

	if (!(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_ADD_TILE, params: { id: props.page.id }, query: { tileType } });
};

const onTileEdit = async (id: ITile['id']): Promise<void> => {
	if ((route.name === RouteNames.PAGE_EDIT_TILE && route.params.tileId === id) || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_EDIT_TILE, params: { id: props.page.id, tileId: id } });
};

const onTileDetail = (id: ITile['id']): void => {
	router.push({ name: DashboardRouteNames.TILE, params: { id } });
};

const onTileHide = (id: ITile['id']): void => {
	configure.value?.hideTile(id);
};

const onTileShow = (id: ITile['id']): void => {
	configure.value?.showTile(id);
};

const onTileRemove = (id: ITile['id']): void => {
	configure.value?.removeTile(id);
};

const onPageDataSourceAdd = async (): Promise<void> => {
	if (route.name === RouteNames.PAGE_ADD_DATA_SOURCE || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_ADD_DATA_SOURCE, params: { id: props.page.id } });
};

const onPageDataSourceEdit = async (dataSourceId: IDataSource['id']): Promise<void> => {
	if ((route.name === RouteNames.PAGE_EDIT_DATA_SOURCE && route.params.dataSourceId === dataSourceId) || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_EDIT_DATA_SOURCE, params: { id: props.page.id, dataSourceId } });
};

const onPageDataSourceRemove = (id: IDataSource['id']): void => {
	dataSourcesActions.remove(id);
};

const onCloseDrawer = async (done?: () => void): Promise<void> => {
	if (remoteFormChanged.value && !(await discardForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE, params: { id: props.page.id } });

	done?.();
};

// Back, a breadcrumb or a link that closes or replaces a changed form while staying in the editor asks first; the
// editor's own buttons and the form's Discard and Save have already let the form go
onBeforeRouteUpdate(async (to: RouteLocationNormalized): Promise<boolean> => {
	if (!remoteFormChanged.value || formKeyOf(to) === formKey.value) {
		return true;
	}

	return discardForm();
});

onBeforeRouteLeave(async (): Promise<boolean> => {
	// An open form with changes counts too: leaving the editor closes it
	if (allowLeave || (!remotePageChanged.value && !remoteFormChanged.value)) {
		return true;
	}

	return confirmDiscard();
});

onBeforeMount((): void => {
	if (!loadingDisplays.value) {
		fetchDisplays().catch((): void => {
			// Silently ignore display fetch errors
		});
	}

	if (!loadingTiles.value) {
		fetchTiles().catch((): void => {
			flashMessage.error(t('pagesTilesPlugin.messages.misc.requestError'));
		});
	}

	fetchDataSources().catch((): void => {
		flashMessage.error(t('pagesTilesPlugin.messages.misc.requestError'));
	});
});

// The changed flag belongs to the form that is open. Any route change that replaces or closes it clears the flag
// before the next form mounts, so that one starts clean. A declined discard leaves the route, and the flag, as it was
watch(formKey, (): void => {
	remoteFormChanged.value = false;
});

watch(
	(): boolean => remoteFormChanged.value,
	(val: boolean): void => {
		emit('update:remote-form-changed', val);
	}
);

watch(
	(): boolean => remotePageChanged.value,
	(val: boolean): void => {
		emit('update:remote-page-changed', val);
	}
);

watch(
	(): FormResultType => remotePageResult.value,
	(val: FormResultType): void => {
		if (val === FormResult.OK) {
			flashMessage.success(t('pagesTilesPlugin.editor.messages.saved'));
		} else if (val === FormResult.ERROR) {
			flashMessage.error(t('pagesTilesPlugin.editor.messages.saveFailed'));
		} else {
			return;
		}

		remotePageResult.value = FormResult.NONE;
	}
);

// A tile that is gone (removed in another form or by another admin) leaves the inspector
watch(
	(): ITile | null => selectedTile.value,
	(val: ITile | null): void => {
		if (val === null && selectedPlace.value !== null) {
			selectedPlace.value = null;
		}
	}
);

watch(
	(): IDisplay[] => applicableDisplays.value,
	(val: IDisplay[]): void => {
		const first = val[0];

		if (!first) {
			selectedDisplayId.value = null;

			return;
		}

		if (!selectedDisplayId.value || !val.some((display) => display.id === selectedDisplayId.value)) {
			selectedDisplayId.value = first.id;
		}
	},
	{ immediate: true }
);
</script>

<style scoped lang="scss">
.tiles-editor {
	border: 1px solid var(--el-border-color);
	border-radius: var(--el-border-radius-base);
	background-color: var(--el-bg-color);

	&__bar {
		flex: none;
		border-bottom: 1px solid var(--el-border-color);
	}

	&__palette {
		border-right: 1px solid var(--el-border-color);
	}

	&__inspector {
		border-left: 1px solid var(--el-border-color);
		background-color: var(--el-bg-color);
	}

	// Tablet portrait: the inspector lies over the canvas, as a drawer from the right
	&__inspector--overlay {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 10;
		box-shadow: var(--fb-shadow-overlay);
	}
}
</style>
