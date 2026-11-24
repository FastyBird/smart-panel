<template>
	<!-- Template 8 on phone: the page is read as a list; tiles are arranged from tablet portrait up -->
	<div
		class="flex flex-col gap-4"
		data-test-id="tiles-page-list"
	>
		<span class="text-help">{{ t('pagesTilesPlugin.editor.phone.readOnly') }}</span>

		<el-card
			v-for="group in groups"
			:key="group.key"
			shadow="never"
			body-class="p-0!"
		>
			<template #header>
				<span class="text-card-title">{{ group.title }}</span>
			</template>

			<button
				v-for="tile in group.tiles"
				:key="tile.id"
				type="button"
				class="tiles-page-list__row flex items-center gap-3 w-full px-4 py-3 text-left bg-transparent border-0 cursor-pointer"
				:data-test-id="`tiles-page-list-${tile.id}`"
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
				{{ group.empty }}
			</span>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';

import { type ITile, useTilesPlugins } from '../../../modules/dashboard';

import type { ITilesPageListProps } from './tiles-page-list.types';

defineOptions({
	name: 'TilesPageList',
});

const props = defineProps<ITilesPageListProps>();

const emit = defineEmits<{
	(e: 'detail', id: ITile['id']): void;
}>();

const { t } = useI18n();

const { getElement } = useTilesPlugins();

// The same split the editor makes: a tile that does not fit the grid waits with the hidden ones
const isOnPage = (tile: ITile): boolean =>
	!tile.hidden &&
	!tile.draft &&
	props.gridLayout !== null &&
	tile.col + tile.colSpan - 1 <= props.gridLayout.cols &&
	tile.row + tile.rowSpan - 1 <= props.gridLayout.rows;

const groups = computed<{ key: string; title: string; empty: string; tiles: ITile[] }[]>(
	(): { key: string; title: string; empty: string; tiles: ITile[] }[] => {
		const saved = props.tiles.filter((tile) => !tile.draft);

		return [
			{
				key: 'page',
				title: t('pagesTilesPlugin.editor.inspector.onPage'),
				empty: t('pagesTilesPlugin.editor.phone.noTiles'),
				tiles: saved.filter(isOnPage).sort((a, b) => a.row - b.row || a.col - b.col),
			},
			{
				key: 'hidden',
				title: t('pagesTilesPlugin.editor.hidden.title'),
				empty: t('pagesTilesPlugin.editor.phone.noHiddenTiles'),
				tiles: saved.filter((tile) => !isOnPage(tile)),
			},
		];
	}
);

const tileName = (tile: ITile): string => {
	const element = getElement(tile.type);

	return element?.name?.trim() ? element.name : tile.type;
};

const placeLabel = (tile: ITile): string => {
	const size = t('pagesTilesPlugin.editor.inspector.sizeValue', { cols: tile.colSpan, rows: tile.rowSpan });

	if (!isOnPage(tile)) {
		return `${t('pagesTilesPlugin.editor.inspector.size')}: ${size}`;
	}

	return `${t('pagesTilesPlugin.editor.inspector.positionValue', { row: tile.row, col: tile.col })} · ${size}`;
};
</script>

<style scoped lang="scss">
.tiles-page-list__row {
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
