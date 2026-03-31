<template>
	<template
		v-for="(property, index) in properties"
		:key="property.id"
	>
		<dt
			class="b-r b-r-solid py-3 px-2 flex items-center justify-end"
			:class="{ 'b-b b-b-solid': !isLastRow(index) }"
			style="background: var(--el-fill-color-light)"
		>
			{{ t(`devicesModule.categories.channelsProperties.${property.category}`) }}
		</dt>
		<dd
			class="m-0 p-2 flex items-center min-w-[8rem]"
			:class="{
				'b-b b-b-solid': !isLastRow(index),
				'b-r b-r-solid': index % 2 === 0,
			}"
		>
			<el-text>
				{{ property.value !== null && typeof property.value === 'object' && 'value' in property.value ? property.value.value : property.value }}
			</el-text>
		</dd>
	</template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElText } from 'element-plus';

import { DevicesModuleChannelPropertyCategory } from '../../../../openapi.constants';
import { useChannelsProperties } from '../../composables/useChannelsProperties';

import type { IDeviceDetailDescriptionProps } from './device-detail-description.types';

defineOptions({
	name: 'DeviceDetailDescription',
});

const props = defineProps<IDeviceDetailDescriptionProps>();

const { t } = useI18n();

const { properties: allProperties } = useChannelsProperties({ channelId: props.channel.id });

// Filter out "status" category — device-level connection status is already shown in device-detail.vue
const properties = computed(() => allProperties.value.filter((p) => p.category !== DevicesModuleChannelPropertyCategory.status));

// In a 2-per-row grid, check if this index is on the last row (no bottom border needed)
const isLastRow = (index: number): boolean => {
	const lastRow = Math.floor((properties.value.length - 1) / 2);
	return Math.floor(index / 2) === lastRow;
};
</script>
