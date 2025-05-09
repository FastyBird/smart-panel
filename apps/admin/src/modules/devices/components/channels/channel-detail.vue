<template>
	<el-card
		body-class="p-0!"
		style="--el-card-padding: 0.5rem"
	>
		<template #header>
			<div class="flex flex-row items-center">
				<div class="flex-grow flex flex-row items-center">
					<div>
						<el-avatar :size="32">
							<icon
								icon="mdi:chip"
								class="w[20px] h[20px]"
							/>
						</el-avatar>
					</div>
					<div class="ml-3">
						<strong>{{ channel.name }}</strong>
						<el-text class="block">
							{{ t(`devicesModule.categories.channels.${channel.category}`) }}
						</el-text>
					</div>
				</div>

				<div class="flex-grow flex flex-row items-center justify-end">
					<el-button
						type="primary"
						plain
						class="px-4!"
						size="small"
						:disabled="!canAddAnotherProperty"
						data-test-id="add-property"
						@click="emit('property-add', props.channel.id)"
					>
						<template #icon>
							<icon icon="mdi:plus" />
						</template>

						{{ t('devicesModule.buttons.addProperty.title') }}
					</el-button>
					<el-button
						plain
						class="ml-2! px-4!"
						size="small"
						data-test-id="edit-channel"
						@click="emit('channel-edit', props.channel.id)"
					>
						<template #icon>
							<icon icon="mdi:pencil" />
						</template>
					</el-button>
					<el-button
						type="warning"
						plain
						class="ml-2! px-4!"
						size="small"
						data-test-id="remove-channel"
						@click="emit('channel-remove', props.channel.id)"
					>
						<template #icon>
							<icon icon="mdi:trash" />
						</template>
					</el-button>
				</div>
			</div>
		</template>

		<channels-properties-table
			v-model:filters="filters"
			v-model:sort-by="sortBy"
			v-model:sort-dir="sortDir"
			:items="properties"
			:total-rows="totalRows"
			:loading="areLoading"
			:filters-active="filtersActive"
			:with-filters="false"
			@edit="(id: IChannelProperty['id']) => emit('property-edit', props.channel.id, id)"
			@remove="(id: IChannelProperty['id']) => emit('property-remove', props.channel.id, id)"
			@reset-filters="onResetFilters"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAvatar, ElButton, ElCard, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useChannelSpecification, useChannelsPropertiesDataSource } from '../../composables/composables';
import type { IChannelProperty } from '../../store/channels.properties.store.types';
import type { IChannel } from '../../store/channels.store.types';

import type { IChannelDetailProps } from './channel-detail.types';
import ChannelsPropertiesTable from './channels-properties-table.vue';

defineOptions({
	name: 'ChannelDetail',
});

const props = defineProps<IChannelDetailProps>();

const emit = defineEmits<{
	(e: 'channel-edit', id: IChannel['id']): void;
	(e: 'channel-remove', id: IChannel['id']): void;
	(e: 'property-add', channelId: IChannel['id']): void;
	(e: 'property-edit', channelId: IChannel['id'], id: IChannelProperty['id']): void;
	(e: 'property-remove', channelId: IChannel['id'], id: IChannelProperty['id']): void;
}>();

const { t } = useI18n();

const { properties, totalRows, sortBy, sortDir, filters, filtersActive, fetchProperties, areLoading, resetFilter } = useChannelsPropertiesDataSource({
	channelId: props.channel.id,
});
const { canAddAnotherProperty } = useChannelSpecification({ id: props.channel.id });

const onResetFilters = (): void => {
	resetFilter();
};

onMounted(() => {
	fetchProperties().catch((): void => {
		// Could be ignored
	});
});
</script>
