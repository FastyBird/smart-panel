<template>
	<el-card shadow="never" class="mb-2" header-class="py-2! px-4!" body-class="py-2! px-4!">
		<template #header>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<span class="font-semibold">{{ expose.exposeName }}</span>
					<el-tag
						:type="statusType"
						size="small"
					>
						{{ expose.status }}
					</el-tag>
				</div>
				<div class="flex items-center gap-2 text-sm text-gray-500">
					<span>{{ expose.exposeType }}</span>
				</div>
			</div>
		</template>

		<div v-if="expose.suggestedChannel" class="mb-3">
			<div class="flex items-center gap-2 mb-2">
				<span class="font-medium">{{ t('devicesZigbee2mqttPlugin.fields.mapping.suggestedChannel.title') }}:</span>
				<span>{{ expose.suggestedChannel.name }}</span>
				<el-tag
					:type="confidenceType"
					size="small"
				>
					{{ expose.suggestedChannel.confidence }}
				</el-tag>
			</div>
			<div class="text-sm text-gray-600">
				{{ t(`devicesModule.categories.channels.${expose.suggestedChannel.category}`) }}
			</div>
		</div>

		<div v-if="expose.suggestedProperties.length > 0" class="mb-3">
			<div class="font-medium mb-2">{{ t('devicesZigbee2mqttPlugin.fields.mapping.properties') }}:</div>
			<div class="grid grid-cols-2 gap-2 text-sm">
				<div
					v-for="property in expose.suggestedProperties"
					:key="`${property.category}-${property.z2mProperty}`"
					class="flex items-center gap-2"
				>
					<span class="text-gray-600">{{ property.name }}:</span>
					<el-tag
						v-if="property.currentValue !== null && property.currentValue !== undefined"
						size="small"
						type="info"
					>
						{{ property.currentValue }}
					</el-tag>
					<span v-else class="text-gray-400">-</span>
				</div>
			</div>
		</div>

		<div v-if="expose.missingRequiredProperties.length > 0" class="mt-2">
			<el-alert
				type="warning"
				:title="t('devicesZigbee2mqttPlugin.fields.mapping.missingRequiredProperties')"
				:closable="false"
				show-icon
				:description="expose.missingRequiredProperties.map((p) => t(`devicesModule.categories.channelsProperties.${p}`)).join(', ')"
			/>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElCard, ElTag } from 'element-plus';

import type { IExposeMappingPreview } from '../../schemas/mapping-preview.types';

interface IExposeMappingCardProps {
	expose: IExposeMappingPreview;
}

const props = defineProps<IExposeMappingCardProps>();

const { t } = useI18n();

const statusType = computed(() => {
	switch (props.expose.status) {
		case 'mapped':
			return 'success';
		case 'partial':
			return 'warning';
		case 'unmapped':
			return 'danger';
		case 'skipped':
			return 'info';
		default:
			return 'info';
	}
});

const confidenceType = computed(() => {
	if (!props.expose.suggestedChannel) {
		return 'info';
	}

	switch (props.expose.suggestedChannel.confidence) {
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
