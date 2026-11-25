<template>
	<!-- Phone: a card, tile or data source form is its own page -->
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

	<!-- Template 4: the card, tile and data source forms open next to the editor from tablet portrait up -->
	<edit-drawer-layout
		v-else
		:open="isFormRoute"
		:before-close="onCloseDrawer"
		class="h-full"
		@close="onCloseDrawer()"
	>
		<!-- Template 8 on phone: the page is read as a list -->
		<el-scrollbar
			v-if="phoneList"
			class="flex-1 min-h-0"
		>
			<cards-page-list
				:cards="cards"
				:tiles="tilesByCard"
				@detail="onTileDetail"
			/>
		</el-scrollbar>

		<!-- Template 8: toolbar · canvas · inspector -->
		<div
			v-else
			class="cards-editor flex flex-col flex-1 min-h-0 overflow-hidden"
			data-test-id="cards-editor"
		>
			<div class="cards-editor__bar flex flex-row flex-wrap items-center gap-2 px-3 py-2">
				<el-button
					type="primary"
					plain
					class="ml-0!"
					data-test-id="cards-editor-add-card"
					@click="onCardAdd"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>
					{{ t('pagesCardsPlugin.buttons.addCard.title') }}
				</el-button>

				<el-button
					v-if="compactEditor"
					:type="pagePanelOpen ? 'primary' : 'default'"
					:plain="pagePanelOpen"
					:aria-pressed="pagePanelOpen"
					class="ml-0!"
					data-test-id="cards-editor-data-sources"
					@click="onTogglePagePanel"
				>
					<template #icon>
						<icon icon="mdi:database-outline" />
					</template>
					{{ t('pagesCardsPlugin.editor.buttons.dataSources') }}
				</el-button>

				<el-tag
					v-if="remotePageChanged"
					type="warning"
					disable-transitions
					data-test-id="cards-editor-unsaved"
				>
					{{ t('pagesCardsPlugin.editor.texts.unsaved') }}
				</el-tag>

				<div class="grow-1" />

				<div
					v-if="selectedDisplay"
					class="flex items-center gap-2 min-w-0"
				>
					<span class="text-label">{{ t('pagesCardsPlugin.editor.display.title') }}</span>

					<el-select
						v-if="applicableDisplays.length > 1"
						:model-value="selectedDisplay.id"
						:aria-label="t('pagesCardsPlugin.editor.display.title')"
						class="w-[200px]"
						data-test-id="cards-editor-display"
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
					data-test-id="cards-editor-discard"
					@click="onDiscard"
				>
					{{ t('pagesCardsPlugin.buttons.discard.title') }}
				</el-button>

				<el-button
					v-else
					class="ml-0!"
					data-test-id="cards-editor-close"
					@click="onClose"
				>
					{{ t('pagesCardsPlugin.buttons.close.title') }}
				</el-button>

				<el-button
					type="primary"
					class="ml-0!"
					:loading="saving"
					:disabled="!remotePageChanged || saving || gridLayout === null"
					data-test-id="cards-editor-save"
					@click="onSave"
				>
					{{ t('pagesCardsPlugin.buttons.save.title') }}
				</el-button>
			</div>

			<div class="relative flex flex-row flex-1 min-h-0">
				<page-configure
					v-if="gridLayout"
					ref="configure"
					:key="configureKey"
					v-model:remote-page-submit="remotePageSubmit"
					v-model:remote-page-result="remotePageResult"
					v-model:remote-page-changed="remotePageChanged"
					:page="props.page"
					:cards="cards"
					:grid-layout="gridLayout"
					:grid-card-style="gridCardStyle"
					:selected-display="selectedDisplay"
					:selected-tile-id="selectedPlace?.id ?? null"
					:selected-card-id="selectedPlace === null ? selectedCardId : null"
					@select-card="onSelectCard"
					@select-tile="onSelectTile"
					@tile-counts="(counts: Record<string, number>) => (cardTileCounts = counts)"
					@edit-card="onCardEdit"
					@add-tile="onTileAdd"
					@edit-tile="onTileEdit"
				/>

				<state-view
					v-else
					:kind="loadingDisplays ? 'loading' : 'empty'"
					icon="mdi:monitor-off"
					:title="loadingDisplays ? t('pagesCardsPlugin.editor.texts.loadingDisplays') : t('pagesCardsPlugin.editor.texts.noDisplay')"
					:description="loadingDisplays ? undefined : t('pagesCardsPlugin.editor.texts.noDisplayHint')"
					class="flex-1"
				/>

				<!-- Template 8: the inspector, 340 px beside the canvas (360 px on wide); on tablet portrait it lies over the
				     canvas, for the selected tile or card, or when Data sources is pressed -->
				<el-scrollbar
					v-if="!compactEditor || inspectorCard !== null || selectedPlace !== null || pagePanelOpen"
					:style="{ width: `${sizeClass === 'wd' ? INSPECTOR_WIDTH_WIDE : INSPECTOR_WIDTH}px` }"
					:class="['cards-editor__inspector shrink-0', { 'cards-editor__inspector--overlay': compactEditor }]"
				>
					<cards-inspector
						:place="selectedPlace"
						:tile="selectedTile"
						:card="inspectorCard"
						:card-tile-count="inspectorTileCount"
						:grid-layout="gridLayout"
						:data-sources="pageDataSources"
						:data-sources-loading="dataSourcesLoading"
						:disabled="saving"
						@close="onInspectorClose"
						@edit-tile="onTileEdit"
						@detail="onTileDetail"
						@remove-tile="onTileRemove"
						@add-tile="onTileAdd"
						@edit-card="onCardEdit"
						@remove-card="onCardRemove"
						@add-data-source="onPageDataSourceAdd"
						@edit-data-source="onPageDataSourceEdit"
						@remove-data-source="onPageDataSourceRemove"
					/>
				</el-scrollbar>
			</div>
		</div>

		<template #form>
			<!-- Keyed like the form: an error caught in one form does not stay over the next one -->
			<view-error :key="formKey">
				<template #icon>
					<icon icon="mdi:card-text-outline" />
				</template>
				<template #message>
					{{ t('pagesCardsPlugin.messages.misc.requestError') }}
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

import { ElButton, ElMessageBox, ElOption, ElScrollbar, ElSelect, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import { EditDrawerLayout, StateView, ViewError, injectStoresManager, provideEditDrawer, useFlashMessage, useSizeClass } from '../../../common';
import {
	RouteNames as DashboardRouteNames,
	FormResult,
	type FormResultType,
	type IDataSource,
	type ITile,
	useDataSourcesActions,
	useDataSourcesDataSource,
} from '../../../modules/dashboard';
import { dataSourcesStoreKey, tilesStoreKey } from '../../../modules/dashboard/store/keys';
import { type IDisplay, useDisplays } from '../../../modules/displays';
import CardsInspector from '../components/cards-inspector.vue';
import CardsPageList from '../components/cards-page-list.vue';
import type { IPageConfigureExpose, IPageConfigureTilePlace } from '../components/page-configure.types';
import PageConfigure from '../components/page-configure.vue';
import { useCards } from '../composables/useCards';
import { useCardsActions } from '../composables/useCardsActions';
import { RouteNames } from '../pages-cards.contants';
import type { ICard } from '../store/cards.store.types';

import type { IViewPageConfigureProps } from './view-page-configure.types';

defineOptions({
	name: 'ViewCardsPageConfigure',
});

const props = defineProps<IViewPageConfigureProps>();

const emit = defineEmits<{
	(e: 'update:remote-form-changed', formChanged: boolean): void;
	(e: 'update:remote-page-changed', pageChanged: boolean): void;
}>();

const INSPECTOR_WIDTH = 340;
const INSPECTOR_WIDTH_WIDE = 360;

const FORM_ROUTES: string[] = [
	RouteNames.PAGE_ADD_CARD,
	RouteNames.PAGE_EDIT_CARD,
	RouteNames.PAGE_CARD_ADD_TILE,
	RouteNames.PAGE_CARD_EDIT_TILE,
	RouteNames.PAGE_ADD_DATA_SOURCE,
	RouteNames.PAGE_EDIT_DATA_SOURCE,
];

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const flashMessage = useFlashMessage();

const { sizeClass, isPhone, isTabletPortrait } = useSizeClass();

const { displays, fetchDisplays, isLoading: loadingDisplays } = useDisplays();

const { cards, fetchCards, areLoading: loadingCards } = useCards({ pageId: props.page.id });
const { remove: removeCard } = useCardsActions();

const storesManager = injectStoresManager();
const tilesStore = storesManager.getStore(tilesStoreKey);
const dataSourcesStore = storesManager.getStore(dataSourcesStoreKey);

const { dataSources, areLoading: dataSourcesLoading, fetchDataSources } = useDataSourcesDataSource({ parent: 'page', parentId: props.page.id });
const dataSourcesActions = useDataSourcesActions({ parent: 'page', parentId: props.page.id });

const configure = ref<IPageConfigureExpose | null>(null);

const remoteFormChanged = ref<boolean>(false);
const remotePageSubmit = ref<boolean>(false);
const remotePageResult = ref<FormResultType>(FormResult.NONE);
const remotePageChanged = ref<boolean>(false);

const selectedDisplayId = ref<string | null>(null);

// Template 8: one thing is selected at a time, a tile (with its place in the editor) or a card
const selectedPlace = ref<IPageConfigureTilePlace | null>(null);
const selectedCardId = ref<string | null>(null);

// The tiles each card holds on the canvas now, removals and moves to another card included, as the canvas reports them
const cardTileCounts = ref<Record<string, number>>({});

// Tablet portrait: the inspector shows the page's data sources only when asked
const pagePanelOpen = ref<boolean>(false);

// A new key remounts the canvas from the saved layout: a confirmed discard drops every pending move and removal
const configureKey = ref<number>(0);

// Leaving the editor asks first while the layout has changes; Discard and a save let it go
let allowLeave = false;

const isFormRoute = computed<boolean>((): boolean => route.matched.some((matched) => FORM_ROUTES.includes(String(matched.name))));

// Template 4: the forms open next to the editor from tablet portrait up, as their own page on phone
const { inDrawer } = provideEditDrawer((): boolean => isFormRoute.value);

// One form per card, tile and data source (and one for each Add): a new key remounts the routed form
const formKeyOf = (location: RouteLocationNormalized): string => {
	const param = (name: string): string => (typeof location.params?.[name] === 'string' ? (location.params[name] as string) : '');
	const tileType = typeof location.query?.tileType === 'string' ? location.query.tileType : '';

	return `${String(location.name)}:${param('cardId')}:${param('tileId')}:${param('dataSourceId')}:${tileType}`;
};

const formKey = computed<string>((): string => formKeyOf(route));

const saving = computed<boolean>((): boolean => remotePageResult.value === FormResult.WORKING);

// The tiles of each card as the store holds them, saved or added from a form
const tilesByCard = computed<Record<string, ITile[]>>(
	(): Record<string, ITile[]> => Object.fromEntries(cards.value.map((card) => [card.id, tilesStore.findForParent('card', card.id)]))
);

// Phone reads the page as a list. A window that narrows past 720 px with unsaved layout changes keeps the editor, as
// the grids hold the only copy of those changes; so does a page with tiles added from a form but never saved, which
// the list leaves out and only the editor can save
const hasDrafts = computed<boolean>((): boolean => Object.values(tilesByCard.value).some((tiles) => tiles.some((tile) => tile.draft)));

const phoneList = computed<boolean>((): boolean => isPhone.value && !remotePageChanged.value && !hasDrafts.value);

// Tablet portrait, and a phone-width window still holding unsaved changes: the inspector lies over the canvas
const compactEditor = computed<boolean>((): boolean => isTabletPortrait.value || isPhone.value);

const pageDataSources = computed<IDataSource[]>((): IDataSource[] => dataSources.value.filter((dataSource) => !dataSource.draft));

// Found by id across the page: a tile moved to another card stays filed under its old card until Save
const selectedTile = computed<ITile | null>((): ITile | null => {
	const place = selectedPlace.value;

	if (!place) {
		return null;
	}

	for (const tiles of Object.values(tilesByCard.value)) {
		const tile = tiles.find((item) => item.id === place.id);

		if (tile) {
			return tile;
		}
	}

	return null;
});

// The selected card, or with a tile selected the card holding it now
const inspectorCard = computed<ICard | null>((): ICard | null => {
	const cardId = selectedPlace.value?.cardId ?? selectedCardId.value;

	return cardId ? (cards.value.find((card) => card.id === cardId) ?? null) : null;
});

const applicableDisplays = computed<IDisplay[]>((): IDisplay[] => {
	if (props.page.displays !== null && props.page.displays.length > 0) {
		return displays.value.filter((d) => props.page.displays!.includes(d.id));
	}

	return displays.value;
});

const selectedDisplay = computed<IDisplay | null>((): IDisplay | null => {
	return applicableDisplays.value.find((d) => d.id === selectedDisplayId.value) ?? applicableDisplays.value[0] ?? null;
});

const gridLayout = computed<{ rows: number; cols: number } | null>((): { rows: number; cols: number } | null => {
	if (selectedDisplay.value === null) {
		return null;
	}

	const rows = selectedDisplay.value.rows ?? 12;
	const cols = selectedDisplay.value.cols ?? 24;

	return { rows, cols };
});

const gridCardStyle = computed<Record<string, string>>((): Record<string, string> => {
	const display = selectedDisplay.value;

	if (!display || !display.screenWidth) {
		return { maxWidth: '540px' };
	}

	return {
		maxWidth: `${Math.min(display.screenWidth, 600)}px`,
	};
});

// The tiles the inspected card holds on the canvas now; before the canvas has reported, the ones the store files under it
const inspectorTileCount = computed<number>((): number => {
	const card = inspectorCard.value;

	return card ? (cardTileCounts.value[card.id] ?? (tilesByCard.value[card.id] ?? []).length) : 0;
});

const displayDetails = computed<string>((): string => {
	const display = selectedDisplay.value;
	const grid = t('pagesCardsPlugin.editor.display.grid', { cols: gridLayout.value?.cols ?? 0, rows: gridLayout.value?.rows ?? 0 });

	if (display?.screenWidth && display.screenHeight) {
		return `${display.screenWidth} × ${display.screenHeight} · ${grid}`;
	}

	return grid;
});

const confirmDiscard = async (): Promise<boolean> => {
	try {
		await ElMessageBox.confirm(t('pagesCardsPlugin.texts.misc.confirmDiscard'), t('pagesCardsPlugin.headings.misc.discard'), {
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

// A confirmed layout discard drops every unsaved change: the canvas is rebuilt from the saved layout, and tiles added
// from a form but never saved (drafts in the tiles store, which a re-fetch keeps) go with their data sources
const discardLayout = (): void => {
	for (const card of cards.value) {
		for (const tile of tilesStore.findForParent('card', card.id)) {
			if (!tile.draft) {
				continue;
			}

			dataSourcesStore.unset({ parent: { type: 'tile', id: tile.id } });

			tilesStore.remove({ id: tile.id, parent: { type: 'card', id: card.id } }).catch((): void => {
				// A draft is only dropped from the store; there is nothing to fail on
			});
		}
	}

	remotePageChanged.value = false;
	configureKey.value++;
};

const canReplaceOpenForm = async (): Promise<boolean> => !isFormRoute.value || !remoteFormChanged.value || discardForm();

// On phone a form is its own page and replaces the editor, whose grids hold the only copy of unsaved layout changes
const canOpenForm = async (): Promise<boolean> => {
	if (!inDrawer.value && remotePageChanged.value) {
		// A save in flight may still store a draft tile: the layout is not discarded under it
		if (saving.value) {
			return false;
		}

		if (!(await confirmDiscard())) {
			return false;
		}

		// The editor goes away with its changes; it comes back with the saved layout. Should the window widen past 720 px
		// while asking, the form opens beside the editor instead, so the canvas is rebuilt from the saved layout here too
		discardLayout();

		return true;
	}

	return canReplaceOpenForm();
};

const gridOf = (display: IDisplay | null): string => (display ? `${display.rows ?? 12}x${display.cols ?? 24}` : '');

// A display with another grid rebuilds the cards from the saved layout, so unsaved changes are asked about first; a
// display with the same grid only changes the theme and keeps them
const onDisplaySelect = async (displayId: string): Promise<void> => {
	const next = applicableDisplays.value.find((display) => display.id === displayId) ?? null;

	if (remotePageChanged.value && gridOf(next) !== gridOf(selectedDisplay.value)) {
		if (saving.value || !(await confirmDiscard())) {
			return;
		}

		discardLayout();
	}

	selectedDisplayId.value = displayId;
};

const onSelectCard = (id: ICard['id']): void => {
	selectedPlace.value = null;
	selectedCardId.value = id;
	pagePanelOpen.value = false;
};

const onSelectTile = (place: IPageConfigureTilePlace | null): void => {
	selectedPlace.value = place;

	if (place !== null) {
		selectedCardId.value = null;
		pagePanelOpen.value = false;
	}
};

const onInspectorClose = (): void => {
	selectedPlace.value = null;
	selectedCardId.value = null;
};

const onTogglePagePanel = (): void => {
	pagePanelOpen.value = !pagePanelOpen.value;

	if (pagePanelOpen.value) {
		onInspectorClose();
	}
};

const onTileRemove = (id: ITile['id']): void => {
	configure.value?.removeTile(id);
};

const onPageDataSourceRemove = (id: IDataSource['id']): void => {
	dataSourcesActions.remove(id);
};

const onClose = (): void => {
	router.push({ name: DashboardRouteNames.PAGES });
};

const onDiscard = async (): Promise<void> => {
	if (!(await confirmDiscard())) {
		return;
	}

	discardLayout();

	allowLeave = true;

	router.push({ name: DashboardRouteNames.PAGES });
};

const onSave = (): void => {
	remotePageSubmit.value = true;
};

const onCardAdd = async (): Promise<void> => {
	if (route.name === RouteNames.PAGE_ADD_CARD || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_ADD_CARD, params: { id: props.page.id } });
};

const onCardEdit = async (id: ICard['id']): Promise<void> => {
	if ((route.name === RouteNames.PAGE_EDIT_CARD && route.params.cardId === id) || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_EDIT_CARD, params: { id: props.page.id, cardId: id } });
};

const onCardRemove = (id: ICard['id']): void => {
	removeCard(id);
};

const onTileAdd = async (cardId: ICard['id']): Promise<void> => {
	if ((route.name === RouteNames.PAGE_CARD_ADD_TILE && route.params.cardId === cardId) || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_CARD_ADD_TILE, params: { id: props.page.id, cardId } });
};

const onTileEdit = async (tileId: ITile['id'], cardId: ICard['id']): Promise<void> => {
	if ((route.name === RouteNames.PAGE_CARD_EDIT_TILE && route.params.tileId === tileId) || !(await canOpenForm())) {
		return;
	}

	navigate({ name: RouteNames.PAGE_CARD_EDIT_TILE, params: { id: props.page.id, cardId, tileId } });
};

const onTileDetail = (id: ITile['id']): void => {
	router.push({ name: DashboardRouteNames.TILE, params: { id } });
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
	// On phone a form replaces the editor, whose grids hold the only copy of unsaved layout changes. The editor's own
	// buttons have asked already (and cleared the flag); Back, Forward or a link have not
	const toForm = to.matched.some((matched) => FORM_ROUTES.includes(String(matched.name)));

	if (toForm && !inDrawer.value && !isFormRoute.value && remotePageChanged.value) {
		if (saving.value || !(await confirmDiscard())) {
			return false;
		}

		discardLayout();

		return true;
	}

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

	// A save in flight may still store a draft tile: the editor stays until it settles
	if (remotePageChanged.value && saving.value) {
		return false;
	}

	if (!(await confirmDiscard())) {
		return false;
	}

	if (remotePageChanged.value) {
		discardLayout();
	}

	return true;
});

onBeforeMount((): void => {
	if (!loadingDisplays.value) {
		fetchDisplays().catch((): void => {
			// Silently ignore display fetch errors
		});
	}

	if (!loadingCards.value) {
		fetchCards().catch((): void => {
			flashMessage.error(t('pagesCardsPlugin.messages.misc.requestError'));
		});
	}

	fetchDataSources().catch((): void => {
		flashMessage.error(t('pagesCardsPlugin.messages.misc.requestError'));
	});
});

// The phone list reads the tiles without the canvas, so the editor loads each card's tiles itself, once
const fetchedCards = new Set<string>();

watch(
	(): ICard[] => cards.value,
	(val: ICard[]): void => {
		for (const card of val) {
			if (fetchedCards.has(card.id)) {
				continue;
			}

			fetchedCards.add(card.id);

			tilesStore.fetch({ parent: { type: 'card', id: card.id } }).catch((): void => {
				flashMessage.error(t('pagesCardsPlugin.messages.misc.requestError'));
			});
		}
	},
	{ immediate: true }
);

// A tile or card that is gone (removed here, in a form or by another admin) leaves the inspector
watch(
	(): ITile | null => selectedTile.value,
	(val: ITile | null): void => {
		if (val === null && selectedPlace.value !== null) {
			selectedPlace.value = null;
		}
	}
);

watch(
	(): ICard[] => cards.value,
	(val: ICard[]): void => {
		if (selectedCardId.value !== null && !val.some((card) => card.id === selectedCardId.value)) {
			selectedCardId.value = null;
		}
	}
);

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
			flashMessage.success(t('pagesCardsPlugin.editor.messages.saved'));
		} else if (val === FormResult.ERROR) {
			flashMessage.error(t('pagesCardsPlugin.editor.messages.saveFailed'));
		} else {
			return;
		}

		remotePageResult.value = FormResult.NONE;
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

		if (!selectedDisplayId.value || !val.some((d) => d.id === selectedDisplayId.value)) {
			selectedDisplayId.value = first.id;
		}
	},
	{ immediate: true }
);
</script>

<style scoped lang="scss">
.cards-editor {
	border: 1px solid var(--el-border-color);
	border-radius: var(--el-border-radius-base);
	background-color: var(--el-bg-color);

	&__bar {
		flex: none;
		border-bottom: 1px solid var(--el-border-color);
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
