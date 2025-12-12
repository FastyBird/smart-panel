<template>
	<div class="flex flex-col h-full">
		<el-table
			v-loading="loading"
			:data="items"
			style="width: 100%"
			class="flex-1"
		>
			<el-table-column
				prop="name"
				:label="t('weatherModule.fields.locations.name.title')"
				min-width="200"
			/>
			<el-table-column
				prop="type"
				:label="t('weatherModule.fields.locations.type.title')"
				width="180"
			/>
			<el-table-column
				:label="t('weatherModule.fields.locations.actions.title')"
				width="150"
				align="right"
			>
				<template #default="{ row }">
					<el-button
						type="primary"
						link
						@click="$emit('edit', row.id)"
					>
						<el-icon><icon icon="mdi:pencil" /></el-icon>
					</el-button>
					<el-button
						type="danger"
						link
						@click="$emit('remove', row.id)"
					>
						<el-icon><icon icon="mdi:delete" /></el-icon>
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<div
			v-if="items.length === 0 && !loading"
			class="flex flex-col items-center justify-center py-8"
		>
			<el-icon
				:size="48"
				class="text-gray-400 mb-4"
			>
				<icon icon="mdi:map-marker-off" />
			</el-icon>
			<p class="text-gray-500">{{ t('weatherModule.messages.locations.noLocations') }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { Icon } from '@iconify/vue';

import type { IWeatherLocation } from '../store/locations.store.types';

defineOptions({
	name: 'ListLocations',
});

interface IListLocationsProps {
	items: IWeatherLocation[];
	loading?: boolean;
}

defineProps<IListLocationsProps>();

defineEmits<{
	(e: 'edit', id: IWeatherLocation['id']): void;
	(e: 'remove', id: IWeatherLocation['id']): void;
}>();

const { t } = useI18n();
</script>
