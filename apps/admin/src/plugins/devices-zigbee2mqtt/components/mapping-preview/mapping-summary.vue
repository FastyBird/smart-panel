<template>
	<el-card shadow="never" header-class="py-2! px-4!" body-class="px-0!">
		<template #header>
			<div class="font-semibold">
				{{ t('devicesZigbee2mqttPlugin.headings.mapping.summary') }}
			</div>
		</template>

		<div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
			<div>
				<div class="text-2xl font-bold text-green-600">{{ mappedCount }}</div>
				<div class="text-sm text-gray-500">{{ t('devicesZigbee2mqttPlugin.fields.mapping.mapped') }}</div>
			</div>
			<div>
				<div class="text-2xl font-bold text-yellow-600">{{ partialCount }}</div>
				<div class="text-sm text-gray-500">{{ t('devicesZigbee2mqttPlugin.fields.mapping.partial') }}</div>
			</div>
			<div>
				<div class="text-2xl font-bold text-red-600">{{ unmappedCount }}</div>
				<div class="text-sm text-gray-500">{{ t('devicesZigbee2mqttPlugin.fields.mapping.unmapped') }}</div>
			</div>
			<div>
				<div class="text-2xl font-bold text-gray-600">{{ skippedCount }}</div>
				<div class="text-sm text-gray-500">{{ t('devicesZigbee2mqttPlugin.fields.mapping.skipped') }}</div>
			</div>
		</div>

		<el-divider />

		<div class="grid grid-cols-1 gap-4 text-sm mx-4">
			<div>
				<span class="font-medium">{{ t('devicesZigbee2mqttPlugin.fields.mapping.deviceName') }}:</span>
				<span class="ml-2">{{ preview.z2mDevice.friendlyName }}</span>
			</div>
			<div>
				<span class="font-medium">{{ t('devicesZigbee2mqttPlugin.fields.mapping.suggestedCategory') }}:</span>
				<span class="ml-2">{{ t(`devicesModule.categories.devices.${preview.suggestedDevice.category}`) }}</span>
				<el-tag
					:type="confidenceType"
					size="small"
					class="ml-2"
				>
					{{ preview.suggestedDevice.confidence }}
				</el-tag>
			</div>
			<div v-if="preview.z2mDevice.manufacturer">
				<span class="font-medium">{{ t('devicesZigbee2mqttPlugin.fields.devices.manufacturer.title') }}:</span>
				<span class="ml-2">{{ preview.z2mDevice.manufacturer }}</span>
			</div>
			<div v-if="preview.z2mDevice.model">
				<span class="font-medium">{{ t('devicesZigbee2mqttPlugin.fields.devices.model.title') }}:</span>
				<span class="ml-2">{{ preview.z2mDevice.model }}</span>
			</div>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard, ElDivider, ElTag } from 'element-plus';

import type { IMappingPreviewResponse } from '../../schemas/mapping-preview.types';

interface IMappingSummaryProps {
	preview: IMappingPreviewResponse;
}

const props = defineProps<IMappingSummaryProps>();

const { t } = useI18n();

const mappedCount = computed(() => props.preview.exposes.filter((e) => e.status === 'mapped').length);
const partialCount = computed(() => props.preview.exposes.filter((e) => e.status === 'partial').length);
const unmappedCount = computed(() => props.preview.exposes.filter((e) => e.status === 'unmapped').length);
const skippedCount = computed(() => props.preview.exposes.filter((e) => e.status === 'skipped').length);

const confidenceType = computed(() => {
	switch (props.preview.suggestedDevice.confidence) {
		case 'high':
			return 'success';
		case 'medium':
			return 'warning';
		case 'low':
			return 'danger';
		default:
			return 'info';
	}
});
</script>
