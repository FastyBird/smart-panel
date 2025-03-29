<template>
	<template
		v-for="property in properties"
		:key="property.id"
	>
		<dt
			class="b-b b-b-solid b-r b-r-solid py-1 px-2 flex items-center justify-end"
			style="background: var(--el-fill-color-light)"
		>
			{{ t(`devicesModule.categories.channelsProperties.${property.category}`) }}
		</dt>
		<dd class="col-start-2 b-b b-b-solid m-0 p-2 flex items-center min-w-[8rem]">
			<el-text>
				{{ property.value }}
			</el-text>
		</dd>
	</template>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElText } from 'element-plus';

import { useChannelsProperties } from '../../composables/useChannelsProperties';

import type { IDeviceDetailDescriptionProps } from './device-detail-description.types';

defineOptions({
	name: 'DeviceDetailDescription',
});

const props = defineProps<IDeviceDetailDescriptionProps>();

const { t } = useI18n();

const { properties } = useChannelsProperties(props.channel.id);
</script>
