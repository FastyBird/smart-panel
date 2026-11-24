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
const { tiles, fetchTiles } = useTiles({ parent: 'page', parentId: props.page.id });
const {
	findById: findTileById,
	edit: editTile,
	save: saveTile,
	removeDirectly: removeTileDirectly,
} = useTilesActions({ parent: 'page', parentId: props.page.id });

// Capture the app context so VNodes created via h() for GridStack cells inherit the provide/inject chain (plugins
// manager, stores manager, etc.)
const appContext = getCurrentInstance()?.appContext ?? null;

// One cell, so a hidden tile fits any free cell it is dropped on; it takes its own size again on the page
const HIDDEN_TILE_WIDTH = 1;
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
// Tiles taken off both grids, deleted when the page is saved; each leaves the set once its own request succeeds
const removedTiles = new Set<ITile['id']>();
// The size a tile had on the page before it was hidden, kept until it is shown or the page is saved
const hiddenSizes = new Map<ITile['id'], { w: number; h: number }>();

// Counts the layout changes, so a save only settles the changes it sent
let revision = 0;

// The tiles in the bottom panel, for its empty line (the sets above are not reactive)
const hiddenCount = ref<number>(0);

// One square cell, sized so the whole page fits the canvas
const cellSize = ref<number>(0);

const suppressMarkChanged = ref<boolean>(false);
const pageChanged = ref<boolean>(false);
// While the layout is being saved the grids are locked, so nothing changes under the request
const saving = ref<boolean>(false);

// The grid layout when a drag or resize started, so a gesture that ends where it began changes nothing
let layoutAtGesture = '';

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

// A hidden tile keeps the size it had on the page, saved or not
const sizeOf = (tile: ITile): { w: number; h: number } => hiddenSizes.get(tile.id) ?? { w: tile.colSpan, h: tile.rowSpan };

const placeOf = (id: ITile['id']): IPageConfigureTilePlace | null => {
	const onPage = gridItemOf(pageGrid, id)?.gridstackNode;

	if (onPage) {
		return { id, hidden: false, row: (onPage.y ?? 0) + 1, col: (onPage.x ?? 0) + 1, rowSpan: onPage.h ?? 1, colSpan: onPage.w ?? 1 };
	}

	const hidden = gridItemOf(draftGrid, id)?.gridstackNode;
	const tile = tiles.value.find((item) => item.id === id);

	if (hidden && tile) {
		const size = sizeOf(tile);

		return { id, hidden: true, row: tile.row, col: tile.col, rowSpan: size.h, colSpan: size.w };
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

// Filling the grids from the store is not a change; everything after it is, from the first moment
const markChanged = (): void => {
	if (suppressMarkChanged.value) {
		return;
	}

	revision++;

	pageChanged.value = true;
};

const layoutKey = (): string =>
	JSON.stringify(
		(pageGrid?.engine.nodes ?? [])
			.map((node) => [String(node.id), node.x, node.y, node.w, node.h])
			.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
	);

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
const wireGridItem = (itemEl: GridItemHTMLElement, tile: ITile): void => {
	const place = placeOf(tile.id);

	// The tile type and where it sits, so two tiles of one type read apart
	const where = place
		? place.hidden
			? t('pagesTilesPlugin.editor.inspector.hidden')
			: t('pagesTilesPlugin.editor.inspector.positionValue', { row: place.row, col: place.col })
		: '';

	itemEl.setAttribute('tabindex', '0');
	itemEl.setAttribute('role', 'button');
	itemEl.setAttribute('aria-label', where ? `${tileName(tile)}, ${where}` : tileName(tile));

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

// The preview gets the tile as the store has it, at the size its cell has now, saved or not
const renderTileContent = (itemEl: GridItemHTMLElement, tile: ITile): void => {
	const content = itemEl.querySelector('.grid-stack-item-content');

	if (!content) {
		return;
	}

	const node = itemEl.gridstackNode;
	const live: ITile = node ? { ...tile, colSpan: node.w ?? tile.colSpan, rowSpan: node.h ?? tile.rowSpan } : tile;

	const vnode = h(TilePreview, { tile: live });

	if (appContext) {
		vnode.appContext = appContext;
	}

	render(vnode, content as HTMLElement);

	wireGridItem(itemEl, tile);
};

const refreshGridItems = (): void => {
	for (const grid of [pageGrid, draftGrid]) {
		for (const itemEl of grid?.getGridItems() ?? []) {
			const tile = tiles.value.find((item) => item.id === itemEl.gridstackNode?.id);

			if (tile) {
				renderTileContent(itemEl, tile);
			}
		}
	}
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
	hiddenSizes.clear();

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
			// A rebuild during a save stays locked until the save settles
			staticGrid: saving.value,
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
			staticGrid: saving.value,
		},
		draftGridContainer.value
	);

	pageGrid.on('dragstart resizestart', (): void => {
		layoutAtGesture = layoutKey();
	});

	pageGrid.on('dragstop resizestop', (): void => {
		if (layoutKey() !== layoutAtGesture) {
			markChanged();
		}

		refreshGridItems();
		reportSelection();
	});

	draftGrid.on('dragstop', (): void => {
		refreshGridItems();
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

			// Dragged back from the panel, where every tile is one size: it takes the size it had on the page again
			const size = hiddenSizes.get(tile.id);
			const itemEl = item.el;

			hiddenSizes.delete(tile.id);

			if (size) {
				nextTick((): void => {
					restoreSize(itemEl, size);
					renderTileContent(itemEl, tile);
					reportSelection();
				});
			}
		}

		markSelection();
		reportSelection();
	});

	pageGrid.on('removed', (_event, items): void => {
		// Hidden by hand or dragged to the panel: remember the size it had, resized or not
		if (!suppressMarkChanged.value) {
			for (const item of items) {
				if (item.id) {
					hiddenSizes.set(item.id, { w: item.w ?? 1, h: item.h ?? 1 });
				}
			}
		}

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

// Filling the grids from the store; a new draft tile counts as a change through the tiles watcher
const addTilesToGrids = (): void => {
	const wasSuppressed = suppressMarkChanged.value;

	suppressMarkChanged.value = true;

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

	suppressMarkChanged.value = wasSuppressed;
};

// Only where it fits the grid and covers no other tile; otherwise it keeps the size it was dropped at
const restoreSize = (itemEl: GridItemHTMLElement, size: { w: number; h: number }): void => {
	const node = itemEl.gridstackNode;

	if (!node || !pageGrid || !props.gridLayout || (node.w === size.w && node.h === size.h)) {
		return;
	}

	const x = node.x ?? 0;
	const y = node.y ?? 0;

	if (x + size.w > props.gridLayout.cols || y + size.h > props.gridLayout.rows) {
		return;
	}

	const covers = pageGrid.engine.nodes.some(
		(other) =>
			other !== node &&
			x < (other.x ?? 0) + (other.w ?? 1) &&
			x + size.w > (other.x ?? 0) &&
			y < (other.y ?? 0) + (other.h ?? 1) &&
			y + size.h > (other.y ?? 0)
	);

	if (!covers) {
		pageGrid.update(itemEl, { w: size.w, h: size.h });
	}
};

const hideTile = (id: ITile['id']): void => {
	const itemEl = gridItemOf(pageGrid, id);

	if (saving.value || !itemEl || !draftGrid) {
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

	if (saving.value || !itemEl || !tile || !pageGrid) {
		return false;
	}

	// The size it had on the page when it fits, otherwise one cell; never on top of another tile
	const own = sizeOf(tile);
	const fitsGrid = own.w <= (props.gridLayout?.cols ?? 0) && own.h <= (props.gridLayout?.rows ?? 0);
	const sizes = fitsGrid ? [own, { w: 1, h: 1 }] : [{ w: 1, h: 1 }];
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
	if (saving.value) {
		return;
	}

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

// Sends the layout as it is now. Each removal leaves the pending set as soon as its own request succeeds, so a retry
// never sends a confirmed one again
const saveLayout = async (): Promise<void> => {
	const updates: Promise<void>[] = [];
	const removals: Promise<void>[] = [];

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
			const size = hiddenSizes.get(node.id);

			updates.push(persist(node.id, size ? { hidden: true, rowSpan: size.h, colSpan: size.w } : { hidden: true }));
		}
	}

	for (const id of [...removedTiles]) {
		removals.push(
			removeTileDirectly({ id, parent: { type: 'page', id: props.page.id } }).then((): void => {
				removedTiles.delete(id);
			})
		);
	}

	// Every request settles before the grids unlock, so a retry never overlaps one still running
	const results = await Promise.allSettled([...updates, ...removals]);
	const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');

	if (failed) {
		// A failed delete can leave the store without the tile while the backend still has it, and the store then
		// treats a retry as done; reload the tiles so the retry sends it again. Tiles still pending removal stay off the grids
		if ((await Promise.allSettled(removals)).some((result) => result.status === 'rejected')) {
			await fetchTiles().catch((): void => undefined);
		}

		throw failed.reason;
	}
};

const lockGrids = (locked: boolean): void => {
	pageGrid?.setStatic(locked);
	draftGrid?.setStatic(locked);
};

onMounted((): void => {
	nextTick((): void => {
		initializeGrids();
	});

	if (typeof ResizeObserver !== 'undefined' && canvasArea.value) {
		resizeObserver = new ResizeObserver(onCanvasResize);
		resizeObserver.observe(canvasArea.value);
	}
});

onBeforeUnmount((): void => {
	resizeObserver?.disconnect();

	if (resizeFrame !== undefined) {
		cancelAnimationFrame(resizeFrame);
	}

	destroyGrids();
});

watch(
	(): ITile[] => tiles.value,
	(val: ITile[]): void => {
		addTilesToGrids();
		refreshGridItems();

		// Saving turns drafts into tiles; that is not a change. A tile added while saving reaches a grid and counts there
		if (!saving.value && val.some((tile) => tile.draft)) {
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

		const sentRevision = revision;

		saving.value = true;
		lockGrids(true);

		try {
			await saveLayout();

			// A change that came in while saving (a tile added from a form, a size kept for a tile hidden on a rebuilt
			// grid) is still to be saved
			if (revision === sentRevision) {
				hiddenSizes.clear();

				pageChanged.value = false;
			}

			emit('update:remote-page-result', FormResult.OK);
		} catch {
			emit('update:remote-page-result', FormResult.ERROR);
		} finally {
			saving.value = false;
			lockGrids(false);
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

		// The view asks before a display with another grid replaces unsaved changes; the rebuilt grids start from the store
		removedTiles.clear();
		revision++;
		pageChanged.value = false;

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
