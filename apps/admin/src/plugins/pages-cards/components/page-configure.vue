<template>
	<div class="h-full box-border overflow-hidden p-2">
		<el-row
			:gutter="10"
			justify="center"
			class="h-full"
		>
			<el-col
				:span="16"
				class="h-full overflow-auto p-2"
			>
				<el-card
					body-class="p-0! flex flex-col overflow-hidden"
					:class="[ns.b(), 'mx-auto overflow-hidden']"
					:style="props.gridCardStyle"
				>
					<div :class="[ns.e('header'), 'flex items-center justify-between px-2 flex-shrink-0 h-9 min-h-9 b-b b-b-solid']">
						<div class="flex items-center gap-1 min-w-0">
							<el-icon
								:size="14"
								color="var(--el-text-color-regular)"
							>
								<icon :icon="props.page.icon || 'mdi:view-dashboard-variant'" />
							</el-icon>
							<el-text
								size="small"
								class="truncate"
							>
								{{ props.page.title }}
							</el-text>
						</div>
						<el-button
							size="small"
							plain
							@click="emit('addPageDataSource')"
						>
							<template #icon>
								<icon icon="mdi:plus" />
							</template>
						</el-button>
					</div>

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
									<icon :icon="card.icon" />
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
								v-if="getCardTiles(card.id).length === 0"
								class="text-center py-3"
							>
								<el-text
									type="info"
									size="small"
								>
									{{ t('pagesCardsPlugin.texts.cards.noTiles') }}
								</el-text>
							</div>
							<div
								v-else
								:ref="(el) => setGridRef(card.id, el as HTMLElement | null)"
								class="card-grid-container"
							/>
						</div>
					</div>
				</el-card>
			</el-col>

			<el-col
				:span="8"
				class="p-2"
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
										<icon :icon="card.icon" />
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
import { computed, getCurrentInstance, h, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, render, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElCol, ElEmpty, ElIcon, ElOption, ElRow, ElSelect, ElTag, ElText, useNamespace } from 'element-plus';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

import { Icon } from '@iconify/vue';

import {
	DashboardException,
	FormResult,
	type FormResultType,
	type ITile,
	useTiles,
	useTilesActions,
} from '../../../modules/dashboard';
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

// Load tiles for each card
const tilesByCard = new Map<string, ReturnType<typeof useTiles>>();
const tileActionsByCard = new Map<string, ReturnType<typeof useTilesActions>>();

const ensureTileStore = (cardId: string): void => {
	if (!tilesByCard.has(cardId)) {
		tilesByCard.set(cardId, useTiles({ parent: 'card', parentId: cardId }));
		tileActionsByCard.set(cardId, useTilesActions({ parent: 'card', parentId: cardId }));
	}
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
	const grid = cardGrids.get(cardId);

	if (!grid) return;

	const el = document.querySelector(`.grid-stack-item[gs-id="${tileId}"]`);

	if (grid.getGridItems().some((item) => item.gridstackNode?.id === tileId)) {
		grid.removeWidget(el as HTMLElement);
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

	const grid = GridStack.init(
		{
			column: props.gridLayout.cols,
			row: props.gridLayout.rows,
			cellHeight: 'auto',
			margin: 4,
			float: true,
			acceptWidgets: false,
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
			const tiles = getCardTiles(card.id);
			const tile = tiles.find((t) => t.id === itemId);

			if (!tile) continue;

			renderTileContent(itemElContent, tile, card.id);

			tileSet.add(tile.id);
		}
	});

	grid.on('removed', function (_event, items) {
		for (const item of items) {
			const itemEl = item.el;
			const itemElContent = itemEl?.querySelector('.grid-stack-item-content');

			if (!itemElContent) continue;

			render(null, itemElContent as HTMLElement);

			if (item.id) {
				tileSet.delete(item.id);

				if (!suppressMarkChanged.value) {
					removedTiles.add(item.id);
				}

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

	const cardsToInit = sortedCards.value.filter((card) => getCardTiles(card.id).length > 0);

	if (cardsToInit.length === 0) {
		suppressMarkChanged.value = false;

		return;
	}

	nextTick(() => {
		for (const card of cardsToInit) {
			initializeCardGrid(card);
		}

		suppressMarkChanged.value = false;
	});
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

onMounted((): void => {
	nextTick(() => {
		initializeGrids();
	});

	setTimeout(() => {
		initialized.value = true;
	}, 500);
});

onBeforeUnmount((): void => {
	destroyGrids();
});

// Watch for tile changes per card
watch(
	(): ICard[] => sortedCards.value,
	(): void => {
		for (const card of sortedCards.value) {
			ensureTileStore(card.id);
		}

		nextTick(() => {
			initializeGrids();
		});
	}
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
					actions: ReturnType<typeof useTilesActions>;
					gridItems: { id: string; x: number; y: number; w: number; h: number }[];
				}[] = [];

				for (const [cardId, grid] of cardGrids) {
					const actions = tileActionsByCard.get(cardId);

					if (!actions || !grid) continue;

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

					tileUpdates.push({ actions, gridItems });
				}

				// Now await all API calls
				for (const { actions, gridItems } of tileUpdates) {
					for (const gridItem of gridItems) {
						let tile = actions.findById('card', gridItem.id);

						if (tile) {
							tile = await actions.edit({
								id: tile.id,
								parent: tile.parent,
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
									parent: tile.parent,
								});
							}
						}
					}
				}

				for (const tileId of removedTiles) {
					for (const [cardId, actions] of tileActionsByCard) {
						const tile = actions.findById('card', tileId);

						if (tile) {
							await actions.removeDirectly({
								id: tileId,
								parent: { type: 'card', id: cardId },
							});

							break;
						}
					}
				}

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
			// Recalculate cell sizes for all grids
			for (const [, grid] of cardGrids) {
				const el = grid.el;

				if (el) {
					const width = el.clientWidth;
					const cols = grid.getColumn();
					const size = width / cols;
					grid.cellHeight(size);
				}
			}
		});
	}
);
</script>

<style rel="stylesheet/scss" lang="scss">
@use 'page-configure.scss';
</style>
