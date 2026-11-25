<template>
	<!-- Template 8: the inspector. The selected tile, or with nothing selected, the page's data sources -->
	<div
		class="flex flex-col gap-4 p-3"
		data-test-id="tiles-inspector"
	>
		<template v-if="props.place && props.tile">
			<div class="flex items-start gap-2">
				<div class="flex flex-col gap-1 flex-1 min-w-0">
					<span class="text-card-title truncate">{{ tileName }}</span>
					<div>
						<status-tag
							:status="props.place.hidden ? 'info' : 'ok'"
							:label="props.place.hidden ? t('pagesTilesPlugin.editor.inspector.hidden') : t('pagesTilesPlugin.editor.inspector.onPage')"
						/>
					</div>
				</div>

				<el-tooltip
					:content="t('pagesTilesPlugin.buttons.close.title')"
					placement="top"
				>
					<el-button
						text
						circle
						:aria-label="t('pagesTilesPlugin.editor.aria.closeInspector')"
						data-test-id="tiles-inspector-close"
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

			<div class="flex flex-wrap gap-2">
				<el-button
					type="primary"
					plain
					class="ml-0!"
					data-test-id="tiles-inspector-edit"
					@click="emit('edit', props.tile.id)"
				>
					<template #icon>
						<icon icon="mdi:pencil" />
					</template>
					{{ t('pagesTilesPlugin.editor.buttons.edit') }}
				</el-button>

				<el-button
					v-if="props.place.hidden"
					class="ml-0!"
					:disabled="props.disabled"
					data-test-id="tiles-inspector-show"
					@click="emit('show', props.tile.id)"
				>
					<template #icon>
						<icon icon="mdi:eye-outline" />
					</template>
					{{ t('pagesTilesPlugin.editor.buttons.show') }}
				</el-button>

				<el-button
					v-else
					class="ml-0!"
					:disabled="props.disabled"
					data-test-id="tiles-inspector-hide"
					@click="emit('hide', props.tile.id)"
				>
					<template #icon>
						<icon icon="mdi:eye-off-outline" />
					</template>
					{{ t('pagesTilesPlugin.editor.buttons.hide') }}
				</el-button>

				<el-button
					v-if="!props.tile.draft"
					class="ml-0!"
					data-test-id="tiles-inspector-detail"
					@click="emit('detail', props.tile.id)"
				>
					<template #icon>
						<icon icon="mdi:file-search-outline" />
					</template>
					{{ t('pagesTilesPlugin.editor.buttons.detail') }}
				</el-button>

				<el-button
					type="danger"
					plain
					class="ml-0!"
					:disabled="props.disabled"
					data-test-id="tiles-inspector-remove"
					@click="emit('remove', props.tile.id)"
				>
					<template #icon>
						<icon icon="mdi:trash-can-outline" />
					</template>
					{{ t('pagesTilesPlugin.editor.buttons.remove') }}
				</el-button>
			</div>

			<span class="text-help">{{ t('pagesTilesPlugin.editor.inspector.saveHint') }}</span>
		</template>

		<template v-else>
			<span class="text-help">{{ t('pagesTilesPlugin.editor.inspector.nothingSelected') }}</span>

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

import { KvGrid, type KvGridItem, StatusTag } from '../../../common';
import { DataSourcesCard, type IDataSource, type ITile, useTilesPlugins } from '../../../modules/dashboard';

import type { ITilesInspectorProps } from './tiles-inspector.types';

defineOptions({
	name: 'TilesInspector',
});

const props = defineProps<ITilesInspectorProps>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'edit', id: ITile['id']): void;
	(e: 'detail', id: ITile['id']): void;
	(e: 'hide', id: ITile['id']): void;
	(e: 'show', id: ITile['id']): void;
	(e: 'remove', id: ITile['id']): void;
	(e: 'addDataSource'): void;
	(e: 'editDataSource', id: IDataSource['id']): void;
	(e: 'removeDataSource', id: IDataSource['id']): void;
}>();

const { t } = useI18n();

const { getElement } = useTilesPlugins();

const tileName = computed<string>((): string => {
	if (!props.tile) {
		return '';
	}

	const element = getElement(props.tile.type);

	return element?.name?.trim() ? element.name : props.tile.type;
});

// Where the tile sits in the editor now, saved or not
const items = computed<KvGridItem[]>((): KvGridItem[] => {
	if (!props.place) {
		return [];
	}

	if (props.place.hidden) {
		return [
			{ label: t('pagesTilesPlugin.editor.inspector.position'), value: t('pagesTilesPlugin.editor.inspector.notPlaced') },
			{
				label: t('pagesTilesPlugin.editor.inspector.size'),
				value: t('pagesTilesPlugin.editor.inspector.sizeValue', { cols: props.place.colSpan, rows: props.place.rowSpan }),
			},
		];
	}

	return [
		{
			label: t('pagesTilesPlugin.editor.inspector.position'),
			value: t('pagesTilesPlugin.editor.inspector.positionValue', { row: props.place.row, col: props.place.col }),
		},
		{
			label: t('pagesTilesPlugin.editor.inspector.size'),
			value: t('pagesTilesPlugin.editor.inspector.sizeValue', { cols: props.place.colSpan, rows: props.place.rowSpan }),
		},
	];
});
</script>
