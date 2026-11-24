<template>
	<!-- Template 8: the canvas, the page as the display draws it, and the bottom panel with the hidden tiles -->
	<div class="page-configure flex flex-col flex-1 min-h-0 min-w-0">
		<div
			ref="canvasArea"
			class="page-configure__canvas flex flex-1 min-h-0 items-center justify-center p-4 box-border overflow-hidden"
		>
			<display-surface
				:dark="props.dark"
				:style="frameStyle"
				class="page-configure__frame shrink-0"
				data-test-id="page-configure-canvas"
			>
				<div
					ref="pageGridContainer"
					class="w-full h-full"
				/>
			</display-surface>
		</div>

		<section
			class="page-configure__hidden flex flex-col shrink-0"
			:aria-label="t('pagesTilesPlugin.editor.hidden.title')"
			data-test-id="page-configure-hidden"
		>
			<div class="flex flex-wrap items-baseline gap-x-2 px-4 pt-2">
				<span class="text-label">{{ t('pagesTilesPlugin.editor.hidden.title') }}</span>
				<span class="text-help">{{ t('pagesTilesPlugin.editor.hidden.description') }}</span>
			</div>

			<div class="flex justify-center px-4 pt-2 pb-3 overflow-y-auto page-configure__hidden-body">
				<display-surface
					:dark="props.dark"
					:style="{ width: frameStyle.width }"
					class="page-configure__frame relative shrink-0"
				>
					<div
						ref="draftGridContainer"
						class="w-full"
					/>

					<span
						v-if="hiddenCount === 0"
						class="page-configure__hidden-empty display-text-caption"
					>
						{{ t('pagesTilesPlugin.editor.hidden.empty') }}
					</span>
				</display-surface>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, h, nextTick, onBeforeUnmount, onMounted, ref, render, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { type GridItemHTMLElement, GridStack, type GridStackNode } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

import { useFlashMessage } from '../../../common';
import { DisplaySurface, FormResult, type FormResultType, type ITile, useTiles, useTilesActions, useTilesPlugins } from '../../../modules/dashboard';

import type { IPageConfigureExpose, IPageConfigureProps, IPageConfigureTilePlace } from './page-configure.types';
import TilePreview from './tile-preview.vue';

defineOptions({
	name: 'PageConfigure',
});

const props = withDefaults(defineProps<IPageConfigureProps>(), {
	dark: false,
	selectedTileId: null,
	remotePageSubmit: false,
	remotePageResult: FormResult.NONE,
	remotePageChanged: false,
});

const emit = defineEmits<{
	(e: 'select', place: IPageConfigureTilePlace | null): void;
	(e: 'edit', id: ITile['id']): void;
	(e: 'update:remote-page-submit', remotePageSubmit: boolean): void;
	(e: 'update:remote-page-result', remotePageResult: FormResultType): void;
	(e: 'update:remote-page-changed', formChanged: boolean): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();

const { getElement } = useTilesPlugins();

// The editor view loads the tiles; this reads them from the store
const { tiles } = useTiles({ parent: 'page', parentId: props.page.id });
const {
	findById: findTileById,
	edit: editTile,
	save: saveTile,
	removeDirectly: removeTileDirectly,
} = useTilesActions({ parent: 'page', parentId: props.page.id });

// Capture the app context so VNodes created via h() for GridStack cells inherit the provide/inject chain (plugins
// manager, stores manager, etc.)
const appContext = getCurrentInstance()?.appContext ?? null;

const HIDDEN_TILE_WIDTH = 2;
const GRID_MARGIN = 4;
// The bottom panel keeps a low row, whatever size the page cells grow to
const HIDDEN_CELL_MAX = 72;

let pageGrid: GridStack | undefined;
let draftGrid: GridStack | undefined;
let resizeObserver: ResizeObserver | undefined;
let resizeFrame: number | undefined;

const canvasArea = ref<HTMLElement | null>(null);
const pageGridContainer = ref<HTMLElement | null>(null);
const draftGridContainer = ref<HTMLElement | null>(null);

const pageTiles = new Set<ITile['id']>();
const draftTiles = new Set<ITile['id']>();
const removedTiles = new Set<ITile['id']>();

// The tiles in the bottom panel, for its empty line (the sets above are not reactive)
const hiddenCount = ref<number>(0);

// One square cell, sized so the whole page fits the canvas
const cellSize = ref<number>(0);

const initialized = ref<boolean>(false);
const suppressMarkChanged = ref<boolean>(false);
const pageChanged = ref<boolean>(false);

let changeTimeout: ReturnType<typeof setTimeout> | undefined;
let initTimeout: ReturnType<typeof setTimeout> | undefined;

const frameStyle = computed<{ width: string; height: string }>((): { width: string; height: string } => {
	const cols = props.gridLayout?.cols ?? 0;
	const rows = props.gridLayout?.rows ?? 0;

	return {
		width: `${cols * cellSize.value}px`,
		height: `${rows * cellSize.value}px`,
	};
});

const tileName = (tile: ITile): string => {
	const element = getElement(tile.type);

	return element?.name?.trim() ? element.name : tile.type;
};

const gridItemOf = (grid: GridStack | undefined, id: ITile['id']): GridItemHTMLElement | undefined => {
	return grid?.getGridItems().find((item) => item.gridstackNode?.id === id);
};

const placeOf = (id: ITile['id']): IPageConfigureTilePlace | null => {
	const onPage = gridItemOf(pageGrid, id)?.gridstackNode;

	if (onPage) {
		return { id, hidden: false, row: (onPage.y ?? 0) + 1, col: (onPage.x ?? 0) + 1, rowSpan: onPage.h ?? 1, colSpan: onPage.w ?? 1 };
	}

	const hidden = gridItemOf(draftGrid, id)?.gridstackNode;
	const tile = tiles.value.find((item) => item.id === id);

	if (hidden && tile) {
		return { id, hidden: true, row: tile.row, col: tile.col, rowSpan: tile.rowSpan, colSpan: tile.colSpan };
	}

	return null;
};

// The inspector follows the selected tile as it is moved, resized, hidden or shown
const reportSelection = (): void => {
	if (props.selectedTileId) {
		emit('select', placeOf(props.selectedTileId));
	}
};

const markSelection = (): void => {
	for (const grid of [pageGrid, draftGrid]) {
		for (const item of grid?.getGridItems() ?? []) {
			item.classList.toggle('is-selected', item.gridstackNode?.id === props.selectedTileId);
		}
	}
};

const markChanged = (): void => {
	if (!initialized.value || suppressMarkChanged.value) {
		return;
	}

	clearTimeout(changeTimeout);

	changeTimeout = setTimeout((): void => {
		pageChanged.value = true;
	}, 50);
};

const updateHiddenCount = (): void => {
	hiddenCount.value = draftTiles.size;
};

const updateCellSize = (): void => {
	const area = canvasArea.value;

	if (!area || !props.gridLayout) {
		return;
	}

	const style = getComputedStyle(area);
	const width = area.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
	const height = area.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

	const size = Math.max(8, Math.floor(Math.min(width / props.gridLayout.cols, height / props.gridLayout.rows)));

	if (size === cellSize.value) {
		return;
	}

	cellSize.value = size;

	pageGrid?.cellHeight(size);
	draftGrid?.cellHeight(Math.min(size, HIDDEN_CELL_MAX));
};

const onCanvasResize = (): void => {
	if (resizeFrame !== undefined) {
		cancelAnimationFrame(resizeFrame);
	}

	resizeFrame = requestAnimationFrame((): void => {
		resizeFrame = undefined;

		updateCellSize();
	});
};

// The cell is a button: a click or Enter selects the tile, a double click opens its form
const wireGridItem = (itemEl: HTMLElement, tile: ITile): void => {
	itemEl.setAttribute('tabindex', '0');
	itemEl.setAttribute('role', 'button');
	itemEl.setAttribute('aria-label', tileName(tile));

	if (itemEl.dataset.wired === 'true') {
		return;
	}

	itemEl.dataset.wired = 'true';

	itemEl.addEventListener('click', (): void => {
		emit('select', placeOf(tile.id));
	});

	itemEl.addEventListener('dblclick', (): void => {
		emit('edit', tile.id);
	});

	itemEl.addEventListener('keydown', (event: KeyboardEvent): void => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();

			emit('select', placeOf(tile.id));
		}
	});
};

const renderTileContent = (itemEl: HTMLElement, tile: ITile): void => {
	const content = itemEl.querySelector('.grid-stack-item-content');

	if (!content) {
		return;
	}

	const vnode = h(TilePreview, { tile });

	if (appContext) {
		vnode.appContext = appContext;
	}

	render(vnode, content as HTMLElement);

	wireGridItem(itemEl, tile);
};

const unmountGridComponents = (grid: GridStack): void => {
	for (const el of grid.getGridItems()) {
		const content = el.querySelector('.grid-stack-item-content');

		if (content) {
			render(null, content as HTMLElement);
		}
	}
};

const destroyGrids = (): void => {
	if (pageGrid) {
		unmountGridComponents(pageGrid);
		pageGrid.removeAll(true);
		pageGrid.destroy(false);
		pageGrid = undefined;
	}

	if (draftGrid) {
		unmountGridComponents(draftGrid);
		draftGrid.removeAll(true);
		draftGrid.destroy(false);
		draftGrid = undefined;
	}

	pageTiles.clear();
	draftTiles.clear();

	updateHiddenCount();
};

const onItemsRemoved = (items: GridStackNode[], own: Set<ITile['id']>, other: Set<ITile['id']>): void => {
	for (const item of items) {
		const content = item.el?.querySelector('.grid-stack-item-content');

		if (content) {
			render(null, content as HTMLElement);
		}

		if (item.id) {
			own.delete(item.id);

			// A tile that left both grids is removed when the page is saved
			if (!other.has(item.id) && !suppressMarkChanged.value) {
				removedTiles.add(item.id);
			}

			markChanged();
		}
	}

	updateHiddenCount();
};

const initializeGrids = (): void => {
	// Suppress all event side effects (markChanged, removedTiles) during programmatic teardown and re-population
	suppressMarkChanged.value = true;

	destroyGrids();

	if (props.gridLayout === null || !pageGridContainer.value || !draftGridContainer.value) {
		suppressMarkChanged.value = false;

		return;
	}

	cellSize.value = 0;

	updateCellSize();

	pageGrid = GridStack.init(
		{
			column: props.gridLayout.cols,
			row: props.gridLayout.rows,
			cellHeight: cellSize.value,
			margin: GRID_MARGIN,
			float: true,
			acceptWidgets: true,
		},
		pageGridContainer.value
	);

	draftGrid = GridStack.init(
		{
			column: props.gridLayout.cols,
			minRow: 1,
			cellHeight: Math.min(cellSize.value, HIDDEN_CELL_MAX),
			margin: GRID_MARGIN,
			float: false,
			acceptWidgets: true,
		},
		draftGridContainer.value
	);

	pageGrid.on('dragstop resizestop', (): void => {
		markChanged();
		reportSelection();
	});

	draftGrid.on('dragstop', (): void => {
		reportSelection();
	});

	pageGrid.on('added', (_event, items): void => {
		markChanged();

		for (const item of items) {
			const tile = tiles.value.find((tile) => tile.id === item.id);

			if (!item.el || !tile) {
				continue;
			}

			renderTileContent(item.el, tile);

			pageTiles.add(tile.id);
			removedTiles.delete(tile.id);
		}

		markSelection();
		reportSelection();
	});

	pageGrid.on('removed', (_event, items): void => {
		onItemsRemoved(items, pageTiles, draftTiles);
	});

	draftGrid.on('added', (_event, items): void => {
		markChanged();

		for (const item of items) {
			const tile = tiles.value.find((tile) => tile.id === item.id);

			if (!item.el || !tile) {
				continue;
			}

			// Hidden tiles line up in the panel at one size, whatever size they have on the page
			draftGrid?.update(item.el, { w: HIDDEN_TILE_WIDTH, h: 1 });

			draftTiles.add(tile.id);
			removedTiles.delete(tile.id);

			const itemEl = item.el;

			nextTick((): void => {
				renderTileContent(itemEl, tile);
				markSelection();
			});
		}

		draftGrid?.compact();

		updateHiddenCount();
		reportSelection();
	});

	draftGrid.on('removed', (_event, items): void => {
		onItemsRemoved(items, draftTiles, pageTiles);

		draftGrid?.compact();
	});

	addTilesToGrids();

	suppressMarkChanged.value = false;
};

const addTilesToGrids = (): void => {
	for (const tile of tiles.value) {
		// Skip tiles removed in this session, and tiles already in a grid
		if (removedTiles.has(tile.id) || pageTiles.has(tile.id) || draftTiles.has(tile.id)) {
			continue;
		}

		const fitsHorizontally = tile.col + tile.colSpan - 1 <= (props.gridLayout?.cols ?? 0);
		const fitsVertically = tile.row + tile.rowSpan - 1 <= (props.gridLayout?.rows ?? 0);

		if (fitsHorizontally && fitsVertically && !tile.hidden && !tile.draft) {
			pageGrid?.addWidget({ id: tile.id, x: tile.col - 1, y: tile.row - 1, w: tile.colSpan, h: tile.rowSpan });
		} else {
			draftGrid?.addWidget({ id: tile.id, w: HIDDEN_TILE_WIDTH, h: 1 });
		}
	}

	draftGrid?.compact();
};

const hideTile = (id: ITile['id']): void => {
	const itemEl = gridItemOf(pageGrid, id);

	if (!itemEl || !draftGrid) {
		return;
	}

	// Into the panel first, so leaving the page does not count as a removal
	draftGrid.addWidget({ id, w: HIDDEN_TILE_WIDTH, h: 1 });
	pageGrid?.removeWidget(itemEl);

	reportSelection();
};

const showTile = (id: ITile['id']): boolean => {
	const itemEl = gridItemOf(draftGrid, id);
	const tile = tiles.value.find((item) => item.id === id);

	if (!itemEl || !tile || !pageGrid) {
		return false;
	}

	// Its own size when it fits, otherwise one cell; never on top of another tile
	const fitsGrid = tile.colSpan <= (props.gridLayout?.cols ?? 0) && tile.rowSpan <= (props.gridLayout?.rows ?? 0);
	const sizes = fitsGrid
		? [
				{ w: tile.colSpan, h: tile.rowSpan },
				{ w: 1, h: 1 },
			]
		: [{ w: 1, h: 1 }];
	const size = sizes.find((candidate) => pageGrid?.willItFit({ ...candidate, autoPosition: true }));

	if (!size) {
		flashMessage.warning(t('pagesTilesPlugin.editor.messages.noRoom'));

		return false;
	}

	pageGrid.addWidget({ id, ...size, autoPosition: true });
	draftGrid?.removeWidget(itemEl);

	reportSelection();

	return true;
};

const removeTile = (id: ITile['id']): void => {
	const onPage = gridItemOf(pageGrid, id);

	if (onPage) {
		pageGrid?.removeWidget(onPage);
	} else {
		const hidden = gridItemOf(draftGrid, id);

		if (hidden) {
			draftGrid?.removeWidget(hidden);
		}
	}

	if (props.selectedTileId === id) {
		emit('select', null);
	}
};

const saveLayout = async (): Promise<void> => {
	const updates: Promise<void>[] = [];

	const persist = async (id: ITile['id'], data: Record<string, unknown>): Promise<void> => {
		const tile = findTileById('page', id);

		if (!tile) {
			return;
		}

		const edited = await editTile({ id: tile.id, parent: tile.parent, data: { type: tile.type, ...data } });

		if (edited.draft) {
			await saveTile({ id: edited.id, parent: edited.parent });
		}
	};

	for (const item of pageGrid?.getGridItems() ?? []) {
		const node = item.gridstackNode;

		if (node?.id) {
			updates.push(persist(node.id, { row: (node.y ?? 0) + 1, col: (node.x ?? 0) + 1, rowSpan: node.h || 1, colSpan: node.w || 1, hidden: false }));
		}
	}

	for (const item of draftGrid?.getGridItems() ?? []) {
		const node = item.gridstackNode;

		if (node?.id) {
			updates.push(persist(node.id, { hidden: true }));
		}
	}

	for (const id of removedTiles) {
		const tile = findTileById('page', id);

		if (tile) {
			updates.push(removeTileDirectly({ id, parent: tile.parent }).then((): void => undefined));
		}
	}

	await Promise.all(updates);

	removedTiles.clear();
};

onMounted((): void => {
	nextTick((): void => {
		initializeGrids();
	});

	if (typeof ResizeObserver !== 'undefined' && canvasArea.value) {
		resizeObserver = new ResizeObserver(onCanvasResize);
		resizeObserver.observe(canvasArea.value);
	}

	initTimeout = setTimeout((): void => {
		initialized.value = true;
	}, 500);
});

onBeforeUnmount((): void => {
	resizeObserver?.disconnect();

	if (resizeFrame !== undefined) {
		cancelAnimationFrame(resizeFrame);
	}

	clearTimeout(changeTimeout);
	clearTimeout(initTimeout);

	destroyGrids();
});

watch(
	(): ITile[] => tiles.value,
	(val: ITile[]): void => {
		addTilesToGrids();

		if (val.some((tile) => tile.draft)) {
			markChanged();
		}
	}
);

watch(
	(): ITile['id'] | null => props.selectedTileId,
	(): void => {
		markSelection();
	}
);

watch(
	(): boolean => props.remotePageSubmit,
	async (val: boolean): Promise<void> => {
		if (!val) {
			return;
		}

		emit('update:remote-page-submit', false);
		emit('update:remote-page-result', FormResult.WORKING);

		try {
			await saveLayout();

			pageChanged.value = false;

			emit('update:remote-page-result', FormResult.OK);
		} catch {
			emit('update:remote-page-result', FormResult.ERROR);
		}
	}
);

watch(
	(): boolean => pageChanged.value,
	(val: boolean): void => {
		emit('update:remote-page-changed', val);
	}
);

// A new grid size rebuilds both grids
watch(
	(): { rows: number; cols: number } | null => props.gridLayout,
	(newVal, oldVal): void => {
		if (newVal && oldVal && newVal.rows === oldVal.rows && newVal.cols === oldVal.cols) {
			return;
		}

		nextTick((): void => {
			initializeGrids();
		});
	}
);

defineExpose<IPageConfigureExpose>({
	hideTile,
	showTile,
	removeTile,
});
</script>

<style scoped lang="scss">
.page-configure {
	&__canvas {
		background-color: var(--el-fill-color-lighter);
	}

	// The display's screen: its page surface, framed like a device
	&__frame {
		border: 1px solid var(--el-border-color);
		border-radius: var(--el-border-radius-base);
	}

	&__hidden {
		border-top: 1px solid var(--el-border-color);
		background-color: var(--el-bg-color);
	}

	&__hidden-body {
		max-height: 30vh;
	}

	&__hidden-empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	:deep(.grid-stack-item) {
		outline: none;
		cursor: pointer;

		> .grid-stack-item-content {
			display: flex;
			flex-direction: column;
			border-radius: 6px;
		}

		// Admin spec §7: the host draws the selection ring, 2 px in the admin's primary colour
		&.is-selected > .grid-stack-item-content,
		&:focus-visible > .grid-stack-item-content {
			outline: 2px solid var(--el-color-primary);
			outline-offset: 1px;
		}
	}
}
</style>
