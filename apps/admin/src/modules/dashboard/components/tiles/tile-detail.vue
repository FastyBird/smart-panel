<template>
	<dl class="grid m-0">
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('dashboardModule.texts.tiles.plugin') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				{{ plugin?.name }}
			</el-text>
		</dd>
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('dashboardModule.texts.tiles.dataSources') }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				<i18n-t
					keypath="dashboardModule.texts.tiles.dataSourcesCount"
					:plural="dataSources.length"
				>
					<template #count>
						<strong>{{ dataSources.length }}</strong>
					</template>
				</i18n-t>
			</el-text>
		</dd>
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('dashboardModule.texts.tiles.row') }}
		</dt>
		<dd class="b-b b-b-solid col-start-2 m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				{{ props.tile.row }}
			</el-text>
		</dd>
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('dashboardModule.texts.tiles.col') }}
		</dt>
		<dd class="b-b b-b-solid col-start-2 m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				{{ props.tile.col }}
			</el-text>
		</dd>
		<dt
			class="b-b b-b-solid b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('dashboardModule.texts.tiles.size') }}
		</dt>
		<dd class="b-b b-b-solid col-start-2 m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>{{ props.tile.colSpan }} x {{ props.tile.rowSpan }}</el-text>
		</dd>
		<dt
			class="b-r b-r-solid py-3 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t('dashboardModule.texts.tiles.visibility') }}
		</dt>
		<dd class="col-start-2 m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				<el-tag
					v-if="tile.hidden"
					type="warning"
					size="small"
				>
					{{ t('dashboardModule.texts.tiles.hidden') }}
				</el-tag>
				<el-tag
					v-else
					type="success"
					size="small"
				>
					{{ t('dashboardModule.texts.tiles.visible') }}
				</el-tag>
			</el-text>
		</dd>
	</dl>
</template>

<script setup lang="ts">
import { I18nT, useI18n } from 'vue-i18n';

import { ElTag, ElText } from 'element-plus';

import { useDataSources } from '../../composables/useDataSources';
import { useTilesPlugin } from '../../composables/useTilesPlugin';

import type { ITileDetailProps } from './tile-detail.types';

defineOptions({
	name: 'TileDetail',
});

const props = defineProps<ITileDetailProps>();

const { t } = useI18n();

const { plugin } = useTilesPlugin({ type: props.tile.type });

const { dataSources } = useDataSources({ parent: 'tile', parentId: props.tile.id });
</script>
