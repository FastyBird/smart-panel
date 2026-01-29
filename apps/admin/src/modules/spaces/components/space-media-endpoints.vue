<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<el-select
					v-model="filterType"
					:placeholder="t('spacesModule.media.endpoints.filterPlaceholder')"
					clearable
					class="w-200px"
				>
					<el-option
						v-for="option in typeOptions"
						:key="option.value"
						:label="option.label"
						:value="option.value"
					/>
				</el-select>
			</div>
		</div>

		<el-table
			v-loading="loading"
			:element-loading-text="t('spacesModule.media.endpoints.loading')"
			:data="filteredEndpoints"
			table-layout="fixed"
			row-key="endpointId"
		>
			<el-table-column
				:label="t('spacesModule.media.endpoints.columns.name')"
				min-width="200"
			>
				<template #default="{ row }">
					<div class="flex items-center gap-2">
						<el-avatar :size="32">
							<icon
								:icon="getTypeIcon(row.type)"
								class="w[20px] h[20px]"
							/>
						</el-avatar>
						<div>
							<div class="font-medium">{{ row.name }}</div>
							<div class="text-xs text-gray-500">
								{{ row.endpointId }}
							</div>
						</div>
					</div>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('spacesModule.media.endpoints.columns.type')"
				width="160"
			>
				<template #default="{ row }">
					<el-tag
						:type="getTypeBadgeType(row.type)"
						size="small"
					>
						{{ getTypeLabel(row.type) }}
					</el-tag>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('spacesModule.media.endpoints.columns.capabilities')"
				min-width="280"
			>
				<template #default="{ row }">
					<div class="flex flex-wrap gap-1">
						<el-tag
							v-if="row.capabilities.power"
							size="small"
							type="info"
						>
							{{ t('spacesModule.media.capabilities.power') }}
						</el-tag>
						<el-tag
							v-if="row.capabilities.inputSelect"
							size="small"
							type="info"
						>
							{{ t('spacesModule.media.capabilities.input') }}
						</el-tag>
						<el-tag
							v-if="row.capabilities.volume"
							size="small"
							type="info"
						>
							{{ t('spacesModule.media.capabilities.volume') }}
						</el-tag>
						<el-tag
							v-if="row.capabilities.playback"
							size="small"
							type="info"
						>
							{{ t('spacesModule.media.capabilities.playback') }}
						</el-tag>
						<el-tag
							v-if="row.capabilities.track"
							size="small"
							type="info"
						>
							{{ t('spacesModule.media.capabilities.track') }}
						</el-tag>
						<el-tag
							v-if="row.capabilities.remoteCommands"
							size="small"
							type="info"
						>
							{{ t('spacesModule.media.capabilities.remote') }}
						</el-tag>
						<el-tag
							v-if="row.capabilities.mute"
							size="small"
							type="info"
						>
							{{ t('spacesModule.media.capabilities.mute') }}
						</el-tag>
					</div>
				</template>
			</el-table-column>

			<template #empty>
				<el-result
					v-if="!loading"
					icon="info"
				>
					<template #title>
						{{ t('spacesModule.media.endpoints.empty.title') }}
					</template>
					<template #sub-title>
						{{ t('spacesModule.media.endpoints.empty.subtitle') }}
					</template>
				</el-result>
			</template>
		</el-table>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAvatar, ElOption, ElResult, ElSelect, ElTable, ElTableColumn, ElTag, vLoading } from 'element-plus';
import { Icon } from '@iconify/vue';

import {
	type IDerivedMediaEndpoint,
	MediaEndpointType,
	useSpaceMedia,
} from '../composables/useSpaceMedia';

import type { ISpaceMediaEndpointsProps } from './space-media-endpoints.types';

defineOptions({
	name: 'SpaceMediaEndpoints',
});

const props = defineProps<ISpaceMediaEndpointsProps>();

const { t } = useI18n();

const spaceIdRef = computed(() => props.spaceId);
const { endpoints, fetchingEndpoints: loading, fetchEndpoints } = useSpaceMedia(spaceIdRef);

const filterType = ref<string>('');

const typeOptions = computed(() => [
	{ value: MediaEndpointType.display, label: t('spacesModule.media.endpointTypes.display') },
	{ value: MediaEndpointType.audio_output, label: t('spacesModule.media.endpointTypes.audio_output') },
	{ value: MediaEndpointType.source, label: t('spacesModule.media.endpointTypes.source') },
	{ value: MediaEndpointType.remote_target, label: t('spacesModule.media.endpointTypes.remote_target') },
]);

const filteredEndpoints = computed<IDerivedMediaEndpoint[]>(() => {
	if (!filterType.value) return endpoints.value;
	return endpoints.value.filter((ep) => ep.type === filterType.value);
});

const getTypeIcon = (type: string): string => {
	switch (type) {
		case MediaEndpointType.display:
			return 'mdi:television';
		case MediaEndpointType.audio_output:
			return 'mdi:speaker';
		case MediaEndpointType.source:
			return 'mdi:play-circle';
		case MediaEndpointType.remote_target:
			return 'mdi:remote';
		default:
			return 'mdi:help-circle';
	}
};

const getTypeBadgeType = (type: string): '' | 'success' | 'warning' | 'info' | 'danger' => {
	switch (type) {
		case MediaEndpointType.display:
			return '';
		case MediaEndpointType.audio_output:
			return 'success';
		case MediaEndpointType.source:
			return 'warning';
		case MediaEndpointType.remote_target:
			return 'info';
		default:
			return 'info';
	}
};

const getTypeLabel = (type: string): string => {
	return t(`spacesModule.media.endpointTypes.${type}`);
};

onBeforeMount(async () => {
	await fetchEndpoints();
});
</script>
