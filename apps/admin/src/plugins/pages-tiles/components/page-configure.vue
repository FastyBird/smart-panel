<template>
	<el-row
		:gutter="10"
		class="mt-2"
	>
		<el-col
			:span="12"
			class="px-2 pb-2"
		>
			<el-card
				body-class="p-1!"
				:class="`max-w-[${displayProfile?.screenWidth ?? 540}px]`"
			>
				<div ref="pageGridContainer" />
			</el-card>
		</el-col>

		<el-col
			:span="12"
			class="px-2 pb-2"
		>
			<el-card
				body-class="p-1!"
				:class="`max-w-[${displayProfile?.screenWidth ?? 540}px]`"
			>
				<div
					id="trash"
					ref="trashContainer"
					class="overflow-hidden p-1"
				>
					<div
						class="flex flex-col items-center justify-center h-full w-full rounded-2"
						style="background-color: var(--el-color-error-light-9)"
					>
						<el-icon
							:size="48"
							color="var(--el-color-danger)"
							class="mb-4"
						>
							<icon icon="mdi:trash-can-outline" />
						</el-icon>

						<el-text
							type="danger"
							size="large"
							class="text-center"
						>
							Drop here to remove tile!
						</el-text>
					</div>
				</div>

				<div ref="draftGridContainer" />
			</el-card>
		</el-col>
	</el-row>
</template>

<script setup lang="ts">
import { computed, h, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, render, watch } from 'vue';

import { ElCard, ElCol, ElIcon, ElRow, ElText } from 'element-plus';
import { GridStack, type GridStackWidget } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';

import { Icon } from '@iconify/vue';

import { injectStoresManager } from '../../../common';
import {
	DashboardException,
	FormResult,
	type FormResultType,
	type IDataSource,
	type ITile,
	tilesStoreKey,
	useTiles,
} from '../../../modules/dashboard';
import { type IDisplayProfile, useDisplaysProfiles } from '../../../modules/system';
import { calculateLayout } from '../../../modules/system/utils/gird-layout.utils.ts';

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
	(e: 'addTile'): void;
	(e: 'editTile', id: ITile['id']): void;
	(e: 'tileDetail', id: ITile['id']): void;
	(e: 'addTileDataSource', tileId: ITile['id']): void;
	(e: 'editTileDataSource', id: IDataSource['id']): void;
	(e: 'update:remote-page-submit', remotePageSubmit: boolean): void;
	(e: 'update:remote-page-result', remotePageResult: FormResultType): void;
	(e: 'update:remote-page-changed', formChanged: boolean): void;
}>();

const { displays, fetchDisplays, areLoading: loadingDisplays } = useDisplaysProfiles();
const { tiles, fetchTiles, areLoading: loadingTiles } = useTiles({ parent: 'page', parentId: props.page.id });

const storesManager = injectStoresManager();

const tilesStore = storesManager.getStore(tilesStoreKey);

let pageGrid: GridStack | undefined;

let draftGrid: GridStack | undefined;

const mounted = ref<boolean>(false);

const trashContainer = ref<HTMLElement | null>(null);

const pageGridContainer = ref<HTMLElement | null>(null);

const draftGridContainer = ref<HTMLElement | null>(null);

const pageTiles = new Set<ITile['id']>();

const draftTiles = new Set<ITile['id']>();

const removedTiles = new Set<ITile['id']>();

const initialized = ref<boolean>(false);

const pageChanged = ref<boolean>(false);

const displayProfile = computed<IDisplayProfile | null>((): IDisplayProfile | null => {
	const primary = displays.value.find((display) => display.primary);

	if (props.page.display !== null) {
		return displays.value.find((display) => display.id === props.page.display) ?? primary ?? null;
	}

	return primary ?? null;
});

const gridLayout = computed<{ rows: number; cols: number } | null>((): { rows: number; cols: number } | null => {
	if (displayProfile.value === null) {
		return null;
	}

	const grid = calculateLayout(displayProfile.value, {
		rows: props.page.rows,
		cols: props.page.cols,
		tileSize: props.page.tileSize,
	});

	return {
		rows: grid.rows,
		cols: grid.cols,
	};
});

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
	if (pageGridContainer.value && pageGrid) {
		const width = pageGridContainer.value.clientWidth;
		const cols = pageGrid.getColumn();
		const size = width / cols;

		pageGrid.cellHeight(size);

		if (trashContainer.value) {
			trashContainer.value.style.height = `${2 * size - (draftGrid?.getMargin() || 0) - 4}px`;
		}
	}

	if (draftGridContainer.value && draftGrid) {
		const width = draftGridContainer.value.clientWidth;
		const cols = draftGrid.getColumn();
		const size = width / cols;

		draftGrid.cellHeight(size);
	}
};

const initializeGrids = (): void => {
	if (gridLayout.value === null) {
		return;
	}

	pageGrid = GridStack.init(
		{
			column: gridLayout.value.cols,
			row: gridLayout.value.rows,
			cellHeight: 'auto',
			margin: 4,
			float: true,
			acceptWidgets: true,
			removable: '#trash',
		},
		pageGridContainer.value!
	);

	draftGrid = GridStack.init(
		{
			column: gridLayout.value.cols,
			minRow: gridLayout.value.rows - 2,
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

			const itemContentVNode = h(TilePreview, {
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
				onDataSourceAdd: (id: ITile['id']): void => {
					emit('addTileDataSource', id);
				},
			});

			render(itemContentVNode, itemElContent);

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

			render(null, itemElContent);

			if (item.id) {
				pageTiles.delete(item.id);

				if (!draftTiles.has(item.id)) {
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

			const itemContentVNode = h(TilePreview, {
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
				onDataSourceAdd: (id: ITile['id']): void => {
					emit('addTileDataSource', id);
				},
			});

			render(itemContentVNode, itemElContent);

			draftTiles.add(tile.id);

			draftTiles.forEach((item) => {
				if (removedTiles.has(item)) {
					removedTiles.delete(item);
				}
			});

			draftGrid?.compact();
		}
	});

	draftGrid.on('removed', function (_event, items) {
		for (const item of items) {
			const itemEl = item.el;

			const itemElContent = itemEl?.querySelector('.grid-stack-item-content');

			if (!itemElContent) {
				return;
			}

			render(null, itemElContent);

			if (item.id) {
				draftTiles.delete(item.id);

				if (!pageTiles.has(item.id)) {
					removedTiles.add(item.id);
				}

				markChanged();
			}

			draftGrid?.compact();
		}
	});

	updateSquareCells();
};

const markChanged = () => {
	if (!initialized.value) {
		return;
	}

	clearTimeout(changeTimeout);

	changeTimeout = setTimeout(() => {
		pageChanged.value = true;
	}, 50);
};

onBeforeMount((): void => {
	if (!loadingDisplays.value) {
		fetchDisplays().catch((error: unknown): void => {
			const err = error as Error;

			throw new DashboardException('Something went wrong', err);
		});
	}

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

	mounted.value = true;

	setTimeout(() => {
		initialized.value = true;
	}, 500);
});

onBeforeUnmount((): void => {
	window.removeEventListener('resize', updateSquareCells);

	pageGrid?.destroy();
	draftGrid?.destroy();
});

watch(
	(): ITile[] => tiles.value,
	(val: ITile[]): void => {
		for (const tile of val) {
			const fitsHorizontally = tile.col + tile.colSpan - 1 <= (gridLayout.value?.cols ?? 0);
			const fitsVertically = tile.row + tile.rowSpan - 1 <= (gridLayout.value?.rows ?? 0);

			if (fitsHorizontally && fitsVertically && !tile.hidden && !tile.draft) {
				if (!pageTiles.has(tile.id)) {
					pageGrid?.addWidget({
						id: tile.id,
						x: tile.col - 1,
						y: tile.row - 1,
						w: tile.colSpan,
						h: tile.rowSpan,
					});
				}
			} else if (!draftTiles.has(tile.id) && !pageTiles.has(tile.id)) {
				draftGrid?.addWidget({
					id: tile.id,
					x: 0,
					y: 2,
					w: 1,
					h: 1,
				});
			}
		}

		if (val.filter((tile) => tile.draft).length > 0) {
			markChanged();
		}

		draftGrid?.compact();
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

				let tile = tilesStore.findById('page', gridItem.id);

				if (tile) {
					tile = await tilesStore.edit({
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
						await tilesStore.save({
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

				let tile = tilesStore.findById('page', gridItem.id);

				if (tile) {
					tile = await tilesStore.edit({
						id: tile.id,
						parent: tile.parent,
						data: {
							type: tile.type,
							hidden: true,
						},
					});

					if (tile.draft) {
						await tilesStore.save({
							id: tile.id,
							parent: tile.parent,
						});
					}
				}
			});

			for (const tileId of removedTiles) {
				const tile = tilesStore.findById('page', tileId);

				if (tile) {
					await tilesStore.remove({
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

watch(
	(): { rows: number; cols: number } | null => gridLayout.value,
	(): void => {
		initializeGrids();
	}
);
</script>

<style rel="stylesheet/scss" lang="scss">
.grid-stack .grid-stack-item-content {
	display: flex;
	flex-direction: column;
}
</style>
