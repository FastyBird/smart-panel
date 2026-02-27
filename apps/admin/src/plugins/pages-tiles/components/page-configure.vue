<template>
	<div class="h-full box-border overflow-hidden p-2">
		<el-row
			:gutter="10"
			justify="center"
			class="h-full"
		>
			<el-col
				:span="10"
				class="h-full overflow-hidden p-2"
			>
				<el-card
					body-class="p-0! flex flex-col"
					class="page-grid-card mx-auto h-full"
					:style="props.gridCardStyle"
				>
					<div class="page-grid-header flex items-center justify-between px-2 flex-shrink-0">
						<div class="flex items-center gap-1 min-w-0">
							<el-icon
								:size="14"
								color="var(--el-text-color-regular)"
							>
								<icon :icon="props.page.icon || 'mdi:view-dashboard'" />
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
						ref="pageGridContainer"
						class="flex-1 min-h-0 p-1"
					/>
				</el-card>
			</el-col>

			<el-col
				:span="10"
				class="h-full overflow-hidden p-2"
			>
				<el-card
					body-class="p-0! flex flex-col"
					class="page-grid-card mx-auto h-full"
					:style="props.gridCardStyle"
				>
					<div class="page-grid-header flex items-center justify-between px-2 flex-shrink-0">
						<div class="flex items-center gap-1 min-w-0">
							<el-icon
								:size="14"
								color="var(--el-text-color-regular)"
							>
								<icon icon="mdi:pencil-ruler" />
							</el-icon>
							<el-text
								size="small"
								class="truncate"
							>
								Draft
							</el-text>
						</div>
					</div>
					<div
						ref="draftGridContainer"
						class="flex-1 min-h-0 overflow-hidden p-1"
					/>
				</el-card>
			</el-col>

			<el-col
				:span="4"
				class="p-2"
			>
				<div class="flex flex-col gap-2">
					<el-card
						v-if="props.displays.length > 0"
						body-class="p-2!"
					>
						<template #header>
							Display
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

					<el-card
						v-if="enabledTileOptions.length"
						body-class="p-2!"
					>
						<template #header>
							Quick add tile
						</template>

						<div class="flex flex-col gap-2">
							<el-button
								v-for="opt in enabledTileOptions"
								:key="opt.value"
								size="small"
								class="w-full ml-0!"
								@click="emit('addTileOfType', opt.value)"
							>
								<template #icon>
									<icon icon="mdi:plus" />
								</template>
								{{ opt.label }}
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

import { ElButton, ElCard, ElCol, ElIcon, ElOption, ElRow, ElSelect, ElText } from 'element-plus';
import { GridStack, type GridStackWidget } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

import { Icon } from '@iconify/vue';

import {
	DashboardException,
	FormResult,
	type FormResultType,
	type IDataSource,
	type ITile,
	useTiles,
	useTilesActions,
	useTilesPlugins,
} from '../../../modules/dashboard';

import type { IPageConfigureProps } from './page-configure.types';
import TilePreview from './tile-preview.vue';

defineOptions({
	name: 'PageConfigure',
});

const props = withDefaults(defineProps<IPageConfigureProps>(), {
	remotePageResult: FormResult.NONE,
	remotePageChanged: false,
});

const emit = defineEmits<{
	(e: 'selectDisplay', displayId: string): void;
	(e: 'addTile'): void;
	(e: 'addPageDataSource'): void;
	(e: 'addTileOfType', type: string): void;
	(e: 'editTile', id: ITile['id']): void;
	(e: 'tileDetail', id: ITile['id']): void;
	(e: 'addTileDataSource', tileId: ITile['id']): void;
	(e: 'editTileDataSource', id: IDataSource['id']): void;
	(e: 'update:remote-page-submit', remotePageSubmit: boolean): void;
	(e: 'update:remote-page-result', remotePageResult: FormResultType): void;
	(e: 'update:remote-page-changed', formChanged: boolean): void;
}>();

const { options: tileOptions } = useTilesPlugins();

const enabledTileOptions = computed(() => tileOptions.value.filter((opt) => !opt.disabled));
const { tiles, fetchTiles, areLoading: loadingTiles } = useTiles({ parent: 'page', parentId: props.page.id });
const {
	findById: findTileById,
	edit: editTile,
	save: saveTile,
	removeDirectly: removeTile,
} = useTilesActions({ parent: 'page', parentId: props.page.id });

// Capture the app context so VNodes created via h() for GridStack cells
// inherit the provide/inject chain (plugins manager, stores manager, etc.)
const appContext = getCurrentInstance()?.appContext ?? null;

let pageGrid: GridStack | undefined;

let draftGrid: GridStack | undefined;

const pageGridContainer = ref<HTMLElement | null>(null);

const draftGridContainer = ref<HTMLElement | null>(null);

const pageTiles = new Set<ITile['id']>();

const draftTiles = new Set<ITile['id']>();

const removedTiles = new Set<ITile['id']>();

const initialized = ref<boolean>(false);

const suppressMarkChanged = ref<boolean>(false);

const pageChanged = ref<boolean>(false);

let changeTimeout: ReturnType<typeof setTimeout>;

const onTileRemove = (id: ITile['id']): void => {
	const el = document.querySelector(`.grid-stack-item[gs-id="${id}"]`);

	if (pageGrid?.getGridItems().some((item) => item.gridstackNode?.id === id)) {
		pageGrid.removeWidget(el as HTMLElement);
	} else if (draftGrid?.getGridItems().some((item) => item.gridstackNode?.id === id)) {
		draftGrid.removeWidget(el as HTMLElement);
	}
};

const updateSquareCells = (): void => {
	// Reset maxHeight on both cards so we measure unconstrained column height
	const pageCard = pageGridContainer.value?.closest('.page-grid-card') as HTMLElement | null;
	const draftCard = draftGridContainer.value?.closest('.page-grid-card') as HTMLElement | null;

	if (pageCard) pageCard.style.maxHeight = '';
	if (draftCard) draftCard.style.maxHeight = '';

	if (pageGridContainer.value && pageGrid) {
		const width = pageGridContainer.value.clientWidth;
		const cols = pageGrid.getColumn();
		const rows = props.gridLayout?.rows ?? 12;
		const sizeByWidth = width / cols;

		const availableHeight = pageGridContainer.value.clientHeight;
		const sizeByHeight = rows > 0 ? availableHeight / rows : sizeByWidth;

		const size = Math.min(sizeByWidth, sizeByHeight);

		pageGrid.cellHeight(size);

		// Cap card to actual content so there's no white space on large screens
		if (pageCard) {
			const headerEl = pageCard.querySelector('.page-grid-header') as HTMLElement | null;
			const headerH = headerEl?.offsetHeight ?? 0;
			const cs = getComputedStyle(pageGridContainer.value);
			const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
			pageCard.style.maxHeight = `${headerH + rows * size + padY + 2}px`;
		}
	}

	if (draftGridContainer.value && draftGrid) {
		const width = draftGridContainer.value.clientWidth;
		const cols = draftGrid.getColumn();
		const draftRows = props.gridLayout?.rows ?? 12;
		const sizeByWidth = width / cols;

		const availableHeight = draftGridContainer.value.clientHeight;
		const sizeByHeight = draftRows > 0 ? availableHeight / draftRows : sizeByWidth;

		const size = Math.min(sizeByWidth, sizeByHeight);

		draftGrid.cellHeight(size);

		// Cap card to actual content
		if (draftCard) {
			const draftHeaderEl = draftCard.querySelector('.page-grid-header') as HTMLElement | null;
			const draftHeaderH = draftHeaderEl?.offsetHeight ?? 0;
			const cs = getComputedStyle(draftGridContainer.value);
			const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
			draftCard.style.maxHeight = `${draftHeaderH + draftRows * size + padY + 2}px`;
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
};

const renderTileContent = (itemElContent: Element, tile: ITile): void => {
	const vnode = h(TilePreview, {
		tile,
		onDetail: (id: ITile['id']): void => {
			emit('tileDetail', id);
		},
		onEdit: (id: ITile['id']): void => {
			emit('editTile', id);
		},
		onRemove: (id: ITile['id']): void => {
			onTileRemove(id);
		},
	});

	if (appContext) {
		vnode.appContext = appContext;
	}

	render(vnode, itemElContent as HTMLElement);
};

const initializeGrids = (): void => {
	if (props.gridLayout === null) {
		return;
	}

	// Suppress all event side effects (markChanged, removedTiles) during
	// programmatic teardown and re-population of grids
	suppressMarkChanged.value = true;

	destroyGrids();

	pageGrid = GridStack.init(
		{
			column: props.gridLayout.cols,
			row: props.gridLayout.rows,
			cellHeight: 'auto',
			margin: 4,
			float: true,
			acceptWidgets: true,
		},
		pageGridContainer.value!
	);

	draftGrid = GridStack.init(
		{
			column: props.gridLayout.cols,
			row: props.gridLayout.rows,
			minRow: props.gridLayout.rows,
			cellHeight: 'auto',
			margin: 4,
			float: true,
			acceptWidgets: true,
		},
		draftGridContainer.value!
	);

	const insert = [{ h: 1, w: 1, content: 'new item' }];
	GridStack.setupDragIn('.newWidget', undefined, insert);

	pageGrid.on('dragstop', (_event, el): void => {
		const n = el.gridstackNode;

		const id = n?.id;

		const x = n?.x;
		const y = n?.y;

		if (!id) return;

		const tile = tiles.value.find((tile) => tile.id === id);

		if (!tile) return;

		if (tile.row - 1 !== y || tile.col - 1 !== x) {
			markChanged();
		}
	});

	pageGrid.on('resizestop', (_event, el): void => {
		const n = el.gridstackNode;

		const id = n?.id;

		const w = n?.w;
		const h = n?.h;

		if (!id) return;

		const tile = tiles.value.find((tile) => tile.id === id);

		if (!tile) return;

		if (tile.rowSpan !== h || tile.colSpan !== w) {
			markChanged();
		}
	});

	pageGrid.on('added', function (_event, items) {
		markChanged();

		for (const item of items) {
			const itemEl = item.el;

			if (!itemEl) {
				return;
			}

			const itemElContent = itemEl.querySelector('.grid-stack-item-content');

			if (!itemElContent) {
				return;
			}

			const itemId = item.id;

			const tile = tiles.value.find((tile) => tile.id === itemId);

			if (!tile) {
				return;
			}

			renderTileContent(itemElContent, tile);

			pageTiles.add(tile.id);

			pageTiles.forEach((item) => {
				if (removedTiles.has(item)) {
					removedTiles.delete(item);
				}
			});
		}
	});

	pageGrid.on('removed', function (_event, items) {
		for (const item of items) {
			const itemEl = item.el;

			const itemElContent = itemEl?.querySelector('.grid-stack-item-content');

			if (!itemElContent) {
				return;
			}

			render(null, itemElContent as HTMLElement);

			if (item.id) {
				pageTiles.delete(item.id);

				if (!draftTiles.has(item.id) && !suppressMarkChanged.value) {
					removedTiles.add(item.id);
				}

				markChanged();
			}
		}
	});

	draftGrid.on('added', function (_event, items) {
		markChanged();

		for (const item of items) {
			const itemEl = item.el;

			if (!itemEl) {
				return;
			}

			const itemElContent = itemEl.querySelector('.grid-stack-item-content');

			if (!itemElContent) {
				return;
			}

			const itemId = item.id;

			const tile = tiles.value.find((tile) => tile.id === itemId);

			if (!tile) {
				return;
			}

			draftGrid?.update(itemEl, { w: 2, h: 1 });

			draftTiles.add(tile.id);

			draftTiles.forEach((item) => {
				if (removedTiles.has(item)) {
					removedTiles.delete(item);
				}
			});

			draftGrid?.compact();

			nextTick(() => {
				renderTileContent(itemElContent, tile);
			});
		}
	});

	draftGrid.on('removed', function (_event, items) {
		for (const item of items) {
			const itemEl = item.el;

			const itemElContent = itemEl?.querySelector('.grid-stack-item-content');

			if (!itemElContent) {
				return;
			}

			render(null, itemElContent as HTMLElement);

			if (item.id) {
				draftTiles.delete(item.id);

				if (!pageTiles.has(item.id) && !suppressMarkChanged.value) {
					removedTiles.add(item.id);
				}

				markChanged();
			}

			draftGrid?.compact();
		}
	});

	updateSquareCells();

	addTilesToGrids();
	suppressMarkChanged.value = false;
};

const addTilesToGrids = (): void => {
	for (const tile of tiles.value) {
		// Skip tiles the user already dragged to trash
		if (removedTiles.has(tile.id)) {
			continue;
		}

		// Skip tiles already tracked in either grid
		if (pageTiles.has(tile.id) || draftTiles.has(tile.id)) {
			continue;
		}

		const fitsHorizontally = tile.col + tile.colSpan - 1 <= (props.gridLayout?.cols ?? 0);
		const fitsVertically = tile.row + tile.rowSpan - 1 <= (props.gridLayout?.rows ?? 0);

		if (fitsHorizontally && fitsVertically && !tile.hidden && !tile.draft) {
			pageGrid?.addWidget({
				id: tile.id,
				x: tile.col - 1,
				y: tile.row - 1,
				w: tile.colSpan,
				h: tile.rowSpan,
			});
		} else {
			draftGrid?.addWidget({
				id: tile.id,
				x: 0,
				y: 2,
				w: 1,
				h: 1,
			});
		}
	}

	draftGrid?.compact();
};

const markChanged = () => {
	if (!initialized.value || suppressMarkChanged.value) {
		return;
	}

	clearTimeout(changeTimeout);

	changeTimeout = setTimeout(() => {
		pageChanged.value = true;
	}, 50);
};

onBeforeMount((): void => {
	if (!loadingTiles.value) {
		fetchTiles().catch((error: unknown): void => {
			const err = error as Error;

			throw new DashboardException('Something went wrong', err);
		});
	}
});

onMounted((): void => {
	nextTick(() => {
		initializeGrids();
	});

	window.addEventListener('resize', updateSquareCells);

	setTimeout(() => {
		initialized.value = true;
	}, 500);
});

onBeforeUnmount((): void => {
	window.removeEventListener('resize', updateSquareCells);

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
	(): boolean => props.remotePageSubmit,
	async (val: boolean): Promise<void> => {
		if (val) {
			emit('update:remote-page-submit', false);
			emit('update:remote-page-result', FormResult.WORKING);

			pageGrid?.save(false, false, async (gridItem: GridStackWidget): Promise<void> => {
				if (!gridItem.id) {
					return;
				}

				let tile = findTileById('page', gridItem.id);

				if (tile) {
					tile = await editTile({
						id: tile.id,
						parent: tile.parent,
						data: {
							type: tile.type,
							row: gridItem.y! + 1,
							col: gridItem.x! + 1,
							rowSpan: gridItem.h || 1,
							colSpan: gridItem.w || 1,
							hidden: false,
						},
					});

					if (tile.draft) {
						await saveTile({
							id: tile.id,
							parent: tile.parent,
						});
					}
				}
			});

			draftGrid?.save(false, false, async (gridItem: GridStackWidget): Promise<void> => {
				if (!gridItem.id) {
					return;
				}

				let tile = findTileById('page', gridItem.id);

				if (tile) {
					tile = await editTile({
						id: tile.id,
						parent: tile.parent,
						data: {
							type: tile.type,
							hidden: true,
						},
					});

					if (tile.draft) {
						await saveTile({
							id: tile.id,
							parent: tile.parent,
						});
					}
				}
			});

			for (const tileId of removedTiles) {
				const tile = findTileById('page', tileId);

				if (tile) {
					await removeTile({
						id: tileId,
						parent: tile.parent,
					});
				}
			}

			emit('update:remote-page-result', FormResult.OK);

			pageChanged.value = false;
		}
	}
);

watch(
	(): boolean => pageChanged.value,
	(val: boolean): void => {
		emit('update:remote-page-changed', val);
	}
);

// Re-initialize grids when grid layout (rows/cols) changes
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

// Recalculate cell sizes when card style changes (e.g. different aspect ratio)
watch(
	(): Record<string, string> => props.gridCardStyle,
	(): void => {
		nextTick(() => {
			updateSquareCells();
		});
	}
);
</script>

<style lang="scss">
.grid-stack .grid-stack-item-content {
	display: flex;
	flex-direction: column;
}

.page-grid-card {
	overflow: hidden;

	.el-card__body {
		overflow: hidden;
		height: 100%;
	}
}

.page-grid-header {
	height: 36px;
	min-height: 36px;
	border-bottom: 1px solid var(--el-border-color-lighter);
	background-color: var(--el-fill-color-light);
}
</style>
