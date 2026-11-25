<template>
	<!-- Template 8: the canvas, the page's cards one under another, each drawn as the display draws it -->
	<el-scrollbar
		class="cards-configure flex-1 min-h-0 min-w-0"
		view-class="p-4 box-border"
		data-test-id="cards-configure-canvas"
	>
		<div
			class="flex flex-col gap-4 mx-auto"
			:style="props.gridCardStyle"
		>
			<state-view
				v-if="sortedCards.length === 0"
				kind="empty"
				icon="mdi:view-dashboard-outline"
				:title="t('pagesCardsPlugin.texts.cards.noCards')"
				:description="t('pagesCardsPlugin.editor.texts.noCardsHint')"
			/>

			<section
				v-for="card in sortedCards"
				:key="card.id"
				:class="['cards-configure__card', { 'is-selected': props.selectedCardId === card.id }]"
				:aria-label="card.title"
				:data-test-id="`cards-configure-card-${card.id}`"
			>
				<div class="cards-configure__card-header flex items-center gap-1 pl-1 pr-2 py-1">
					<!-- The card heading is a button: a click selects the card, a double click opens its form -->
					<button
						type="button"
						class="cards-configure__card-title flex items-center gap-2 flex-1 min-w-0 px-2 py-1 text-left"
						:aria-pressed="props.selectedCardId === card.id"
						:data-test-id="`cards-configure-select-${card.id}`"
						@click="emit('selectCard', card.id)"
						@dblclick="emit('editCard', card.id)"
					>
						<icon
							v-if="card.icon"
							:icon="formatIcon(card.icon, 'mdi:card-outline')"
							width="18"
							height="18"
							class="shrink-0 text-secondary"
							aria-hidden="true"
						/>
						<span class="text-label truncate">{{ card.title }}</span>
						<span class="text-help whitespace-nowrap">{{ t('pagesCardsPlugin.editor.card.tiles', { count: getCardTiles(card.id).length }) }}</span>
					</button>

					<el-tooltip
						:content="t('pagesCardsPlugin.editor.buttons.addTile')"
						placement="top"
					>
						<el-button
							text
							circle
							:aria-label="t('pagesCardsPlugin.editor.aria.addTile', { card: card.title })"
							:data-test-id="`cards-configure-add-tile-${card.id}`"
							@click="emit('addTile', card.id)"
						>
							<template #icon>
								<icon icon="mdi:plus" />
							</template>
						</el-button>
					</el-tooltip>
				</div>

				<!-- Admin spec §7 `tilePreview`: the tiles are drawn in the selected display's theme -->
				<display-surface
					:dark="props.selectedDisplay?.darkMode ?? false"
					class="p-2"
				>
					<div
						:ref="(el) => setGridRef(card.id, el as HTMLElement | null)"
						class="card-grid-container"
					/>
				</display-surface>
			</section>
		</div>
	</el-scrollbar>
</template>

<script setup lang="ts">
import { type ComputedRef, computed, getCurrentInstance, h, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, render, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { storeToRefs } from 'pinia';

import { ElButton, ElScrollbar, ElTooltip } from 'element-plus';
import { type GridItemHTMLElement, GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

import { Icon } from '@iconify/vue';

import { StateView, injectStoresManager } from '../../../common';
import { DashboardException, DisplaySurface, FormResult, type FormResultType, type ITile, useTilesPlugins } from '../../../modules/dashboard';
import { tilesStoreKey } from '../../../modules/dashboard/store/keys';
import type { ICard } from '../store/cards.store.types';

import type { IPageConfigureProps, IPageConfigureTilePlace } from './page-configure.types';
import TilePreview from './tile-preview.vue';

defineOptions({
	name: 'CardsPageConfigure',
});

const { t } = useI18n();

const props = withDefaults(defineProps<IPageConfigureProps>(), {
	remotePageResult: FormResult.NONE,
	remotePageChanged: false,
	selectedTileId: null,
	selectedCardId: null,
});

const emit = defineEmits<{
	(e: 'selectCard', id: ICard['id']): void;
	(e: 'selectTile', place: IPageConfigureTilePlace | null): void;
	(e: 'editCard', id: ICard['id']): void;
	(e: 'addTile', cardId: ICard['id']): void;
	(e: 'editTile', tileId: ITile['id'], cardId: ICard['id']): void;
	(e: 'update:remote-page-submit', remotePageSubmit: boolean): void;
	(e: 'update:remote-page-result', remotePageResult: FormResultType): void;
	(e: 'update:remote-page-changed', formChanged: boolean): void;
}>();

const { getElement: getTileElement } = useTilesPlugins();

const formatIcon = (icon: string | null, fallback: string): string => {
	if (!icon) return fallback;

	return icon.includes(':') ? icon : `mdi:${icon}`;
};

const appContext = getCurrentInstance()?.appContext ?? null;

const sortedCards = computed<ICard[]>((): ICard[] => {
	return [...props.cards].sort((a, b) => a.order - b.order);
});

const cardGrids = new Map<string, GridStack>();
const cardGridContainers = new Map<string, HTMLElement>();
const cardTileSets = new Map<string, Set<ITile['id']>>();
const removedTiles = new Set<ITile['id']>();

const initialized = ref<boolean>(false);
const suppressMarkChanged = ref<boolean>(false);
const pageChanged = ref<boolean>(false);
// Set while grids are torn down: a grid already destroyed has no element left to read its items from
let tearingDown = false;
let initTimeout: ReturnType<typeof setTimeout>;

// Capture storesManager during setup (injection context available)
// so tile stores can be created later in watcher callbacks
const storesManager = injectStoresManager();
const tilesStore = storesManager.getStore(tilesStoreKey);
const { firstLoad: tilesFirstLoad, semaphore: tilesSemaphore } = storeToRefs(tilesStore);

interface ITileStoreAccessor {
	tiles: ComputedRef<ITile[]>;
	areLoading: ComputedRef<boolean>;
	fetchTiles: () => Promise<void>;
}

interface ITileActionsAccessor {
	findById: (parent: string, id: ITile['id']) => ITile | null;
	edit: (payload: { id: ITile['id']; parent: { type: string; id: string }; data: { type: string } & Record<string, unknown> }) => Promise<ITile>;
	save: (payload: { id: ITile['id']; parent: { type: string; id: string } }) => Promise<ITile>;
	removeDirectly: (payload: { id: ITile['id']; parent: { type: string; id: string } }) => Promise<boolean>;
}

// Load tiles for each card
const tilesByCard = new Map<string, ITileStoreAccessor>();
const tileActionsByCard = new Map<string, ITileActionsAccessor>();

const ensureTileStore = (cardId: string): void => {
	if (tilesByCard.has(cardId)) {
		return;
	}

	const tiles = computed<ITile[]>((): ITile[] => tilesStore.findForParent('card', cardId));

	const areLoading = computed<boolean>((): boolean => {
		return tilesSemaphore.value.fetching.items.includes(cardId);
	});

	const fetchTiles = async (): Promise<void> => {
		await tilesStore.fetch({ parent: { type: 'card', id: cardId } });
	};

	tilesByCard.set(cardId, { tiles, areLoading, fetchTiles });

	tileActionsByCard.set(cardId, {
		findById: (parent: string, id: ITile['id']): ITile | null => tilesStore.findById(parent, id),
		edit: (payload): Promise<ITile> => tilesStore.edit(payload),
		save: (payload): Promise<ITile> => tilesStore.save(payload),
		removeDirectly: (payload): Promise<boolean> => tilesStore.remove(payload),
	});
};

const getCardTiles = (cardId: string): ITile[] => {
	ensureTileStore(cardId);

	return tilesByCard.get(cardId)?.tiles.value ?? [];
};

const setGridRef = (cardId: string, el: HTMLElement | null): void => {
	if (el) {
		cardGridContainers.set(cardId, el);
	} else {
		cardGridContainers.delete(cardId);
	}
};

const onTileRemove = (tileId: ITile['id'], cardId: string): void => {
	removedTiles.add(tileId);

	if (props.selectedTileId === tileId) {
		emit('selectTile', null);
	}

	const grid = cardGrids.get(cardId);

	if (!grid) return;

	const el = grid.getGridItems().find((item) => item.gridstackNode?.id === tileId);

	if (el) {
		grid.removeWidget(el);
	}
};

// The inspector's Remove: the tile leaves its card now and is deleted on Save
const removeTile = (tileId: ITile['id']): void => {
	const itemEl = itemOf(tileId);
	const cardId = itemEl ? cardIdOfItem(itemEl) : null;

	if (cardId !== null) {
		onTileRemove(tileId, cardId);
	}
};

defineExpose({ removeTile });

const unmountGridComponents = (grid: GridStack): void => {
	for (const el of grid.getGridItems()) {
		const content = el.querySelector('.grid-stack-item-content');

		if (content) {
			render(null, content as HTMLElement);
		}
	}
};

const destroyGrids = (): void => {
	tearingDown = true;

	try {
		for (const [, grid] of cardGrids) {
			unmountGridComponents(grid);
			grid.removeAll(true);
			grid.destroy(false);
		}
	} finally {
		tearingDown = false;
	}

	cardGrids.clear();
	cardTileSets.clear();
};

const destroyCardGrid = (cardId: string): void => {
	const grid = cardGrids.get(cardId);

	if (!grid) return;

	tearingDown = true;

	try {
		unmountGridComponents(grid);
		grid.removeAll(true);
		grid.destroy(false);
	} finally {
		tearingDown = false;
	}

	cardGrids.delete(cardId);
	cardTileSets.delete(cardId);
};

const tileName = (tile: ITile): string => {
	const element = getTileElement(tile.type);

	return element?.name?.trim() ? element.name : tile.type;
};

const cardIdOfItem = (itemEl: GridItemHTMLElement): ICard['id'] | null => {
	for (const [cardId, grid] of cardGrids) {
		if (itemEl.gridstackNode?.grid === grid) {
			return cardId;
		}
	}

	return null;
};

const itemOf = (tileId: ITile['id']): GridItemHTMLElement | null => {
	for (const [, grid] of cardGrids) {
		const itemEl = grid.getGridItems().find((item) => item.gridstackNode?.id === tileId);

		if (itemEl) {
			return itemEl;
		}
	}

	return null;
};

// Where the tile sits in the editor now, in which card, saved or not
const placeOf = (tileId: ITile['id']): IPageConfigureTilePlace | null => {
	const itemEl = itemOf(tileId);
	const node = itemEl?.gridstackNode;
	const cardId = itemEl ? cardIdOfItem(itemEl) : null;

	if (!node || cardId === null) {
		return null;
	}

	return { id: tileId, cardId, row: (node.y ?? 0) + 1, col: (node.x ?? 0) + 1, rowSpan: node.h ?? 1, colSpan: node.w ?? 1 };
};

const findTile = (tileId: ITile['id']): ITile | undefined => {
	for (const [, store] of tilesByCard) {
		const tile = store.tiles.value.find((item) => item.id === tileId);

		if (tile) {
			return tile;
		}
	}

	return undefined;
};

// The tile type, its card and where it sits, so two tiles of one type read apart
const labelOf = (itemEl: GridItemHTMLElement, tile: ITile): string => {
	const node = itemEl.gridstackNode;
	const card = sortedCards.value.find((item) => item.id === cardIdOfItem(itemEl));
	const where = node ? t('pagesCardsPlugin.editor.inspector.positionValue', { row: (node.y ?? 0) + 1, col: (node.x ?? 0) + 1 }) : '';

	return [tileName(tile), card?.title, where].filter((part) => part).join(', ');
};

// Tiles move when others are dragged, moved to another card or removed, so the selection ring, every name and the
// inspector are refreshed after each change
const refreshGridItems = (): void => {
	if (tearingDown) {
		return;
	}

	for (const [, grid] of cardGrids) {
		for (const itemEl of grid.getGridItems()) {
			const id = itemEl.gridstackNode?.id;
			const tile = id ? findTile(id) : undefined;

			itemEl.classList.toggle('is-selected', id !== undefined && id === props.selectedTileId);

			if (tile) {
				itemEl.setAttribute('aria-label', labelOf(itemEl, tile));
			}
		}
	}

	if (props.selectedTileId) {
		emit('selectTile', placeOf(props.selectedTileId));
	}
};

// The cell is a button: a click or Enter selects the tile, a double click opens its form
const wireGridItem = (itemEl: GridItemHTMLElement, tile: ITile): void => {
	itemEl.setAttribute('tabindex', '0');
	itemEl.setAttribute('role', 'button');
	itemEl.setAttribute('aria-label', labelOf(itemEl, tile));

	if (itemEl.dataset.wired === 'true') {
		return;
	}

	itemEl.dataset.wired = 'true';

	itemEl.addEventListener('click', (): void => {
		emit('selectTile', placeOf(tile.id));
	});

	itemEl.addEventListener('dblclick', (): void => {
		const cardId = cardIdOfItem(itemEl);

		if (cardId !== null) {
			emit('editTile', tile.id, cardId);
		}
	});

	itemEl.addEventListener('keydown', (event: KeyboardEvent): void => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();

			emit('selectTile', placeOf(tile.id));
		}
	});
};

const renderTileContent = (itemElContent: Element, tile: ITile): void => {
	const vnode = h(TilePreview, { tile });

	if (appContext) {
		vnode.appContext = appContext;
	}

	render(vnode, itemElContent as HTMLElement);
};

const markChanged = (): void => {
	if (!initialized.value || suppressMarkChanged.value) {
		return;
	}

	// At once: the editor reads the flag to decide what stays on screen, and a window narrowing to phone width right after
	// a move must not drop the editor holding it
	pageChanged.value = true;
};

const initializeCardGrid = (card: ICard): void => {
	const container = cardGridContainers.get(card.id);

	if (!container || !props.gridLayout) return;

	const gridCols = card.cols ?? props.gridLayout.cols;
	const gridRows = card.rows ?? props.gridLayout.rows;

	const grid = GridStack.init(
		{
			column: gridCols,
			row: gridRows,
			cellHeight: 'auto',
			margin: 4,
			float: true,
			acceptWidgets: true,
		},
		container
	);

	cardGrids.set(card.id, grid);

	if (!cardTileSets.has(card.id)) {
		cardTileSets.set(card.id, new Set());
	}

	const tileSet = cardTileSets.get(card.id)!;

	grid.on('dragstop', (_event, el): void => {
		const n = el.gridstackNode;
		const id = n?.id;

		if (!id) return;

		const tiles = getCardTiles(card.id);
		const tile = tiles.find((t) => t.id === id);

		if (!tile) return;

		if (tile.row - 1 !== n?.y || tile.col - 1 !== n?.x) {
			markChanged();
		}
	});

	grid.on('resizestop', (_event, el): void => {
		const n = el.gridstackNode;
		const id = n?.id;

		if (!id) return;

		const tiles = getCardTiles(card.id);
		const tile = tiles.find((t) => t.id === id);

		if (!tile) return;

		if (tile.rowSpan !== n?.h || tile.colSpan !== n?.w) {
			markChanged();
		}
	});

	grid.on('added', function (_event, items) {
		markChanged();

		for (const item of items) {
			const itemEl = item.el;
			if (!itemEl) continue;

			const itemElContent = itemEl.querySelector('.grid-stack-item-content');
			if (!itemElContent) continue;

			const itemId = item.id;

			// Search across all cards for this tile (handles cross-card moves)
			let tile: ITile | undefined;

			for (const [, store] of tilesByCard) {
				tile = store.tiles.value.find((t) => t.id === itemId);

				if (tile) break;
			}

			if (!tile) continue;

			renderTileContent(itemElContent, tile);
			wireGridItem(itemEl as GridItemHTMLElement, tile);

			tileSet.add(tile.id);
		}

		refreshGridItems();
	});

	grid.on('change', (): void => {
		refreshGridItems();
	});

	grid.on('removed', function (_event, items) {
		for (const item of items) {
			const itemEl = item.el;
			const itemElContent = itemEl?.querySelector('.grid-stack-item-content');

			if (itemElContent) {
				render(null, itemElContent as HTMLElement);
			}

			if (item.id) {
				tileSet.delete(item.id);
				markChanged();
			}
		}

		refreshGridItems();
	});

	// Update cell height to be square
	const width = container.clientWidth;
	const cols = grid.getColumn();
	const size = width / cols;
	grid.cellHeight(size);

	// Add tiles to grid
	const tiles = getCardTiles(card.id);

	for (const tile of tiles) {
		if (removedTiles.has(tile.id) || tileSet.has(tile.id)) {
			continue;
		}

		grid.addWidget({
			id: tile.id,
			x: tile.col - 1,
			y: tile.row - 1,
			w: tile.colSpan,
			h: tile.rowSpan,
		});
	}
};

const initializeGrids = (): void => {
	if (props.gridLayout === null) {
		suppressMarkChanged.value = true;
		destroyGrids();
		suppressMarkChanged.value = false;

		return;
	}

	suppressMarkChanged.value = true;
	destroyGrids();

	for (const card of sortedCards.value) {
		initializeCardGrid(card);
	}

	suppressMarkChanged.value = false;
};

const addTilesToCardGrids = (): void => {
	for (const card of sortedCards.value) {
		const tiles = getCardTiles(card.id);

		let grid = cardGrids.get(card.id);

		if (!grid) {
			// Ensure grid exists for every card (even empty ones, for drop targets)
			suppressMarkChanged.value = true;
			initializeCardGrid(card);
			suppressMarkChanged.value = false;

			grid = cardGrids.get(card.id);

			if (!grid) continue;
		}

		if (tiles.length === 0) continue;

		// Add new tiles to existing grid incrementally
		const tileSet = cardTileSets.get(card.id);

		if (!tileSet) continue;

		for (const tile of tiles) {
			if (removedTiles.has(tile.id) || tileSet.has(tile.id)) continue;

			// Suppress change marking for non-draft tiles (loaded from API).
			// Draft tiles are user-created and should activate the save button.
			if (!tile.draft) {
				suppressMarkChanged.value = true;
			}

			grid.addWidget({
				id: tile.id,
				x: tile.col - 1,
				y: tile.row - 1,
				w: tile.colSpan,
				h: tile.rowSpan,
			});

			if (!tile.draft) {
				suppressMarkChanged.value = false;
			}
		}
	}
};

onBeforeMount((): void => {
	for (const card of props.cards) {
		ensureTileStore(card.id);

		const store = tilesByCard.get(card.id)!;

		if (!store.areLoading.value) {
			store.fetchTiles().catch((error: unknown): void => {
				const err = error as Error;
				throw new DashboardException('Something went wrong', err);
			});
		}
	}
});

const updateCellSizes = (): void => {
	for (const [, grid] of cardGrids) {
		const el = grid.el;

		if (el) {
			const width = el.clientWidth;
			const cols = grid.getColumn();
			const size = width / cols;
			grid.cellHeight(size);
		}
	}
};

const onResize = (): void => {
	nextTick(() => {
		updateCellSizes();
	});
};

onMounted((): void => {
	nextTick(() => {
		initializeGrids();
	});

	window.addEventListener('resize', onResize);

	initTimeout = setTimeout(() => {
		initialized.value = true;

		// A tile added from a form while the canvas was away (on phone the form replaces it) is still a draft: the canvas
		// starts changed so Save can store it. A layout of saved tiles only starts clean
		if (sortedCards.value.some((card) => getCardTiles(card.id).some((tile) => tile.draft && !removedTiles.has(tile.id)))) {
			pageChanged.value = true;
		}
	}, 500);
});

onBeforeUnmount((): void => {
	window.removeEventListener('resize', onResize);
	clearTimeout(initTimeout);
	destroyGrids();
});

// Track card grid dimensions keyed by ID to detect rows/cols changes
const cardGridDimensions = computed((): Map<string, string> => {
	const map = new Map<string, string>();

	for (const c of sortedCards.value) {
		map.set(c.id, `${c.rows ?? ''}:${c.cols ?? ''}`);
	}

	return map;
});

let prevCardGridDimensions = new Map<string, string>();

// Watch for card list changes
watch(
	(): ICard[] => sortedCards.value,
	(): void => {
		for (const card of sortedCards.value) {
			ensureTileStore(card.id);

			const store = tilesByCard.get(card.id);

			// Always fetch if not loading and tiles are empty — the cards store
			// may have marked firstLoad without actually embedding tile data
			if (store && !store.areLoading.value && store.tiles.value.length === 0) {
				store.fetchTiles().catch((error: unknown): void => {
					const err = error as Error;
					throw new DashboardException('Something went wrong', err);
				});
			}
		}

		// Clean up grids for removed cards
		for (const [cardId] of cardGrids) {
			if (!sortedCards.value.some((c) => c.id === cardId)) {
				suppressMarkChanged.value = true;
				destroyCardGrid(cardId);
				suppressMarkChanged.value = false;
			}
		}

		addTilesToCardGrids();
	},
	{ flush: 'post' }
);

// Watch for card grid config changes (rows/cols edits only, not card list changes)
watch(
	cardGridDimensions,
	(newDims): void => {
		let dimensionsChanged = false;

		for (const [id, dims] of newDims) {
			const prev = prevCardGridDimensions.get(id);

			if (prev !== undefined && prev !== dims) {
				dimensionsChanged = true;

				break;
			}
		}

		prevCardGridDimensions = new Map(newDims);

		if (dimensionsChanged) {
			nextTick(() => {
				initializeGrids();
			});
		}
	},
	{ flush: 'post' }
);

// Watch for tile changes within cards
const tileSignature = computed((): string => {
	const parts: string[] = [];

	for (const card of sortedCards.value) {
		// Ensure the tile store exists so Vue subscribes to its tiles.value
		ensureTileStore(card.id);

		const store = tilesByCard.get(card.id);

		if (store) {
			const ids = store.tiles.value
				.map((t) => t.id)
				.sort()
				.join(',');
			parts.push(`${card.id}:${ids}`);
		}
	}

	return parts.sort().join('|');
});

watch(
	tileSignature,
	(): void => {
		addTilesToCardGrids();
	},
	{ flush: 'post' }
);

// React when tile fetches complete (firstLoad updates)
watch(
	(): string[] => tilesFirstLoad.value,
	(): void => {
		addTilesToCardGrids();
	},
	{ flush: 'post' }
);

watch(
	(): boolean => props.remotePageSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-page-submit', false);

			// Without a display there are no grids to read the layout from: nothing would be stored, so the save fails and
			// the page stays changed
			if (props.gridLayout === null || cardGrids.size === 0) {
				emit('update:remote-page-result', FormResult.ERROR);

				return;
			}

			emit('update:remote-page-result', FormResult.WORKING);

			try {
				// Collect all grid positions synchronously first
				const tileUpdates: {
					cardId: string;
					gridItems: { id: string; x: number; y: number; w: number; h: number }[];
				}[] = [];

				for (const [cardId, grid] of cardGrids) {
					const gridItems: { id: string; x: number; y: number; w: number; h: number }[] = [];

					for (const el of grid.getGridItems()) {
						const node = el.gridstackNode;

						if (!node?.id) continue;

						gridItems.push({
							id: node.id,
							x: node.x ?? 0,
							y: node.y ?? 0,
							w: node.w ?? 1,
							h: node.h ?? 1,
						});
					}

					tileUpdates.push({ cardId, gridItems });
				}

				// Now await all API calls
				for (const { cardId, gridItems } of tileUpdates) {
					const actions = tileActionsByCard.get(cardId);

					if (!actions) continue;

					for (const gridItem of gridItems) {
						// Search across all cards for this tile (handles cross-card moves)
						let tile: ITile | null = null;

						for (const [, a] of tileActionsByCard) {
							tile = a.findById('card', gridItem.id);

							if (tile) break;
						}

						if (tile) {
							tile = await actions.edit({
								id: tile.id,
								parent: { type: 'card', id: cardId },
								data: {
									type: tile.type,
									row: gridItem.y + 1,
									col: gridItem.x + 1,
									rowSpan: gridItem.h,
									colSpan: gridItem.w,
									hidden: false,
								},
							});

							if (tile.draft) {
								await actions.save({
									id: tile.id,
									parent: { type: 'card', id: cardId },
								});
							}
						}
					}
				}

				for (const tileId of removedTiles) {
					for (const [, actions] of tileActionsByCard) {
						const tile = actions.findById('card', tileId);

						if (tile) {
							await actions.removeDirectly({
								id: tileId,
								parent: { type: 'card', id: tile.parent.id },
							});

							break;
						}
					}
				}

				removedTiles.clear();

				emit('update:remote-page-result', FormResult.OK);

				pageChanged.value = false;
			} catch {
				emit('update:remote-page-result', FormResult.ERROR);
			}
		}
	}
);

watch(
	(): ITile['id'] | null => props.selectedTileId,
	(): void => {
		refreshGridItems();
	}
);

watch(
	(): boolean => pageChanged.value,
	(val: boolean): void => {
		emit('update:remote-page-changed', val);
	}
);

watch(
	(): { rows: number; cols: number } | null => props.gridLayout,
	(newVal, oldVal): void => {
		if (newVal && oldVal && newVal.rows === oldVal.rows && newVal.cols === oldVal.cols) {
			return;
		}

		nextTick(() => {
			initializeGrids();
		});
	}
);

watch(
	(): Record<string, string> => props.gridCardStyle,
	(): void => {
		nextTick(() => {
			updateCellSizes();
		});
	}
);
</script>

<style scoped lang="scss">
.cards-configure {
	background-color: var(--el-fill-color-lighter);

	&__card {
		border: 1px solid var(--el-border-color);
		border-radius: var(--el-border-radius-base);
		background-color: var(--el-bg-color);
		overflow: hidden;

		&.is-selected {
			outline: 2px solid var(--el-color-primary);
			outline-offset: 1px;
		}
	}

	&__card-header {
		border-bottom: 1px solid var(--el-border-color-lighter);
	}

	&__card-title {
		border: 0;
		border-radius: var(--el-border-radius-small);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;

		&:hover {
			background-color: var(--el-fill-color-light);
		}

		&:focus-visible {
			outline: 2px solid var(--el-color-primary);
			outline-offset: -2px;
		}
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
