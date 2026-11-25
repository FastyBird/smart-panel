<template>
	<!-- Template 8: the inspector. The selected tile or card, or with nothing selected, the page's data sources -->
	<div
		class="flex flex-col gap-4 p-3"
		data-test-id="cards-inspector"
	>
		<template v-if="selectedTile || props.card">
			<div class="flex items-start gap-2">
				<div class="flex flex-col gap-1 flex-1 min-w-0">
					<span class="text-card-title truncate">{{ heading }}</span>
					<span class="text-help truncate">{{ subheading }}</span>
				</div>

				<el-tooltip
					:content="t('pagesCardsPlugin.buttons.close.title')"
					placement="top"
				>
					<el-button
						text
						circle
						:aria-label="t('pagesCardsPlugin.editor.aria.closeInspector')"
						data-test-id="cards-inspector-close"
						@click="emit('close')"
					>
						<template #icon>
							<icon icon="mdi:close" />
						</template>
					</el-button>
				</el-tooltip>
			</div>

			<kv-grid
				:items="items"
				:cols="2"
			/>

			<div
				v-if="selectedTile"
				class="flex flex-wrap gap-2"
			>
				<el-button
					type="primary"
					plain
					class="ml-0!"
					data-test-id="cards-inspector-edit-tile"
					@click="emit('editTile', selectedTile.tile.id, selectedTile.place.cardId)"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
					{{ t('pagesCardsPlugin.editor.buttons.edit') }}
				</el-button>

				<el-button
					v-if="!selectedTile.tile.draft"
					class="ml-0!"
					data-test-id="cards-inspector-detail"
					@click="emit('detail', selectedTile.tile.id)"
				>
					<template #icon>
						<icon icon="mdi:file-search-outline" />
					</template>
					{{ t('pagesCardsPlugin.editor.buttons.detail') }}
				</el-button>

				<el-button
					type="danger"
					plain
					class="ml-0!"
					:disabled="props.disabled"
					data-test-id="cards-inspector-remove-tile"
					@click="emit('removeTile', selectedTile.tile.id)"
				>
					<template #icon>
						<icon icon="mdi:trash-can-outline" />
					</template>
					{{ t('pagesCardsPlugin.editor.buttons.remove') }}
				</el-button>
			</div>

			<div
				v-else-if="props.card"
				class="flex flex-wrap gap-2"
			>
				<el-button
					type="primary"
					plain
					class="ml-0!"
					data-test-id="cards-inspector-add-tile"
					@click="emit('addTile', props.card.id)"
				>
					<template #icon>
						<icon icon="mdi:plus" />
					</template>
					{{ t('pagesCardsPlugin.editor.buttons.addTile') }}
				</el-button>

				<el-button
					class="ml-0!"
					data-test-id="cards-inspector-edit-card"
					@click="emit('editCard', props.card.id)"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
					{{ t('pagesCardsPlugin.editor.buttons.edit') }}
				</el-button>

				<el-button
					type="danger"
					plain
					class="ml-0!"
					:disabled="props.disabled"
					data-test-id="cards-inspector-remove-card"
					@click="emit('removeCard', props.card.id)"
				>
					<template #icon>
						<icon icon="mdi:trash-can-outline" />
					</template>
					{{ t('pagesCardsPlugin.editor.buttons.remove') }}
				</el-button>
			</div>

			<span
				v-if="selectedTile"
				class="text-help"
			>
				{{ t('pagesCardsPlugin.editor.inspector.saveHint') }}
			</span>
		</template>

		<template v-else>
			<span class="text-help">{{ t('pagesCardsPlugin.editor.inspector.nothingSelected') }}</span>

			<data-sources-card
				:items="props.dataSources"
				:loading="props.dataSourcesLoading"
				@add="emit('addDataSource')"
				@edit="(id: IDataSource['id']) => emit('editDataSource', id)"
				@remove="(id: IDataSource['id']) => emit('removeDataSource', id)"
			/>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KvGrid, type KvGridItem } from '../../../common';
import { DataSourcesCard, type IDataSource, type ITile, useTilesPlugins } from '../../../modules/dashboard';
import type { ICard } from '../store/cards.store.types';

import type { ICardsInspectorProps } from './cards-inspector.types';
import type { IPageConfigureTilePlace } from './page-configure.types';

defineOptions({
	name: 'CardsInspector',
});

const props = withDefaults(defineProps<ICardsInspectorProps>(), {
	cardTileCount: 0,
	disabled: false,
});

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'editTile', id: ITile['id'], cardId: ICard['id']): void;
	(e: 'detail', id: ITile['id']): void;
	(e: 'removeTile', id: ITile['id']): void;
	(e: 'addTile', cardId: ICard['id']): void;
	(e: 'editCard', id: ICard['id']): void;
	(e: 'removeCard', id: ICard['id']): void;
	(e: 'addDataSource'): void;
	(e: 'editDataSource', id: IDataSource['id']): void;
	(e: 'removeDataSource', id: IDataSource['id']): void;
}>();

const { t } = useI18n();

const { getElement } = useTilesPlugins();

// A tile is shown when both its place and its record are known; the card is the one holding it
const selectedTile = computed<{ place: IPageConfigureTilePlace; tile: ITile } | null>((): { place: IPageConfigureTilePlace; tile: ITile } | null =>
	props.place && props.tile ? { place: props.place, tile: props.tile } : null
);

const heading = computed<string>((): string => (selectedTile.value ? tileName.value : (props.card?.title ?? '')));

const subheading = computed<string>((): string => {
	if (selectedTile.value) {
		return props.card ? t('pagesCardsPlugin.editor.inspector.inCard', { card: props.card.title }) : '';
	}

	return t('pagesCardsPlugin.editor.inspector.card');
});

const items = computed<KvGridItem[]>((): KvGridItem[] => (selectedTile.value ? tileItems.value : cardItems.value));

const tileName = computed<string>((): string => {
	if (!props.tile) {
		return '';
	}

	const element = getElement(props.tile.type);

	return element?.name?.trim() ? element.name : props.tile.type;
});

// Where the tile sits in the editor now, saved or not
const tileItems = computed<KvGridItem[]>((): KvGridItem[] => {
	if (!props.place) {
		return [];
	}

	return [
		{
			label: t('pagesCardsPlugin.editor.inspector.position'),
			value: t('pagesCardsPlugin.editor.inspector.positionValue', { row: props.place.row, col: props.place.col }),
		},
		{
			label: t('pagesCardsPlugin.editor.inspector.size'),
			value: t('pagesCardsPlugin.editor.inspector.sizeValue', { cols: props.place.colSpan, rows: props.place.rowSpan }),
		},
	];
});

const cardItems = computed<KvGridItem[]>((): KvGridItem[] => {
	if (!props.card) {
		return [];
	}

	const rows = props.card.rows ?? props.gridLayout?.rows;
	const cols = props.card.cols ?? props.gridLayout?.cols;

	return [
		{ label: t('pagesCardsPlugin.editor.inspector.order'), value: String(props.card.order) },
		{ label: t('pagesCardsPlugin.editor.inspector.tiles'), value: String(props.cardTileCount) },
		{
			label: t('pagesCardsPlugin.editor.inspector.grid'),
			value:
				rows !== undefined && cols !== undefined
					? t('pagesCardsPlugin.editor.inspector.sizeValue', { cols, rows })
					: t('pagesCardsPlugin.editor.inspector.gridFromDisplay'),
		},
	];
});
</script>
