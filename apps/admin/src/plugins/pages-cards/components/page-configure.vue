<template>
	<div class="h-full box-border overflow-hidden p-2">
		<el-row
			:gutter="10"
			justify="center"
			class="h-full"
		>
			<el-col
				:span="16"
				class="h-full overflow-hidden p-2"
			>
				<el-card
					body-class="p-0! flex flex-col overflow-hidden h-full"
					:class="[ns.b(), 'mx-auto overflow-hidden h-full']"
					:style="props.gridCardStyle"
				>
					<div :class="[ns.e('header'), 'flex items-center px-2 flex-shrink-0 min-h-9 py-1 b-b b-b-solid gap-1.5']">
						<div class="flex items-center gap-1 min-w-0 max-w-48">
							<el-icon
								:size="14"
								class="flex-shrink-0"
								color="var(--el-text-color-regular)"
							>
								<icon :icon="formatIcon(props.page.icon, 'mdi:view-dashboard-variant')" />
							</el-icon>
							<el-text
								size="small"
								class="truncate"
							>
								{{ props.page.title }}
							</el-text>
						</div>
						<div class="flex items-center gap-1 flex-1 min-w-0 flex-wrap justify-end">
							<el-tag
								v-for="ds in visibleDataSources"
								:key="ds.id"
								size="small"
								closable
								:class="ns.e('data-source-tag')"
								@close="onRemoveDataSource(ds.id)"
							>
								<span
									class="inline-flex items-center gap-0.5"
									@click="emit('editPageDataSource', ds.id)"
								>
									<el-icon :size="12">
										<icon :icon="getDataSourceIcon(ds) || 'mdi:database'" />
									</el-icon>
									<span class="truncate">{{ getDataSourceLabel(ds) }}</span>
								</span>
							</el-tag>
							<el-popover
								v-if="hiddenDataSources.length > 0"
								:width="280"
								trigger="click"
								placement="bottom"
							>
								<template #reference>
									<el-tag
										size="small"
										type="info"
										class="cursor-pointer flex-shrink-0"
									>
										+{{ hiddenDataSources.length }}
									</el-tag>
								</template>
								<div class="flex flex-col gap-1">
									<div
										v-for="ds in hiddenDataSources"
										:key="ds.id"
										:class="[ns.e('overflow-item'), 'flex items-center gap-1 py-1 px-1 rounded']"
									>
										<div
											class="flex items-center gap-1 min-w-0 flex-1 cursor-pointer"
											@click="emit('editPageDataSource', ds.id)"
										>
											<el-icon
												:size="14"
												color="var(--el-text-color-regular)"
											>
												<icon :icon="getDataSourceIcon(ds) || 'mdi:database'" />
											</el-icon>
											<el-text
												size="small"
												class="truncate"
											>
												{{ getDataSourceLabel(ds) }}
											</el-text>
										</div>
										<div class="flex items-center flex-shrink-0 gap-0.5">
											<el-button
												size="small"
												text
												circle
												@click="emit('editPageDataSource', ds.id)"
											>
												<template #icon>
													<icon
														icon="mdi:pencil"
														:width="14"
													/>
												</template>
											</el-button>
											<el-button
												size="small"
												text
												type="danger"
												circle
												@click="onRemoveDataSource(ds.id)"
											>
												<template #icon>
													<icon
														icon="mdi:trash-can-outline"
														:width="14"
													/>
												</template>
											</el-button>
										</div>
									</div>
								</div>
							</el-popover>
						</div>
						<el-button
							size="small"
							plain
							class="flex-shrink-0"
							@click="emit('addPageDataSource')"
						>
							<template #icon>
								<icon icon="mdi:plus" />
							</template>
						</el-button>
					</div>

					<div class="flex-1 overflow-auto min-h-0">
					<div
						v-if="sortedCards.length === 0"
						class="p-4 text-center"
					>
						<el-empty :description="t('pagesCardsPlugin.texts.cards.noCards')" />
					</div>

					<div
						v-for="card in sortedCards"
						:key="card.id"
						class="b-b b-b-solid"
						style="border-color: var(--el-border-color-lighter)"
					>
						<div :class="[ns.e('card-header'), 'flex items-center justify-between px-2 h-8 min-h-8 b-b b-b-solid']">
							<div class="flex items-center gap-1 min-w-0">
								<el-icon
									v-if="card.icon"
									:size="14"
									color="var(--el-text-color-regular)"
								>
									<icon :icon="formatIcon(card.icon, '')" />
								</el-icon>
								<el-text
									size="small"
									class="truncate font-medium"
								>
									{{ card.title }}
								</el-text>
								<el-tag
									size="small"
									type="info"
									class="ml-1"
								>
									#{{ card.order }}
								</el-tag>
							</div>
							<div class="flex items-center gap-1">
								<el-button
									size="small"
									plain
									@click="emit('addTile', card.id)"
								>
									<template #icon>
										<icon icon="mdi:plus" />
									</template>
								</el-button>
								<el-button
									size="small"
									plain
									@click="emit('editCard', card.id)"
								>
									<template #icon>
										<icon icon="mdi:pencil" />
									</template>
								</el-button>
								<el-button
									size="small"
									plain
									type="danger"
									@click="emit('removeCard', card.id)"
								>
									<template #icon>
										<icon icon="mdi:trash-can-outline" />
									</template>
								</el-button>
							</div>
						</div>

						<div class="p-2">
							<div
								:ref="(el) => setGridRef(card.id, el as HTMLElement | null)"
								class="card-grid-container"
							/>
						</div>
					</div>
					</div>
				</el-card>
			</el-col>

			<el-col
				:span="8"
				class="h-full overflow-auto p-2"
			>
				<div class="flex flex-col gap-2">
					<el-card
						v-if="props.displays.length > 0"
						body-class="p-2!"
					>
						<template #header>
							{{ t('pagesCardsPlugin.headings.configure.display') }}
						</template>

						<el-select
							v-if="props.displays.length > 1"
							:model-value="props.selectedDisplay?.id"
							size="small"
							class="w-full"
							@change="(val: string) => emit('selectDisplay', val)"
						>
							<el-option
								v-for="d in props.displays"
								:key="d.id"
								:value="d.id"
								:label="d.name || d.macAddress"
							>
								<div class="flex items-center justify-between w-full">
									<span>{{ d.name || d.macAddress }}</span>
									<el-text
										v-if="d.screenWidth && d.screenHeight"
										type="info"
										size="small"
									>
										{{ d.screenWidth }}x{{ d.screenHeight }}
									</el-text>
								</div>
							</el-option>
						</el-select>

						<div
							v-else-if="props.selectedDisplay"
							class="flex flex-col"
						>
							<el-text size="small">
								{{ props.selectedDisplay.name || props.selectedDisplay.macAddress }}
							</el-text>
							<el-text
								v-if="props.selectedDisplay.screenWidth && props.selectedDisplay.screenHeight"
								type="info"
								size="small"
							>
								{{ props.selectedDisplay.screenWidth }}x{{ props.selectedDisplay.screenHeight }}
								&middot;
								{{ props.gridLayout?.cols ?? '?' }}x{{ props.gridLayout?.rows ?? '?' }}
							</el-text>
						</div>
					</el-card>

					<el-card body-class="p-2!">
						<template #header>
							{{ t('pagesCardsPlugin.headings.configure.cards') }}
						</template>

						<div class="flex flex-col gap-1">
							<div
								v-for="card in sortedCards"
								:key="card.id"
								class="flex items-center justify-between p-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
								@click="emit('editCard', card.id)"
							>
								<div class="flex items-center gap-1 min-w-0">
									<el-icon
										v-if="card.icon"
										:size="14"
									>
										<icon :icon="formatIcon(card.icon, '')" />
									</el-icon>
									<el-text
										size="small"
										class="truncate"
									>
										{{ card.title }}
									</el-text>
								</div>
								<el-text
									type="info"
									size="small"
								>
									{{ getCardTiles(card.id).length }} {{ t('pagesCardsPlugin.texts.cards.tilesCount') }}
								</el-text>
							</div>

							<el-button
								size="small"
								class="w-full mt-1"
								@click="emit('addCard')"
							>
								<template #icon>
									<icon icon="mdi:plus" />
								</template>
								{{ t('pagesCardsPlugin.buttons.addCard.title') }}
							</el-button>
						</div>
					</el-card>
				</div>
			</el-col>
		</el-row>
	</div>
</template>

<script setup lang="ts">
import { type ComputedRef, computed, getCurrentInstance, h, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, render, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElCol, ElEmpty, ElIcon, ElOption, ElPopover, ElRow, ElSelect, ElTag, ElText, useNamespace } from 'element-plus';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import { storeToRefs } from 'pinia';

import { Icon } from '@iconify/vue';

import { injectStoresManager } from '../../../common';
import {
	DashboardException,
	FormResult,
	type FormResultType,
	type IDataSource,
	type ITile,
	useDataSources,
	useDataSourcesActions,
	useDataSourcesPlugins,
} from '../../../modules/dashboard';
import { tilesStoreKey } from '../../../modules/dashboard/store/keys';
import type { ICard } from '../store/cards.store.types';

import type { IPageConfigureProps } from './page-configure.types';
import TilePreview from './tile-preview.vue';

defineOptions({
	name: 'CardsPageConfigure',
});

const { t } = useI18n();

const ns = useNamespace('cards-page-configure');

const props = withDefaults(defineProps<IPageConfigureProps>(), {
	remotePageResult: FormResult.NONE,
	remotePageChanged: false,
});

const emit = defineEmits<{
	(e: 'selectDisplay', displayId: string): void;
	(e: 'addPageDataSource'): void;
	(e: 'editPageDataSource', id: IDataSource['id']): void;
	(e: 'addCard'): void;
	(e: 'editCard', id: ICard['id']): void;
	(e: 'removeCard', id: ICard['id']): void;
	(e: 'addTile', cardId: ICard['id']): void;
	(e: 'editTile', tileId: ITile['id'], cardId: ICard['id']): void;
	(e: 'tileDetail', id: ITile['id']): void;
	(e: 'update:remote-page-submit', remotePageSubmit: boolean): void;
	(e: 'update:remote-page-result', remotePageResult: FormResultType): void;
	(e: 'update:remote-page-changed', formChanged: boolean): void;
}>();

const { dataSources: pageDataSources, fetchDataSources: fetchPageDataSources } = useDataSources({ parent: 'page', parentId: props.page.id });
const { remove: removeDataSource } = useDataSourcesActions({ parent: 'page', parentId: props.page.id });
const { getElement: getDataSourceElement } = useDataSourcesPlugins();

const MAX_VISIBLE_DATA_SOURCES = 3;

const nonDraftDataSources = computed<IDataSource[]>(() => pageDataSources.value.filter((ds) => !ds.draft));
const visibleDataSources = computed<IDataSource[]>(() => nonDraftDataSources.value.slice(0, MAX_VISIBLE_DATA_SOURCES));
const hiddenDataSources = computed<IDataSource[]>(() => nonDraftDataSources.value.slice(MAX_VISIBLE_DATA_SOURCES));

const getDataSourceIcon = (ds: IDataSource): string | null => {
	const record = ds as Record<string, unknown>;

	return typeof record.icon === 'string' && record.icon ? record.icon : null;
};

const formatIcon = (icon: string | null, fallback: string): string => {
	if (!icon) return fallback;

	return icon.includes(':') ? icon : `mdi:${icon}`;
};

const getDataSourceLabel = (ds: IDataSource): string => {
	const element = getDataSourceElement(ds.type);

	return element?.name?.trim() ? element.name : ds.type;
};

const onRemoveDataSource = (id: IDataSource['id']): void => {
	removeDataSource(id);
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
let changeTimeout: ReturnType<typeof setTimeout>;
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

	const grid = cardGrids.get(cardId);

	if (!grid) return;

	const el = grid.getGridItems().find((item) => item.gridstackNode?.id === tileId);

	if (el) {
		grid.removeWidget(el);
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
	for (const [, grid] of cardGrids) {
		unmountGridComponents(grid);
		grid.removeAll(true);
		grid.destroy(false);
	}

	cardGrids.clear();
	cardTileSets.clear();
};

const destroyCardGrid = (cardId: string): void => {
	const grid = cardGrids.get(cardId);

	if (!grid) return;

	unmountGridComponents(grid);
	grid.removeAll(true);
	grid.destroy(false);
	cardGrids.delete(cardId);
	cardTileSets.delete(cardId);
};

const renderTileContent = (itemElContent: Element, tile: ITile, cardId: string): void => {
	const vnode = h(TilePreview, {
		tile,
		onDetail: (id: ITile['id']): void => {
			emit('tileDetail', id);
		},
		onEdit: (id: ITile['id']): void => {
			emit('editTile', id, cardId);
		},
		onRemove: (id: ITile['id']): void => {
			onTileRemove(id, cardId);
		},
	});

	if (appContext) {
		vnode.appContext = appContext;
	}

	render(vnode, itemElContent as HTMLElement);
};

const markChanged = (): void => {
	if (!initialized.value || suppressMarkChanged.value) {
		return;
	}

	clearTimeout(changeTimeout);

	changeTimeout = setTimeout(() => {
		pageChanged.value = true;
	}, 50);
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

			renderTileContent(itemElContent, tile, card.id);

			tileSet.add(tile.id);
		}
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

			grid.addWidget({
				id: tile.id,
				x: tile.col - 1,
				y: tile.row - 1,
				w: tile.colSpan,
				h: tile.rowSpan,
			});
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

	fetchPageDataSources().catch((error: unknown): void => {
		const err = error as Error;
		throw new DashboardException('Something went wrong', err);
	});
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
	}, 500);
});

onBeforeUnmount((): void => {
	window.removeEventListener('resize', onResize);
	clearTimeout(changeTimeout);
	clearTimeout(initTimeout);
	destroyGrids();
});

// Track card grid config (rows/cols) to detect dimension changes
const cardGridSignature = computed((): string => {
	return sortedCards.value
		.map((c) => `${c.id}:${c.rows ?? ''}:${c.cols ?? ''}`)
		.join('|');
});

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

// Watch for card grid config changes (rows/cols edits)
watch(
	cardGridSignature,
	(): void => {
		nextTick(() => {
			initializeGrids();
		});
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
			const ids = store.tiles.value.map((t) => t.id).sort().join(',');
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

<style rel="stylesheet/scss" lang="scss">
@use 'page-configure.scss';
</style>
