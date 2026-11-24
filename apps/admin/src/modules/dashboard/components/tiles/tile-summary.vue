<template>
	<!-- Template 3: the summary card at the top of a tile's detail -->
	<el-card
		shadow="never"
		body-class="flex flex-wrap items-start gap-4 p-4!"
		data-test-id="tile-summary"
	>
		<div
			class="flex items-center justify-center shrink-0 w-14 h-14 rounded-lg bg-fill-light text-regular"
			aria-hidden="true"
		>
			<icon
				icon="mdi:widget-tree"
				width="32"
				height="32"
			/>
		</div>

		<div class="flex flex-col gap-1 min-w-[200px]">
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-section">{{ plugin?.name || props.tile.type }}</span>
				<status-tag
					:status="props.tile.hidden ? 'warn' : 'ok'"
					:label="props.tile.hidden ? t('dashboardModule.texts.tiles.hidden') : t('dashboardModule.texts.tiles.visible')"
					data-test-id="tile-summary-visibility"
				/>
			</div>
			<span class="text-help">{{ t('dashboardModule.texts.tiles.dataSourcesCount', { count: dataSources.length }, dataSources.length) }}</span>
		</div>

		<kv-grid
			:items="items"
			:cols="3"
			class="flex-1 min-w-[280px]"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KvGrid, type KvGridItem, StatusTag } from '../../../../common';
import { useDataSources } from '../../composables/useDataSources';
import { useTilesPlugin } from '../../composables/useTilesPlugin';
import type { ITile } from '../../store/tiles.store.types';

defineOptions({
	name: 'TileSummary',
});

const props = defineProps<{ tile: ITile }>();

const { t } = useI18n();

const { plugin } = useTilesPlugin({ type: props.tile.type });
const { dataSources } = useDataSources({ parent: 'tile', parentId: props.tile.id });

const items = computed<KvGridItem[]>((): KvGridItem[] => [
	{ label: t('dashboardModule.texts.tiles.row'), value: props.tile.row },
	{ label: t('dashboardModule.texts.tiles.col'), value: props.tile.col },
	{ label: t('dashboardModule.texts.tiles.size'), value: `${props.tile.colSpan}×${props.tile.rowSpan}` },
]);
</script>
