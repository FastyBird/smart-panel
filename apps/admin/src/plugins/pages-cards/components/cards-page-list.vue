<template>
	<!-- Template 8 on phone: the page is read as a list; cards are arranged from tablet portrait up -->
	<div
		class="flex flex-col gap-4"
		data-test-id="cards-page-list"
	>
		<span class="text-help">{{ t('pagesCardsPlugin.editor.phone.readOnly') }}</span>

		<state-view
			v-if="groups.length === 0"
			kind="empty"
			icon="mdi:view-dashboard-outline"
			:title="t('pagesCardsPlugin.texts.cards.noCards')"
		/>

		<el-card
			v-for="group in groups"
			:key="group.card.id"
			shadow="never"
			body-class="p-0!"
			:data-test-id="`cards-page-list-card-${group.card.id}`"
		>
			<template #header>
				<span class="text-card-title">{{ group.card.title }}</span>
			</template>

			<button
				v-for="tile in group.tiles"
				:key="tile.id"
				type="button"
				class="cards-page-list__row flex items-center gap-3 w-full px-4 py-3 text-left bg-transparent border-0 cursor-pointer"
				:data-test-id="`cards-page-list-${tile.id}`"
				@click="emit('detail', tile.id)"
			>
				<span class="flex flex-col gap-0.5 flex-1 min-w-0">
					<span class="text-body truncate">{{ tileName(tile) }}</span>
					<span class="text-help">{{ placeLabel(tile) }}</span>
				</span>
				<icon
					icon="mdi:chevron-right"
					width="20"
					height="20"
					class="shrink-0 text-muted"
					aria-hidden="true"
				/>
			</button>

			<span
				v-if="group.tiles.length === 0"
				class="block px-4 py-3 text-help"
			>
				{{ t('pagesCardsPlugin.editor.phone.noTiles') }}
			</span>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StateView } from '../../../common';
import { type ITile, useTilesPlugins } from '../../../modules/dashboard';
import type { ICard } from '../store/cards.store.types';

import type { ICardsPageListProps } from './cards-page-list.types';

defineOptions({
	name: 'CardsPageList',
});

const props = defineProps<ICardsPageListProps>();

const emit = defineEmits<{
	(e: 'detail', id: ITile['id']): void;
}>();

const { t } = useI18n();

const { getElement } = useTilesPlugins();

// Cards in their order, each with its saved tiles in reading order; a tile added but never saved is left out
const groups = computed<{ card: ICard; tiles: ITile[] }[]>((): { card: ICard; tiles: ITile[] }[] =>
	[...props.cards]
		.sort((a, b) => a.order - b.order)
		.map((card) => ({
			card,
			tiles: (props.tiles[card.id] ?? []).filter((tile) => !tile.draft).sort((a, b) => a.row - b.row || a.col - b.col),
		}))
);

const tileName = (tile: ITile): string => {
	const element = getElement(tile.type);

	return element?.name?.trim() ? element.name : tile.type;
};

const placeLabel = (tile: ITile): string =>
	`${t('pagesCardsPlugin.editor.inspector.positionValue', { row: tile.row, col: tile.col })} · ${t('pagesCardsPlugin.editor.inspector.sizeValue', { cols: tile.colSpan, rows: tile.rowSpan })}`;
</script>

<style scoped lang="scss">
.cards-page-list__row {
	color: inherit;
	font: inherit;

	& + & {
		border-top: 1px solid var(--el-border-color-lighter);
	}

	&:focus-visible {
		outline: 2px solid var(--el-color-primary);
		outline-offset: -2px;
	}
}
</style>
