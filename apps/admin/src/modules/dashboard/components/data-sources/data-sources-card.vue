<template>
	<!-- Template 3: the data sources of a page or a tile, as one card under the summary -->
	<el-card
		shadow="never"
		body-class="flex flex-col gap-3 p-4!"
		data-test-id="data-sources-card"
	>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex flex-col gap-0.5 min-w-0 flex-1">
				<span class="text-card-title">{{ t('dashboardModule.texts.tiles.dataSources') }}</span>
				<span class="text-help">{{ t('dashboardModule.texts.dataSources.description') }}</span>
			</div>

			<el-button
				plain
				data-test-id="data-sources-add"
				@click="emit('add')"
			>
				<template #icon>
					<icon icon="mdi:plus" />
				</template>

				{{ t('dashboardModule.buttons.addDataSource.title') }}
			</el-button>
		</div>

		<state-view
			v-if="props.loading && props.items.length === 0"
			kind="loading"
			icon="mdi:database-cog-outline"
			:title="t('dashboardModule.texts.dataSources.loadingDataSources')"
		/>

		<state-view
			v-else-if="props.items.length === 0"
			kind="empty"
			icon="mdi:database-cog-outline"
			:title="t('dashboardModule.texts.dataSources.noDataSources')"
			:description="t('dashboardModule.texts.dataSources.noDataSourcesHint')"
		/>

		<ul
			v-else
			class="m-0 p-0 list-none border border-solid border-light rounded-lg"
			data-test-id="data-sources-list"
		>
			<li
				v-for="dataSource in props.items"
				:key="dataSource.id"
				class="flex items-center gap-3 min-h-14 px-3 py-2 border-b border-b-solid border-light last:border-b-0"
				data-test-id="data-source-row"
			>
				<span
					class="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-fill-light text-regular"
					aria-hidden="true"
				>
					<icon
						icon="mdi:database-cog-outline"
						width="20"
						height="20"
					/>
				</span>

				<data-sources-table-column-plugin
					:data-source="dataSource"
					class="flex-1 min-w-0"
				/>

				<span class="inline-flex items-center gap-1 shrink-0">
					<el-tooltip
						:content="t('dashboardModule.buttons.edit.title')"
						placement="top"
					>
						<el-button
							:aria-label="t('dashboardModule.aria.dataSources.edit')"
							text
							circle
							data-test-id="edit-data-source"
							@click="emit('edit', dataSource.id)"
						>
							<template #icon>
								<icon icon="mdi:pencil" />
							</template>
						</el-button>
					</el-tooltip>

					<el-tooltip
						:content="t('dashboardModule.buttons.more.title')"
						placement="top"
					>
						<el-dropdown
							trigger="click"
							placement="bottom-end"
							@command="emit('remove', dataSource.id)"
						>
							<el-button
								:aria-label="t('dashboardModule.aria.dataSources.more')"
								text
								circle
								data-test-id="more-data-source"
							>
								<template #icon>
									<icon icon="mdi:dots-horizontal" />
								</template>
							</el-button>

							<template #dropdown>
								<el-dropdown-menu>
									<el-dropdown-item
										command="remove"
										class="text-danger!"
										data-test-id="remove-data-source"
									>
										{{ t('dashboardModule.buttons.remove.title') }}
									</el-dropdown-item>
								</el-dropdown-menu>
							</template>
						</el-dropdown>
					</el-tooltip>
				</span>
			</li>
		</ul>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElDropdown, ElDropdownItem, ElDropdownMenu, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StateView } from '../../../../common';
import type { IDataSource } from '../../store/data-sources.store.types';

import DataSourcesTableColumnPlugin from './data-sources-table-column-plugin.vue';

defineOptions({
	name: 'DataSourcesCard',
});

const props = defineProps<{ items: IDataSource[]; loading: boolean }>();

const emit = defineEmits<{
	(e: 'add'): void;
	(e: 'edit', id: IDataSource['id']): void;
	(e: 'remove', id: IDataSource['id']): void;
}>();

const { t } = useI18n();
</script>
